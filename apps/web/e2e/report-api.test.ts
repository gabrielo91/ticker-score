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

interface NarrativeShape {
  readonly catalysts: readonly string[];
  readonly risks: readonly string[];
  readonly verdict: { readonly headline: string; readonly paragraph: string };
  readonly disclaimer: string;
  readonly providerName: string;
  readonly model: string;
  readonly generatedAt: string;
}

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
    readonly narrative: NarrativeShape | null;
    readonly narrativeAvailable: boolean;
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
 * Twelve Data's free tier caps requests at 8/min. When the runner is
 * unlucky (or the day's 800-call quota is exhausted), every Twelve-Data
 * routed request fails with a 429-equivalent error. We treat it as a
 * `skip` (not a `fail`) so an external rate limit can't block PRs — the
 * assertion only runs when Twelve Data has quota left.
 */
function isProviderRateLimited(error: string): boolean {
  return /429|rate limit|too many requests|exceeded the maximum/iu.test(error);
}

async function getReport(ticker: string): Promise<ReportResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/api/report/${encodeURIComponent(ticker)}`,
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
        if (isProviderRateLimited(r.error)) {
          console.warn(`[e2e] skipping — provider throttled CI: ${r.error}`);
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
    "ignores any ?provider= query param (W5-1: provider dropdown removed)",
    async (ctx) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${BASE_URL}/api/report/AAPL?provider=ghost`,
          { signal: controller.signal },
        );
        const json = (await res.json()) as ReportResponse;
        if (!json.ok) {
          if (isProviderRateLimited(json.error)) {
            console.warn(`[e2e] skipping — provider throttled CI: ${json.error}`);
            ctx.skip();
            return;
          }
          throw new Error(`expected ok, got error: ${json.error}`);
        }
        expect(res.status).toBe(200);
        expect(json.data.ticker.symbol).toBe("AAPL");
      } finally {
        clearTimeout(timer);
      }
    },
  );
});

/**
 * Spec 002, W4-6 — narrative layer end-to-end smoke.
 *
 * One smoke that proves both branches of the narrative pipeline reach the
 * HTTP surface intact:
 *
 *   - When the dev server is configured for narrative
 *     (`NARRATIVE_PROVIDER=openai` + `OPENAI_API_KEY`), the response carries
 *     a populated `narrative` object that satisfies the `NarrativeData` shape
 *     contract from `@darkscore/types`, and a second call to the same ticker
 *     returns *byte-identical* narrative content (cache hit — no second LLM
 *     call, since a fresh generation would produce a different `generatedAt`).
 *   - When narrative is disabled or the provider failed,
 *     `narrativeAvailable` is `false`, `narrative` is `null`, and the rest of
 *     the report (Spec-001 layout) is intact (clean degradation).
 *
 * Schema-violation degradation is covered at the unit layer in
 * `lib/narrative-runtime.test.ts` (`fails open when the provider returns an
 * error`) — replaying it here would require injecting a fake provider into
 * the running server, which is outside W4-6 scope.
 */
describe("e2e: narrative layer (W4-6)", () => {
  it.skipIf(!serverReachable)(
    "produces a narrative when configured, degrades cleanly when not",
    async (ctx) => {
      const r = await getReport("AAPL");
      if (!r.ok) {
        if (isProviderRateLimited(r.error)) {
          console.warn(`[e2e] skipping — provider throttled CI: ${r.error}`);
          ctx.skip();
          return;
        }
        throw new Error(`expected ok, got error: ${r.error}`);
      }

      // Both branches: structural fields are always present and the rest of
      // the report (Spec-001 surface) is intact regardless of narrative state.
      expect(typeof r.data.narrativeAvailable).toBe("boolean");
      expect(r.data.ticker.currentPrice).toBeGreaterThan(0);
      expect(r.data.riskScore.composite).toBeGreaterThanOrEqual(0);
      expect(r.data.riskScore.composite).toBeLessThanOrEqual(100);

      if (!r.data.narrativeAvailable) {
        // Degradation branch (no key / NARRATIVE_PROVIDER=none / failure).
        expect(r.data.narrative).toBeNull();
        console.warn(
          "[e2e:W4-6] narrative disabled — degradation branch verified. " +
            "Set NARRATIVE_PROVIDER=openai + OPENAI_API_KEY on the dev " +
            "server to exercise the populated branch.",
        );
        return;
      }

      // Populated branch: validate the public NarrativeData shape contract.
      const n = r.data.narrative;
      if (n === null) {
        throw new Error("narrativeAvailable=true but narrative is null");
      }
      expect(n.catalysts.length).toBeGreaterThanOrEqual(3);
      expect(n.catalysts.length).toBeLessThanOrEqual(7);
      expect(n.risks.length).toBeGreaterThanOrEqual(3);
      expect(n.risks.length).toBeLessThanOrEqual(7);
      for (const c of n.catalysts) expect(c.length).toBeGreaterThan(0);
      for (const k of n.risks) expect(k.length).toBeGreaterThan(0);
      expect(n.verdict.headline.length).toBeGreaterThan(0);
      expect(n.verdict.paragraph.length).toBeGreaterThan(0);
      expect(n.disclaimer.length).toBeGreaterThan(0);
      expect(n.providerName.length).toBeGreaterThan(0);
      expect(n.model.length).toBeGreaterThan(0);
      expect(n.generatedAt.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!serverReachable)(
    "returns byte-identical narrative on a second call (cache hit)",
    async (ctx) => {
      const first = await getReport("AAPL");
      if (!first.ok) {
        if (isProviderRateLimited(first.error)) {
          ctx.skip();
          return;
        }
        throw new Error(`expected ok, got error: ${first.error}`);
      }
      if (!first.data.narrativeAvailable || first.data.narrative === null) {
        console.warn(
          "[e2e:W4-6] cache-hit assertion skipped — narrative disabled on " +
            "the running server (no NARRATIVE_PROVIDER + OPENAI_API_KEY).",
        );
        ctx.skip();
        return;
      }

      const second = await getReport("AAPL");
      if (!second.ok || !second.data.narrativeAvailable || second.data.narrative === null) {
        throw new Error("second call lost the narrative — cache miss?");
      }

      // Cache hit ⇒ identical generated artifact (a re-run would stamp a
      // fresh `generatedAt` and likely produce different prose).
      expect(second.data.narrative.generatedAt).toBe(
        first.data.narrative.generatedAt,
      );
      expect(second.data.narrative.providerName).toBe(
        first.data.narrative.providerName,
      );
      expect(second.data.narrative.model).toBe(first.data.narrative.model);
      expect(second.data.narrative).toEqual(first.data.narrative);
    },
  );
});

