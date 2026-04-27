/**
 * Twelve Data HTTP client. Native `fetch` only (Constitution: no axios, no
 * got, no SDK). Returns `Result` from every public method so failures never
 * leak as thrown exceptions across the package boundary (C5).
 *
 * Auth: every request carries the API key via `?apikey=...`. Twelve Data
 * does not support a header-based auth on the free tier — the key in the
 * query string is the documented mechanism.
 *
 * Rate limiting: the free `Basic` plan caps usage at 8 calls/minute and
 * 800 calls/day. We default the per-minute slider to 7 to keep one slot
 * of headroom in case the user opens two reports back-to-back.
 *
 * Error envelope: Twelve Data returns `200 OK` with `{ status: "error",
 * code, message }` on bad symbols and quota exhaustion. The client
 * recognises the envelope via `TwelveDataErrorSchema` and surfaces it as
 * `Result.err` so callers can rely on the standard ok/err contract.
 *
 * The client owns the *transport*. Schema validation lives in `schemas.ts`
 * and the typed conversion in `transforms.ts`; the provider in `index.ts`
 * wires them together.
 */
import { err, ok, type Result } from "@darkscore/types";
import { RateLimiter } from "../../rate-limiter.js";
import { TwelveDataErrorSchema } from "./schemas.js";

const DEFAULT_BASE_URL = "https://api.twelvedata.com";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 7;
const ONE_MINUTE_MS = 60_000;
const DEFAULT_USER_AGENT =
  "darkscore/0.0.0 (+https://github.com/gabrielo91/ticker-score)";

/**
 * Structured Twelve Data API error. Carries the upstream `code` so callers
 * can branch on plan-gated responses (HTTP 200 + `{status:"error", code:403}`)
 * without string-matching the message.
 */
export class TwelveDataApiError extends Error {
  readonly code: number | null;
  readonly endpoint: string;
  constructor(code: number | null, endpoint: string, message: string) {
    super(message);
    this.name = "TwelveDataApiError";
    this.code = code;
    this.endpoint = endpoint;
  }
}

export interface TwelveDataClientOptions {
  /** API key. Required — the client refuses to issue requests without one. */
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly rateLimitPerMinute?: number;
}

export class TwelveDataClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly limiter: RateLimiter;

  constructor(options: TwelveDataClientOptions) {
    if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
      throw new Error("TwelveDataClient: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new RateLimiter(
      options.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
      ONE_MINUTE_MS,
    );
  }

  /** GET `/quote?symbol=...` — last price + day delta. */
  fetchQuote(symbol: string): Promise<Result<unknown>> {
    return this.getJson(`/quote?symbol=${encodeURIComponent(symbol)}`);
  }

  /** GET `/profile?symbol=...` — company profile (name, sector, etc.). */
  fetchProfile(symbol: string): Promise<Result<unknown>> {
    return this.getJson(`/profile?symbol=${encodeURIComponent(symbol)}`);
  }

  /** GET `/time_series?symbol=...&interval=1day&outputsize=N` — OHLCV. */
  fetchTimeSeries(symbol: string, outputsize: number): Promise<Result<unknown>> {
    const safe = Math.max(1, Math.min(5_000, Math.trunc(outputsize)));
    return this.getJson(
      `/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${safe}`,
    );
  }

  /** GET `/income_statement?symbol=...&period=annual|quarterly` — statements. */
  fetchIncomeStatement(
    symbol: string,
    period: "annual" | "quarterly" = "annual",
  ): Promise<Result<unknown>> {
    return this.getJson(
      `/income_statement?symbol=${encodeURIComponent(symbol)}&period=${period}`,
    );
  }

  /** GET `/balance_sheet?symbol=...&period=annual|quarterly` — statements. */
  fetchBalanceSheet(
    symbol: string,
    period: "annual" | "quarterly" = "annual",
  ): Promise<Result<unknown>> {
    return this.getJson(
      `/balance_sheet?symbol=${encodeURIComponent(symbol)}&period=${period}`,
    );
  }

  /** GET `/statistics?symbol=...` — TTM fundamentals & ratios. */
  fetchStatistics(symbol: string): Promise<Result<unknown>> {
    return this.getJson(`/statistics?symbol=${encodeURIComponent(symbol)}`);
  }

  private async getJson(path: string): Promise<Result<unknown>> {
    await this.limiter.acquire();
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${sep}apikey=${encodeURIComponent(this.apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
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
            `TwelveDataClient: ${response.status} ${response.statusText} on ${path}${body !== "" ? ` — ${body}` : ""}`,
          ),
        );
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch (e) {
        return err(
          new Error(
            `TwelveDataClient: invalid JSON on ${path}: ${(e as Error).message}`,
          ),
        );
      }
      const errorEnvelope = TwelveDataErrorSchema.safeParse(json);
      if (errorEnvelope.success) {
        const code = errorEnvelope.data.code ?? null;
        const message = errorEnvelope.data.message ?? "unknown error";
        return err(
          new TwelveDataApiError(
            code,
            path,
            `TwelveDataClient: API error ${code ?? "?"} on ${path}: ${message}`,
          ),
        );
      }
      return ok(json);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return err(
        new Error(`TwelveDataClient: fetch failed on ${path}: ${reason}`),
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

