/**
 * @darkscore/cache — public surface. Named exports only (per package
 * CONSTITUTION). Importers should depend on this entry point so the boundary
 * checker can verify cross-package usage.
 */
export const PACKAGE_NAME = "@darkscore/cache";

export {
  buildCacheKey,
  bucketTimestamp,
  ONE_HOUR_MS,
  type CacheKeyParts,
} from "./keys.js";

export {
  createRedisClient,
  disconnectRedisClient,
  type CacheBackend,
  type RedisClient,
  type RedisConnectionConfig,
} from "./client.js";

export {
  CacheService,
  DEFAULT_TTL_SECONDS,
  type CacheServiceOptions,
  type CacheValidator,
} from "./cache.js";

