import { defineConfig } from "vitest/config";

/**
 * Vitest config for `@darkscore/web`. We only run end-to-end smoke tests
 * here — unit tests live next to the units in their respective packages
 * (per Constitution C10). The smoke tests under `e2e/` exercise the
 * running Next.js dev server through its public HTTP interface.
 *
 * Default Node test environment (no jsdom) keeps the harness lightweight
 * and matches the server-side nature of the assertions.
 */
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 10_000,
    pool: "forks",
  },
});

