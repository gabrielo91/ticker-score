import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type DatabaseClient = ReturnType<typeof createDb>;

export interface CreateDbOptions {
  /** Maximum pool size. Defaults to 10. */
  max?: number;
  /** Idle timeout in seconds. Defaults to 20. */
  idleTimeout?: number;
}

/**
 * Create a Drizzle client bound to the full schema.
 *
 * Callers own the lifecycle: call `client.$client.end()` on shutdown.
 */
export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  const sql = postgres(connectionString, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeout ?? 20,
  });
  return drizzle(sql, { schema });
}

export { schema };

