/**
 * Process-wide singleton for the Yahoo HTTP client. The same client (and
 * therefore the same `SessionStore`) must be shared across every report
 * request to avoid re-running the cookie/crumb bootstrap on each page load
 * — `getcrumb` is aggressively rate-limited per-IP, so per-request clients
 * trip 429s within a handful of clicks.
 *
 * Strategy:
 *   - In production with `REDIS_URL` set: a `CachedSessionStore` shares the
 *     bootstrap across all Next.js workers via the existing `CacheService`.
 *   - Otherwise: an `InMemorySessionStore`, which still survives across
 *     requests within the same Node process.
 *
 * `globalThis` cache prevents Next's dev-mode Hot Module Replacement from
 * silently spawning a fresh client (and a fresh bootstrap) on every save.
 *
 * Server-only — this module imports `@darkscore/cache`, which pulls in the
 * Redis client. It must never be referenced from a client component.
 */
import {
  CacheService,
  createRedisClient,
  type CacheBackend,
  type RedisClient,
} from "@darkscore/cache";
import {
  CachedSessionStore,
  InMemorySessionStore,
  YahooClient,
  type SessionStore,
} from "@darkscore/data-providers";

class NullCacheBackend implements CacheBackend {
  async get(): Promise<string | null> {
    return null;
  }
  async set(): Promise<"OK" | null> {
    return "OK";
  }
  async del(): Promise<number> {
    return 0;
  }
  async scan(): Promise<[string, string[]]> {
    return ["0", []];
  }
}

interface YahooRuntime {
  readonly cache: CacheService;
  readonly redis: RedisClient | null;
  readonly sessionStore: SessionStore;
  readonly client: YahooClient;
}

const GLOBAL_KEY = "__darkscoreYahooRuntime";
type GlobalWithRuntime = typeof globalThis & {
  [GLOBAL_KEY]?: YahooRuntime;
};

function buildRuntime(): YahooRuntime {
  const url = process.env.REDIS_URL;
  let cache: CacheService;
  let redis: RedisClient | null = null;
  if (typeof url === "string" && url.length > 0) {
    const created = createRedisClient({ url });
    if (created.ok) {
      redis = created.data;
      cache = new CacheService(created.data);
    } else {
      cache = new CacheService(new NullCacheBackend());
    }
  } else {
    cache = new CacheService(new NullCacheBackend());
  }
  const sessionStore: SessionStore =
    redis !== null ? new CachedSessionStore(cache) : new InMemorySessionStore();
  const client = new YahooClient({ sessionStore });
  return { cache, redis, sessionStore, client };
}

export function getYahooRuntime(): YahooRuntime {
  const g = globalThis as GlobalWithRuntime;
  const cached = g[GLOBAL_KEY];
  if (cached !== undefined) return cached;
  const runtime = buildRuntime();
  g[GLOBAL_KEY] = runtime;
  return runtime;
}

