/**
 * Process-wide cache runtime for the web app. Builds a `CacheService`
 * backed by Redis when `REDIS_URL` is configured, or a no-op backend
 * otherwise so local dev / preview deploys work without infrastructure.
 *
 * The runtime is memoised on `globalThis` so Next.js dev-mode HMR (and
 * cold-started serverless workers) don't recreate the Redis client on
 * every request. Server-only — this module imports `@darkscore/cache`,
 * which pulls in the `ioredis` client; it must never be referenced from
 * a `"use client"` component.
 *
 * Twelve Data and Finnhub both authenticate with a stateless API key, so
 * there is nothing provider-specific to bootstrap; the cache is the only
 * shared resource the report flow needs.
 */
import {
  CacheService,
  createRedisClient,
  type CacheBackend,
  type RedisClient,
} from "@darkscore/cache";

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

interface CacheRuntime {
  readonly cache: CacheService;
  readonly redis: RedisClient | null;
}

const GLOBAL_KEY = "__darkscoreCacheRuntime";
type GlobalWithRuntime = typeof globalThis & {
  [GLOBAL_KEY]?: CacheRuntime;
};

function buildRuntime(): CacheRuntime {
  const url = process.env.REDIS_URL;
  if (typeof url === "string" && url.length > 0) {
    const created = createRedisClient({ url });
    if (created.ok) {
      return { cache: new CacheService(created.data), redis: created.data };
    }
  }
  return { cache: new CacheService(new NullCacheBackend()), redis: null };
}

export function getCacheRuntime(): CacheRuntime {
  const g = globalThis as GlobalWithRuntime;
  const cached = g[GLOBAL_KEY];
  if (cached !== undefined) return cached;
  const runtime = buildRuntime();
  g[GLOBAL_KEY] = runtime;
  return runtime;
}

