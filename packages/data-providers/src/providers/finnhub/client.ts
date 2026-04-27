/**
 * Finnhub HTTP client. Native `fetch` only (Constitution: no axios, no got,
 * no SDK). Returns `Result` from every public method so failures never leak
 * as thrown exceptions across the package boundary (C5).
 *
 * Auth: every request carries the API token via the `X-Finnhub-Token`
 * header (Finnhub also accepts `?token=...` but the header keeps tokens
 * out of access logs).
 *
 * Rate limiting: Finnhub's free tier allows 60 calls/minute and 30
 * calls/second per API key. We default to the per-second cap (well under
 * the per-minute one for the call volumes the report flow generates).
 *
 * The client owns the *transport*. Schema validation lives in `schemas.ts`
 * and the typed conversion in `transforms.ts`; the provider in `index.ts`
 * wires them together.
 */
import { err, ok, type Result } from "@darkscore/types";
import { RateLimiter } from "../../rate-limiter.js";

const DEFAULT_BASE_URL = "https://finnhub.io/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RATE_LIMIT_PER_SECOND = 30;
const DEFAULT_USER_AGENT = "darkscore/0.0.0 (+https://github.com/gabrielo91/ticker-score)";

export interface FinnhubClientOptions {
  /** API token. Required — the client refuses to issue requests without one. */
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly rateLimitPerSecond?: number;
}

export class FinnhubClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly limiter: RateLimiter;

  constructor(options: FinnhubClientOptions) {
    if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
      throw new Error("FinnhubClient: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new RateLimiter(
      options.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT_PER_SECOND,
    );
  }

  /** GET `/quote?symbol=...` — last price + day delta. */
  fetchQuote(symbol: string): Promise<Result<unknown>> {
    return this.getJson(`/quote?symbol=${encodeURIComponent(symbol)}`);
  }

  /** GET `/stock/profile2?symbol=...` — company profile (free tier). */
  fetchProfile(symbol: string): Promise<Result<unknown>> {
    return this.getJson(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`);
  }

  /** GET `/stock/metric?symbol=...&metric=all` — fundamentals + 52w range. */
  fetchMetrics(symbol: string): Promise<Result<unknown>> {
    return this.getJson(
      `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
    );
  }

  /**
   * GET `/stock/financials-reported?symbol=...&freq=quarterly` — SEC
   * filings broken out by quarter. The default `freq` is annual; we always
   * request quarterly because the report flow needs both quarterly results
   * and the most-recent TTM figures derived from them.
   */
  fetchFinancialsReported(symbol: string): Promise<Result<unknown>> {
    return this.getJson(
      `/stock/financials-reported?symbol=${encodeURIComponent(symbol)}&freq=quarterly`,
    );
  }

  private async getJson(path: string): Promise<Result<unknown>> {
    await this.limiter.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": this.userAgent,
          "x-finnhub-token": this.apiKey,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await safeReadBody(response);
        return err(
          new Error(
            `FinnhubClient: ${response.status} ${response.statusText} on ${path}${body !== "" ? ` — ${body}` : ""}`,
          ),
        );
      }
      try {
        const json: unknown = await response.json();
        return ok(json);
      } catch (e) {
        return err(
          new Error(
            `FinnhubClient: invalid JSON on ${path}: ${(e as Error).message}`,
          ),
        );
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return err(new Error(`FinnhubClient: fetch failed on ${path}: ${reason}`));
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

