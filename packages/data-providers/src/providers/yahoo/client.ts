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
 * Session / crumb: since 2024 Yahoo's `/v10/finance/quoteSummary` endpoint
 * requires a `crumb` CSRF token plus the session cookies that minted it.
 * The client lazily bootstraps a session on first use:
 *   1. GET `https://finance.yahoo.com/` to seed `A1`/`A1S`/`A3` cookies.
 *   2. GET `/v1/test/getcrumb` carrying those cookies to receive a crumb.
 *   3. Cache `{ cookie, crumb }` for the lifetime of the client; on 401
 *      from `quoteSummary`, invalidate and retry once (crumbs rotate).
 * The chart endpoint (`/v8/finance/chart`) does not require the crumb but
 * benefits from the cookie for anti-bot heuristics.
 *
 * The client owns the *transport*. Schema validation lives in
 * `schemas.ts` and the typed shape conversion in `transforms.ts`; the
 * provider in `index.ts` wires them together.
 */
import { err, ok, type Result } from "@darkscore/types";

const DEFAULT_BASE_URL = "https://query1.finance.yahoo.com";
// `fc.yahoo.com` deliberately returns 404 but always emits the `A3`
// session cookie that `getcrumb` accepts — the public CDN cache on
// `finance.yahoo.com` strips Set-Cookie, so we cannot use it.
const DEFAULT_SESSION_BOOTSTRAP_URL = "https://fc.yahoo.com/";
const DEFAULT_CRUMB_URL =
  "https://query1.finance.yahoo.com/v1/test/getcrumb";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RATE_LIMIT_PER_SECOND = 5;
const RATE_LIMIT_WINDOW_MS = 1_000;

export interface YahooClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly rateLimitPerSecond?: number;
  readonly sessionBootstrapUrl?: string;
  readonly crumbUrl?: string;
}

interface YahooSession {
  readonly cookie: string;
  readonly crumb: string;
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
  private readonly sessionBootstrapUrl: string;
  private readonly crumbUrl: string;
  private session: YahooSession | null = null;
  private sessionInflight: Promise<Result<YahooSession>> | null = null;

  constructor(options: YahooClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new RateLimiter(
      options.rateLimitPerSecond ?? DEFAULT_RATE_LIMIT_PER_SECOND,
    );
    this.sessionBootstrapUrl =
      options.sessionBootstrapUrl ?? DEFAULT_SESSION_BOOTSTRAP_URL;
    this.crumbUrl = options.crumbUrl ?? DEFAULT_CRUMB_URL;
  }

  /**
   * GET `/v10/finance/quoteSummary/{symbol}?modules=...` and return the
   * raw JSON body (still `unknown`). Callers MUST validate it through
   * `QuoteSummaryResponseSchema` before reading any field.
   *
   * Requires a session (cookie + crumb). Bootstraps lazily on first use
   * and retries once on 401 to handle crumb rotation.
   */
  async fetchQuoteSummary(
    symbol: string,
    modules: ReadonlyArray<string>,
  ): Promise<Result<unknown>> {
    return this.fetchAuthenticated((session) => {
      const path = `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`;
      const search = new URLSearchParams({
        modules: modules.join(","),
        crumb: session.crumb,
      });
      return `${path}?${search.toString()}`;
    });
  }

  /**
   * GET `/v8/finance/chart/{symbol}?range=...&interval=...` and return
   * the raw JSON body. Callers MUST validate via `ChartResponseSchema`.
   * The chart endpoint does not require a crumb but the session cookie
   * helps with Yahoo's anti-bot heuristics, so we attach it when present.
   */
  fetchChart(
    symbol: string,
    range: string,
    interval: string,
  ): Promise<Result<unknown>> {
    const path = `/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const search = new URLSearchParams({ range, interval });
    return this.getJson(`${path}?${search.toString()}`, this.session?.cookie);
  }

  /**
   * Run a request that requires a session. Attempts the call; on 401
   * invalidates the cached session and retries exactly once. Other errors
   * propagate unchanged so DataAggregator's retry/fallback logic still
   * sees the underlying status code.
   */
  private async fetchAuthenticated(
    buildPath: (session: YahooSession) => string,
  ): Promise<Result<unknown>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const sessionRes = await this.ensureSession();
      if (!sessionRes.ok) return sessionRes;
      const path = buildPath(sessionRes.data);
      const result = await this.getJson(path, sessionRes.data.cookie);
      if (result.ok) return result;
      if (attempt === 0 && /\b401\b/u.test(result.error.message)) {
        this.session = null;
        continue;
      }
      return result;
    }
    return err(new Error("YahooClient: authenticated request retry exhausted"));
  }

  /**
   * Resolve the cached session, hydrating it on first use. Concurrent
   * callers share the in-flight bootstrap to avoid hammering Yahoo.
   */
  private async ensureSession(): Promise<Result<YahooSession>> {
    if (this.session !== null) return ok(this.session);
    if (this.sessionInflight !== null) return this.sessionInflight;
    this.sessionInflight = this.bootstrapSession().then((res) => {
      this.sessionInflight = null;
      if (res.ok) this.session = res.data;
      return res;
    });
    return this.sessionInflight;
  }

  private async bootstrapSession(): Promise<Result<YahooSession>> {
    const cookieRes = await this.fetchSetCookie(this.sessionBootstrapUrl);
    if (!cookieRes.ok) return cookieRes;
    const cookie = cookieRes.data;
    const crumbRes = await this.fetchCrumb(cookie);
    if (!crumbRes.ok) return crumbRes;
    return ok({ cookie, crumb: crumbRes.data });
  }

  private async fetchSetCookie(url: string): Promise<Result<string>> {
    await this.limiter.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": this.userAgent },
        signal: controller.signal,
      });
      const cookie = collectCookies(response.headers);
      if (cookie.length === 0) {
        return err(
          new Error(
            `YahooClient: bootstrap ${response.status} from ${url} did not set cookies`,
          ),
        );
      }
      return ok(cookie);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      return err(new Error(`YahooClient: bootstrap ${url} failed: ${cause}`));
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchCrumb(cookie: string): Promise<Result<string>> {
    await this.limiter.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.crumbUrl, {
        method: "GET",
        headers: {
          accept: "text/plain",
          cookie,
          "user-agent": this.userAgent,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(
          new Error(
            `YahooClient: getcrumb ${response.status} ${response.statusText}`,
          ),
        );
      }
      const text = (await response.text()).trim();
      if (text.length === 0 || /too many requests/iu.test(text)) {
        return err(new Error(`YahooClient: getcrumb returned "${text}"`));
      }
      return ok(text);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      return err(new Error(`YahooClient: getcrumb failed: ${cause}`));
    } finally {
      clearTimeout(timer);
    }
  }

  private async getJson(
    path: string,
    cookie?: string,
  ): Promise<Result<unknown>> {
    await this.limiter.acquire();
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": this.userAgent,
    };
    if (cookie !== undefined && cookie.length > 0) headers.cookie = cookie;
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
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

/**
 * Read every Set-Cookie header from a response and reduce it to a single
 * `name=value; name=value` string suitable for the `Cookie` request header.
 * Uses `headers.getSetCookie()` when available (Node 18.14+, undici); falls
 * back to a raw header read otherwise. Only the name=value portion is kept;
 * attributes like `Path`, `Domain`, `Max-Age`, `Expires` are stripped.
 */
function collectCookies(headers: Headers): string {
  const reader = (headers as { getSetCookie?: () => string[] }).getSetCookie;
  const raw =
    typeof reader === "function"
      ? reader.call(headers)
      : splitSetCookie(headers.get("set-cookie") ?? "");
  const pairs: string[] = [];
  for (const entry of raw) {
    const semi = entry.indexOf(";");
    const head = semi === -1 ? entry : entry.slice(0, semi);
    const trimmed = head.trim();
    if (trimmed.length > 0) pairs.push(trimmed);
  }
  return pairs.join("; ");
}

function splitSetCookie(combined: string): string[] {
  if (combined.length === 0) return [];
  return combined.split(/,(?=[^;]+=)/u);
}

