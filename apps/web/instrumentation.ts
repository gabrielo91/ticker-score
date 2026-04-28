import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// next.config.mjs hydrates env in the main Next.js process, but in dev mode
// API route handlers run inside separate worker processes that never read the
// config. The instrumentation hook runs once per worker, so we re-hydrate the
// root `.env` here to keep parity with config-phase loading. Existing values
// (CI secrets, shell exports) take precedence — we never overwrite.
//
// `instrumentation.ts` is bundled by Next.js, so `import.meta.url` is not
// reliable. We resolve from `process.cwd()`, which Next.js sets to the app
// directory (`apps/web`) for both `next dev` and `next start`.
export function register(): void {
  const rootEnvPath = resolve(process.cwd(), "../../.env");
  if (!existsSync(rootEnvPath)) return;
  const text = readFileSync(rootEnvPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/gu, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

