/**
 * Yahoo Finance HTTP client. Native `fetch` only (Constitution: no axios,
 * no got, no SDK). Returns `Result` from every public method so failures
 * never leak as thrown exceptions across the package boundary.
 *
 * Rate limiting: a sliding-window limiter caps outbound requests at 5 per
 * 1000ms (Constitution + task brief). When the window is full, requests
 * await the next free slot rather than rejecting — Yahoo's free endpoints
 * tolerate small bursts but penalize sustained overuse.
 *
 * The client owns the *transport*. Schema validation lives in
 * `schemas.ts` and the typed shape conversion in `transforms.ts`; the
 * provider in `index.ts` wires them together.
 */
import { err, ok, type Result } from "@darkscore/types";

const DEFAULT_BASE_URL = "https://query1.finance.yahoo.com";
const DEFAULT_USER_AGENT = "darkscore/0.0 (+https://darkscore.local)";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RATE_LIMIT_PER_SECOND = 5;
const RATE_LIMIT_WINDOW_MS = 1_000;

export interface YahooClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly rateLimitPerSecond?: number;
}

/** Sliding-window rate limiter. Internal — exported only for tests. */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly limit: number;
  private readonly hits: number[] = [];

  constructor(limit: number, windowMs: number = RATE_LIMIT_WINDOW_MS) {
    if (limit <= 0 || !Number.isFinite(limit)) {
      throw new RangeError(`RateLimiter: limit must be > 0, got ${limit}`);
    }
    this.limit = Math.trunc(limit);
    this.windowMs = windowMs;
  }

  async acquire(now: () => number = Date.now): Promise<void> {
    while (true) {
      const t = now();
      while (this.hits.length > 0 && (this.hits[0] ?? 0) <= t - this.windowMs) {
        this.hits.shift();
      }
      if (this.hits.length < this.limit) {
        this.hits.push(t);
        return;
      }
      const oldest = this.hits[0] ?? t;
      const wait = Math.max(0, oldest + this.windowMs - t);
      await new Promise<void>((resolve) => setTimeout(resolve, wait + 1));
    }
  }
}

export class YahooClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly limiter: RateLimiter;

  constructor(options: YahooClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new RateLimiter(
      options.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT_PER_SECOND,
    );
  }

  /**
   * GET `/v10/finance/quoteSummary/{symbol}?modules=...` and return the
   * raw JSON body (still `unknown`). Callers MUST validate it through
   * `QuoteSummaryResponseSchema` before reading any field.
   */
  fetchQuoteSummary(
    symbol: string,
    modules: ReadonlyArray<string>,
  ): Promise<Result<unknown>> {
    const path = `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`;
    const search = new URLSearchParams({ modules: modules.join(",") });
    return this.getJson(`${path}?${search.toString()}`);
  }

  /**
   * GET `/v8/finance/chart/{symbol}?range=...&interval=...` and return
   * the raw JSON body. Callers MUST validate via `ChartResponseSchema`.
   */
  fetchChart(
    symbol: string,
    range: string,
    interval: string,
  ): Promise<Result<unknown>> {
    const path = `/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const search = new URLSearchParams({ range, interval });
    return this.getJson(`${path}?${search.toString()}`);
  }

  private async getJson(path: string): Promise<Result<unknown>> {
    await this.limiter.acquire();
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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
        return err(
          new Error(
            `YahooClient: ${response.status} ${response.statusText} on ${path}`,
          ),
        );
      }
      const body: unknown = await response.json();
      return ok(body);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      return err(new Error(`YahooClient: request to ${path} failed: ${cause}`));
    } finally {
      clearTimeout(timer);
    }
  }
}

