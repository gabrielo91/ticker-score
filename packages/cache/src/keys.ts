/**
 * Cache key builder. Pure, deterministic, no I/O. Produces keys in the
 * canonical format `{provider}:{ticker}:{dataType}:{timestamp_bucket}`
 * required by Constitution C2. The bucket rounds the supplied timestamp down
 * to the start of the hour so cache lookups within the same hour collide
 * (and TTL refreshes naturally on the hour boundary).
 */

export const ONE_HOUR_MS = 60 * 60 * 1000;

export interface CacheKeyParts {
  readonly provider: string;
  readonly ticker: string;
  readonly dataType: string;
  /** Optional; defaults to `Date.now()` when omitted. */
  readonly timestamp?: number;
}

/**
 * Floor a timestamp (ms since epoch) to the start of its bucket.
 * Default bucket is one hour, matching the cache TTL boundary.
 */
export function bucketTimestamp(
  timestampMs: number,
  bucketMs: number = ONE_HOUR_MS,
): number {
  if (!Number.isFinite(timestampMs)) {
    throw new TypeError(`bucketTimestamp: timestampMs must be finite, got ${timestampMs}`);
  }
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new TypeError(`bucketTimestamp: bucketMs must be a positive finite number, got ${bucketMs}`);
  }
  return Math.floor(timestampMs / bucketMs) * bucketMs;
}

/**
 * Build a canonical cache key. The ticker segment is uppercased so that
 * `aapl` and `AAPL` collide on the same bucket.
 */
export function buildCacheKey(parts: CacheKeyParts): string {
  const ts = parts.timestamp ?? Date.now();
  const bucket = bucketTimestamp(ts);
  return `${parts.provider}:${parts.ticker.toUpperCase()}:${parts.dataType}:${bucket}`;
}

