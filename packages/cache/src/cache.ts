/**
 * `CacheService` — typed get / set / invalidate over a Redis-shaped backend.
 *
 * Constraints (Constitution C2 + C5 + cache CONSTITUTION):
 * - Default TTL is 2 hours (7200s); callers may override per write.
 * - Values are stored as JSON strings; reads JSON-parse them.
 * - All public methods return `Result` — never throw across the boundary.
 * - Callers may pass an optional `validator` (e.g. `ZodSchema.parse`) for
 *   structural verification. The package itself does not depend on Zod so
 *   that it stays infrastructure-only and free of business types.
 */
import { err, ok, type Result } from "@darkscore/types";
import type { CacheBackend } from "./client.js";

/** Default TTL for cache entries (2 hours, per Constitution C2). */
export const DEFAULT_TTL_SECONDS = 7200;

/**
 * A function that turns an `unknown` value into a `T`, throwing on failure.
 * `ZodSchema.parse` matches this shape without us depending on Zod.
 */
export type CacheValidator<T> = (value: unknown) => T;

export interface CacheServiceOptions {
  readonly defaultTtlSeconds?: number;
}

export class CacheService {
  private readonly backend: CacheBackend;
  private readonly defaultTtlSeconds: number;

  constructor(backend: CacheBackend, options: CacheServiceOptions = {}) {
    this.backend = backend;
    this.defaultTtlSeconds =
      options.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  /**
   * Look up a key. Returns `ok(null)` for cache misses, `ok(value)` for
   * hits, and `err` for transport / parse / validation failures.
   */
  async get<T>(
    key: string,
    validator?: CacheValidator<T>,
  ): Promise<Result<T | null, Error>> {
    let raw: string | null;
    try {
      raw = await this.backend.get(key);
    } catch (e) {
      return err(toError(e, `cache.get("${key}")`));
    }
    if (raw === null) return ok(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return err(
        new Error(
          `cache.get("${key}"): stored value is not valid JSON: ${(e as Error).message}`,
        ),
      );
    }

    if (validator !== undefined) {
      try {
        return ok(validator(parsed));
      } catch (e) {
        return err(
          new Error(
            `cache.get("${key}"): validator rejected stored value: ${(e as Error).message}`,
          ),
        );
      }
    }
    // Caller is responsible for the type when no validator is supplied.
    return ok(parsed as T);
  }

  /**
   * Store a value with a TTL. `ttlSeconds` overrides the service default.
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<Result<void, Error>> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    if (!Number.isFinite(ttl) || ttl <= 0) {
      return err(
        new Error(
          `cache.set("${key}"): ttlSeconds must be a positive finite number, got ${ttl}`,
        ),
      );
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (e) {
      return err(toError(e, `cache.set("${key}") JSON.stringify`));
    }
    try {
      await this.backend.set(key, serialized, "EX", ttl);
      return ok(undefined);
    } catch (e) {
      return err(toError(e, `cache.set("${key}")`));
    }
  }

  /** Delete one key. Resolves to the number of keys actually removed (0 or 1). */
  async invalidate(key: string): Promise<Result<number, Error>> {
    try {
      const removed = await this.backend.del(key);
      return ok(removed);
    } catch (e) {
      return err(toError(e, `cache.invalidate("${key}")`));
    }
  }

  /**
   * Delete every key matching a glob pattern via SCAN+DEL (avoids the
   * blocking `KEYS` command). Resolves to the total number of keys removed.
   */
  async invalidatePattern(
    pattern: string,
    scanCount: number = 100,
  ): Promise<Result<number, Error>> {
    try {
      let total = 0;
      let cursor = "0";
      do {
        const [next, batch] = await this.backend.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          scanCount,
        );
        cursor = next;
        if (batch.length > 0) {
          total += await this.backend.del(...batch);
        }
      } while (cursor !== "0");
      return ok(total);
    } catch (e) {
      return err(toError(e, `cache.invalidatePattern("${pattern}")`));
    }
  }
}

function toError(e: unknown, context: string): Error {
  if (e instanceof Error) return new Error(`${context}: ${e.message}`);
  return new Error(`${context}: ${String(e)}`);
}

