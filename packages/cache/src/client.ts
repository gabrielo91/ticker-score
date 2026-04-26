/**
 * Redis connection factory (Constitution C1 — adapter pattern). Wraps
 * ioredis behind a Result-returning factory so connection-config errors
 * never throw across the package boundary (C5).
 *
 * Connection itself is lazy by default (`lazyConnect: true`): the returned
 * client is constructed without opening a TCP socket. Callers either invoke
 * `client.connect()` explicitly or let the first operation trigger the
 * connection. Operation-level errors surface through the Result returned by
 * `CacheService` methods.
 */
import { Redis, type RedisOptions } from "ioredis";
import { err, ok, type Result } from "@darkscore/types";

/** Public alias so consumers do not have to import ioredis directly. */
export type RedisClient = Redis;

/**
 * Subset of the ioredis `Redis` surface that `CacheService` actually
 * exercises. Defined here so tests can substitute a stub without depending
 * on ioredis' large type surface and so the cache implementation does not
 * leak unused methods into its API contract.
 */
export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    secondsToken: "EX",
    seconds: number,
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: string,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: number,
  ): Promise<[string, string[]]>;
}

export interface RedisConnectionConfig {
  /** Full Redis URL (e.g. `redis://user:pass@host:6379/0`). Wins if set. */
  readonly url?: string;
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly db?: number;
  /** Defaults to `true` so construction does not initiate I/O. */
  readonly lazyConnect?: boolean;
  /** Per-request retry budget; defaults to 3 to bound failure latency. */
  readonly maxRetriesPerRequest?: number;
}

const DEFAULT_PORT = 6379;
const DEFAULT_MAX_RETRIES_PER_REQUEST = 3;

/**
 * Create a Redis client from a config object. Returns Result so callers can
 * surface configuration errors (e.g. neither `url` nor `host` provided)
 * without try/catch at the call site.
 */
export function createRedisClient(
  config: RedisConnectionConfig,
): Result<RedisClient, Error> {
  try {
    const baseOptions: RedisOptions = {
      lazyConnect: config.lazyConnect ?? true,
      maxRetriesPerRequest:
        config.maxRetriesPerRequest ?? DEFAULT_MAX_RETRIES_PER_REQUEST,
    };
    if (config.password !== undefined) baseOptions.password = config.password;
    if (config.db !== undefined) baseOptions.db = config.db;

    let client: Redis;
    if (config.url !== undefined && config.url.length > 0) {
      client = new Redis(config.url, baseOptions);
    } else if (config.host !== undefined && config.host.length > 0) {
      client = new Redis({
        ...baseOptions,
        host: config.host,
        port: config.port ?? DEFAULT_PORT,
      });
    } else {
      return err(
        new Error(
          "createRedisClient: config requires either `url` or `host` to be set",
        ),
      );
    }
    return ok(client);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Gracefully close a Redis client. Tries `quit()` (sends QUIT) first, then
 * forces `disconnect()` if QUIT itself fails.
 */
export async function disconnectRedisClient(
  client: RedisClient,
): Promise<Result<void, Error>> {
  try {
    await client.quit();
    return ok(undefined);
  } catch (e) {
    try {
      client.disconnect();
    } catch {
      // already torn down; fall through to surface the original error
    }
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

