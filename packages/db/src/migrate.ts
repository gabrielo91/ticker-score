/* eslint-disable no-console -- CLI migration script logs to stdout/stderr */
import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("[db:migrate] applying migrations from src/migrations…");
  await migrate(db, { migrationsFolder: "src/migrations" });
  console.log("[db:migrate] done.");

  await migrationClient.end();
}

main().catch((error: unknown) => {
  console.error("[db:migrate] failed:", error);
  process.exit(1);
});

