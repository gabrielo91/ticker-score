import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The single source of truth for env in this monorepo is the root `.env`
// (alongside `.env.example`). Next.js only auto-loads env files from the
// app directory, which would silently drop FINNHUB_API_KEY, REDIS_URL, and
// DATABASE_URL on every dev start. We hydrate `process.env` from the root
// `.env` here so contributors don't need a per-app symlink. Existing values
// (CI secrets, shell exports) take precedence — we never overwrite.
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, "../../.env");
if (existsSync(rootEnvPath)) {
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;

