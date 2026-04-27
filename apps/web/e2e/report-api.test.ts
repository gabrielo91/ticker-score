/**
 * First end-to-end smoke test for DarkScore. Exercises the running Next.js
 * server through its public HTTP surface — the JSON route at
 * `/api/report/[ticker]`. The route mirrors the SSR page at the same
 * ticker, so a green smoke here proves that the full chain works:
 *
 *   browser → Next.js route → generateReport
 *           → DataAggregator → user-selected provider (no fallback)
 *           → Zod-validated typed data → EditorialStrategy scoring
 *           → ReportData JSON response
 *
 * Important — Constitution C10 forbids browser/Playwright E2E in Phase 0.
 * This file deliberately stays a *server-side smoke test*: no headless
 * browser, no DOM, no new heavy dependencies. It uses the existing Vitest
 * harness and Node's native `fetch`.
 *
 * The suite is **opt-in**: it skips automatically when no dev server is
 * running on `BASE_URL` so CI never hangs. Run it locally with:
 *
 *     pnpm --filter @darkscore/web dev    # in one terminal
 *     pnpm --filter @darkscore/web test   # in another
 *
 * Override the target with `DARKSCORE_E2E_BASE_URL=http://localhost:4000`.
 */
import { describe, expect, it } from "vitest";

const BASE_URL = process.env.DARKSCORE_E2E_BASE_URL ?? "http://localhost:3000";
const PROBE_TIMEOUT_MS = 1_500;
const REQUEST_TIMEOUT_MS = 25_000;

interface ReportSuccess {
  readonly ok: true;
  readonly data: {
    readonly ticker: {
      readonly symbol: string;
      readonly name: string;
      readonly currentPrice: number;
      readonly currency: string;
    };
    readonly riskScore: {
      readonly composite: number;
      readonly rating: string;
    };
  };
}

interface ReportFailure {
  readonly ok: false;
  readonly error: string;
}

type ReportResponse = ReportSuccess | ReportFailure;

async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL, { signal: controller.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Probe at module load so `it.skipIf` sees the resolved value at test
// registration time. `beforeAll` runs *after* registration, which would
// leave every test silently skipped.
const serverReachable = await probe();
if (!serverReachable) {
  console.warn(
    `[e2e] Skipping: no DarkScore server reachable at ${BASE_URL}. ` +
      `Start \`pnpm --filter @darkscore/web dev\` to enable these tests.`,
  );
}

/**
 * Yahoo's anti-bot layer rate-limits the cookieless `getcrumb` bootstrap on
 * fresh egress IPs (a hot spot on GitHub-hosted CI runners). When the
 * runner gets unlucky, every Yahoo-routed request fails with `getcrumb 429`
 * before our code has a chance to do anything useful. The provider dropdown
 * removed the silent Yahoo→Finnhub fallback by design, so the smoke is now
 * exposed to that flake. We treat it as a `skip` (not a `fail`) so an
 * external rate limit can't block PRs — the assertion only runs when Yahoo
 * is reachable.
 */
function isYahooBootstrapRateLimited(error: string): boolean {
  return /getcrumb 429|429 Too Many Requests/u.test(error);
}

async function getReport(
  ticker: string,
  provider?: string,
): Promise<ReportResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const qs = provider !== undefined ? `?provider=${provider}` : "";
    const res = await fetch(
      `${BASE_URL}/api/report/${encodeURIComponent(ticker)}${qs}`,
      { signal: controller.signal },
    );
    const json: unknown = await res.json();
    if (
      typeof json !== "object" ||
      json === null ||
      !("ok" in json) ||
      typeof (json as { ok: unknown }).ok !== "boolean"
    ) {
      throw new Error(`Malformed response from /api/report/${ticker}`);
    }
    return json as ReportResponse;
  } finally {
    clearTimeout(timer);
  }
}

describe("e2e: /api/report/[ticker]", () => {
  it.skipIf(!serverReachable)(
    "returns ok=true with a valid report for AAPL",
    async (ctx) => {
      const r = await getReport("AAPL");
      if (!r.ok) {
        if (isYahooBootstrapRateLimited(r.error)) {
          console.warn(`[e2e] skipping — Yahoo throttled CI: ${r.error}`);
          ctx.skip();
          return;
        }
        throw new Error(`expected ok, got error: ${r.error}`);
      }
      expect(r.data.ticker.symbol).toBe("AAPL");
      expect(r.data.ticker.name.length).toBeGreaterThan(0);
      expect(r.data.ticker.currentPrice).toBeGreaterThan(0);
      expect(Number.isFinite(r.data.ticker.currentPrice)).toBe(true);
      expect(r.data.ticker.currency.length).toBeGreaterThan(0);
      expect(Number.isFinite(r.data.riskScore.composite)).toBe(true);
      expect(r.data.riskScore.composite).toBeGreaterThanOrEqual(0);
      expect(r.data.riskScore.composite).toBeLessThanOrEqual(100);
      expect(r.data.riskScore.rating.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!serverReachable)(
    "returns 400 with a structured error for an invalid ticker shape",
    async () => {
      const res = await fetch(`${BASE_URL}/api/report/!!!`);
      expect(res.status).toBe(400);
      const json = (await res.json()) as ReportResponse;
      expect(json.ok).toBe(false);
      if (!json.ok) {
        expect(json.error.toLowerCase()).toContain("invalid ticker");
      }
    },
  );

  it.skipIf(!serverReachable)(
    "honors ?provider=yahoo and returns AAPL from Yahoo",
    async (ctx) => {
      const r = await getReport("AAPL", "yahoo");
      if (!r.ok) {
        if (isYahooBootstrapRateLimited(r.error)) {
          console.warn(`[e2e] skipping — Yahoo throttled CI: ${r.error}`);
          ctx.skip();
          return;
        }
        throw new Error(`expected ok, got error: ${r.error}`);
      }
      expect(r.data.ticker.symbol).toBe("AAPL");
      expect(r.data.ticker.currentPrice).toBeGreaterThan(0);
    },
  );

  it.skipIf(!serverReachable)(
    "returns 400 for an unknown provider id",
    async () => {
      const res = await fetch(
        `${BASE_URL}/api/report/AAPL?provider=ghost`,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as ReportResponse;
      expect(json.ok).toBe(false);
      if (!json.ok) {
        expect(json.error.toLowerCase()).toContain("unknown data provider");
      }
    },
  );
});

