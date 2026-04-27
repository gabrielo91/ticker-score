/**
 * Yahoo session storage. The `{ cookie, crumb }` pair must always travel
 * together — Yahoo issues each crumb against a specific cookie, and reusing
 * one without the other yields 401/429. Keeping them in a pluggable store
 * lets the web app share a single bootstrap across processes (Redis) or
 * across page loads in dev (in-memory) instead of re-bootstrapping per
 * request and tripping `getcrumb`'s aggressive per-IP throttle.
 *
 * The default `InMemorySessionStore` preserves the previous behaviour so
 * existing tests keep their assertions. `CachedSessionStore` plugs into
 * `@darkscore/cache` — when the orchestrator already has a `CacheService`
 * (i.e. `REDIS_URL` is set) it gets free cross-process session sharing
 * with the canonical cache-key format, satisfying C2.
 */
import { isOk, type Result } from "@darkscore/types";
import { buildCacheKey, type CacheService } from "@darkscore/cache";

export interface YahooSession {
  readonly cookie: string;
  readonly crumb: string;
}

export interface SessionStore {
  /** Resolve to the cached session, or `null` on miss. */
  get(): Promise<YahooSession | null>;
  /** Persist a freshly-bootstrapped session. */
  set(session: YahooSession): Promise<void>;
  /** Drop the cached session (e.g. after a 401). */
  del(): Promise<void>;
}

/**
 * Lifetime of a cached session. Kept short because the underlying Yahoo
 * cookies expire in ~5–10 minutes; refreshing inside that window costs
 * one bootstrap pair (`fc.yahoo.com` + `getcrumb`) per process per ~5 min,
 * which is well below `getcrumb`'s observed rate-limit threshold.
 */
export const DEFAULT_SESSION_TTL_SECONDS = 300;

/**
 * Process-local store. Holds the session in-memory with a deadline so a
 * stale entry is dropped on the next read instead of being served past
 * Yahoo's cookie expiry.
 */
export class InMemorySessionStore implements SessionStore {
  private current: { readonly session: YahooSession; readonly expiresAt: number } | null =
    null;
  private readonly ttlSeconds: number;
  private readonly now: () => number;

  constructor(options: { ttlSeconds?: number; now?: () => number } = {}) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    this.now = options.now ?? Date.now;
  }

  async get(): Promise<YahooSession | null> {
    if (this.current === null) return null;
    if (this.now() >= this.current.expiresAt) {
      this.current = null;
      return null;
    }
    return this.current.session;
  }

  async set(session: YahooSession): Promise<void> {
    this.current = {
      session,
      expiresAt: this.now() + this.ttlSeconds * 1000,
    };
  }

  async del(): Promise<void> {
    this.current = null;
  }
}

/**
 * Shape of the JSON blob written to the cache. Only structural fields —
 * any unknown extra is treated as a miss to keep forward-compatibility
 * cheap if we extend `YahooSession` later.
 */
function isSession(value: unknown): value is YahooSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.cookie === "string" && typeof v.crumb === "string";
}

/**
 * Redis-backed store. Delegates all I/O to `CacheService` so retry,
 * serialization and TTL semantics stay consistent with the rest of the
 * platform (C2). Read failures degrade to "miss" rather than propagating
 * — a transient cache hiccup must not block a fresh bootstrap.
 */
export class CachedSessionStore implements SessionStore {
  private static readonly DATA_TYPE = "session";
  private static readonly TICKER_PLACEHOLDER = "_session_";

  private readonly cache: CacheService;
  private readonly ttlSeconds: number;
  private readonly memo: InMemorySessionStore;

  constructor(cache: CacheService, options: { ttlSeconds?: number } = {}) {
    this.cache = cache;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    this.memo = new InMemorySessionStore({ ttlSeconds: this.ttlSeconds });
  }

  private key(): string {
    return buildCacheKey({
      provider: "yahoo",
      ticker: CachedSessionStore.TICKER_PLACEHOLDER,
      dataType: CachedSessionStore.DATA_TYPE,
    });
  }

  async get(): Promise<YahooSession | null> {
    const memoHit = await this.memo.get();
    if (memoHit !== null) return memoHit;
    const result: Result<YahooSession | null, Error> = await this.cache.get(
      this.key(),
      (raw) => {
        if (!isSession(raw)) {
          throw new Error("CachedSessionStore: invalid session payload");
        }
        return raw;
      },
    );
    if (!isOk(result)) return null;
    if (result.data === null) return null;
    await this.memo.set(result.data);
    return result.data;
  }

  async set(session: YahooSession): Promise<void> {
    await this.memo.set(session);
    await this.cache.set(this.key(), session, this.ttlSeconds);
  }

  async del(): Promise<void> {
    await this.memo.del();
    await this.cache.invalidate(this.key());
  }
}

