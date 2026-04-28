/**
 * Alpha Vantage HTTP client. Native `fetch` only (Constitution: no axios,
 * no SDK). Returns `Result` from every public method so failures never
 * leak as thrown exceptions across the package boundary (C5).
 *
 * Auth: every request carries the API key via `&apikey=...`. Alpha Vantage
 * does not offer header-based auth on the free tier — the key in the
 * query string is the documented mechanism.
 *
 * Rate limiting: the free tier caps usage at 25 calls/day and 5
 * calls/minute. We default the per-minute slider to 5; the daily quota
 * is enforced upstream by the Alpha Vantage server (we surface its
 * `Information` envelope as `Result.err`).
 *
 * Error envelope: Alpha Vantage returns `200 OK` with one of three error
 * payloads on bad symbols / throttle / quota — `Error Message`, `Note`,
 * `Information`. The client recognises every envelope via
 * `AlphaVantageErrorSchema` and surfaces it as `Result.err` so callers can
 * rely on the standard ok/err contract.
 */
import { err, ok, type Result } from "@darkscore/types";
import { RateLimiter } from "../../rate-limiter.js";
import { AlphaVantageErrorSchema } from "./schemas.js";

const DEFAULT_BASE_URL = "https://www.alphavantage.co/query";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 5;
const ONE_MINUTE_MS = 60_000;
const DEFAULT_USER_AGENT =
  "darkscore/0.0.0 (+https://github.com/gabrielo91/ticker-score)";

export class AlphaVantageApiError extends Error {
  readonly endpoint: string;
  readonly kind: "errorMessage" | "note" | "information";
  constructor(
    endpoint: string,
    kind: "errorMessage" | "note" | "information",
    message: string,
  ) {
    super(message);
    this.name = "AlphaVantageApiError";
    this.endpoint = endpoint;
    this.kind = kind;
  }
}

export interface AlphaVantageClientOptions {
  /** API key. Required — the client refuses to issue requests without one. */
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly rateLimitPerMinute?: number;
}

export class AlphaVantageClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly limiter: RateLimiter;

  constructor(options: AlphaVantageClientOptions) {
    if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
      throw new Error("AlphaVantageClient: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\?+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new RateLimiter(
      options.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
      ONE_MINUTE_MS,
    );
  }

  fetchOverview(symbol: string): Promise<Result<unknown>> {
    return this.getJson("OVERVIEW", { symbol });
  }

  fetchTimeSeriesDaily(
    symbol: string,
    outputsize: "compact" | "full" = "compact",
  ): Promise<Result<unknown>> {
    return this.getJson("TIME_SERIES_DAILY", { symbol, outputsize });
  }

  fetchIncomeStatement(symbol: string): Promise<Result<unknown>> {
    return this.getJson("INCOME_STATEMENT", { symbol });
  }

  fetchBalanceSheet(symbol: string): Promise<Result<unknown>> {
    return this.getJson("BALANCE_SHEET", { symbol });
  }

  fetchEarnings(symbol: string): Promise<Result<unknown>> {
    return this.getJson("EARNINGS", { symbol });
  }

  private async getJson(
    fnName: string,
    params: Record<string, string>,
  ): Promise<Result<unknown>> {
    await this.limiter.acquire();
    const search = new URLSearchParams({ function: fnName, ...params, apikey: this.apiKey });
    const path = `?${search.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": this.userAgent,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await safeReadBody(response);
        return err(
          new Error(
            `AlphaVantageClient: ${response.status} ${response.statusText} on ${fnName}${body !== "" ? ` — ${body}` : ""}`,
          ),
        );
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch (e) {
        return err(
          new Error(
            `AlphaVantageClient: invalid JSON on ${fnName}: ${(e as Error).message}`,
          ),
        );
      }
      const envelope = AlphaVantageErrorSchema.safeParse(json);
      if (envelope.success) {
        const e = envelope.data;
        if (typeof e["Error Message"] === "string") {
          return err(
            new AlphaVantageApiError(fnName, "errorMessage", e["Error Message"]),
          );
        }
        if (typeof e.Note === "string") {
          return err(new AlphaVantageApiError(fnName, "note", e.Note));
        }
        if (typeof e.Information === "string") {
          return err(
            new AlphaVantageApiError(fnName, "information", e.Information),
          );
        }
      }
      return ok(json);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return err(
        new Error(`AlphaVantageClient: fetch failed on ${fnName}: ${reason}`),
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}

