import { defineConfig } from "vitest/config";

/**
 * Vitest config for `@darkscore/web`. Runs:
 *   - end-to-end smoke tests under `e2e/` against the running Next.js dev
 *     server (per Constitution C10),
 *   - colocated unit tests under `lib/` for browser-safe helpers that
 *     duplicate values pinned in shared packages (drift guards).
 *
 * Default Node test environment (no jsdom) keeps the harness lightweight
 * and matches the server-side nature of the assertions.
 */
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts", "lib/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 10_000,
    pool: "forks",
  },
});

