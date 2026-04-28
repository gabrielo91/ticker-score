// next.config.mjs hydrates env in the main Next.js process, but in dev mode
// API route handlers run inside separate worker processes that never read the
// config. The instrumentation hook runs once per worker, so we re-hydrate the
// root `.env` here to keep parity with config-phase loading. Existing values
// (CI secrets, shell exports) take precedence — we never overwrite.
//
// `instrumentation.ts` is bundled by Next.js, so `import.meta.url` is not
// reliable. We resolve from `process.cwd()`, which can be either the monorepo
// root (when launched via `pnpm --filter @darkscore/web dev`) or `apps/web`
// (when launched directly). We try both candidate paths to cover both cases.
//
// We only run on the Node.js runtime; Edge has no filesystem. We also use
// Webpack's `__non_webpack_require__` escape hatch so that `fs`/`path` are
// resolved by the real Node loader at runtime instead of being bundled by
// Webpack (which would fail with "UnhandledSchemeError" for `node:` imports
// or "Module not found" for the Edge build).
declare const __non_webpack_require__: NodeRequire;

export function register(): void {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const fs = __non_webpack_require__("fs") as typeof import("fs");
  const path = __non_webpack_require__("path") as typeof import("path");

  const rootEnvPath = path.resolve(process.cwd(), ".env");
  const altEnvPath = path.resolve(process.cwd(), "../../.env");
  const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : altEnvPath;
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
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

