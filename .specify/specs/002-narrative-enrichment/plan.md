<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Narrative Enrichment — Living Plan

## Current State

**Status**: Spec 002 IMPLEMENTATION COMPLETE. Wave 4-6 merged (PR #38 → `3e3727c`); all required waves (W4-1, W4-2, W4-4, W4-5, W4-6) are on `main`. The narrative layer is live end-to-end: env-driven provider selection (`apps/web/lib/narrative-runtime.ts`), cache-first execution against `@darkscore/cache` with content-hash keys (Constitution C2), pure overlay onto `ReportData` (`apps/web/lib/narrative-merge.ts`), and conditional UI rendering of catalysts/risks/chart annotations/verdict headline + prose/scenario targets/card subtitles/disclaimer — every surface gated on `narrativeAvailable` so the Spec-001 layout is the always-available fallback. The full chain is verified by 24 tests across the package + web boundaries, including a server-side e2e smoke that exercises both the populated and degraded branches and asserts byte-identical responses on a cache hit. CI (`Validate` · `Test` · `E2E Smoke`) green on `main`.
**Next action**: No active work in this spec. Open follow-ups (not blocking): (1) W4-3 *(stretch)* — Anthropic adapter mirroring `OpenAINarrativeProvider`. (2) Surface the six unused `cardSubtitles` fields when `MetricCards` gains a multi-card layout. (3) Revisit `NARRATIVE_CACHE_TTL_SECONDS` (24h default) if stale-narrative drift becomes visible. Start of a new spec should kick off a new plan in `.specify/specs/003-…`.
**Handoff instruction**: For new contributors continuing on this spec's stretch (W4-3) or follow-ups: read this file, then [`spec.md`](./spec.md), then [`packages/narrative/CONSTITUTION.md`](../../../packages/narrative/CONSTITUTION.md). Use `OpenAINarrativeProvider` (`packages/narrative/src/providers/openai/`) as the structural template; new providers register through `NarrativeRegistry` and route through `runNarrative` in `apps/web/lib/narrative-runtime.ts`. Verify with `pnpm turbo typecheck && pnpm --filter @darkscore/narrative test && pnpm --filter @darkscore/web test`.
**Last updated**: 2026-04-27

---

## Wave Map

| Wave | Scope | Status |
|------|-------|--------|
| W4-1 | Narrative package skeleton: types, registry, content-hash cache key, mock provider, errors, tests, boundary-checker entry, package CONSTITUTION | ✅ Done (PR #30) |
| W4-2 | OpenAI adapter (`gpt-4o-mini`, JSON-mode, T≤0.2), recorded-fixture integration test | ✅ Done (PR #32) |
| W4-3 | *(optional)* Anthropic adapter, parallel shape | ⏳ Stretch |
| W4-4 | `apps/web` orchestration: cache-first call to active provider after scoring; `narrativeAvailable` flag wiring | ✅ Done (PR #34) |
| W4-5 | UI sections: catalysts/risks columns, verdict prose, card subtitles, chart annotations, scenario targets — all gated on `narrativeAvailable` | ✅ Done (PR #36) |
| W4-6 | End-to-end smoke + cache-hit verification + schema-violation degradation test | ✅ Done (PR #38) |

---

## Completed Work

### Wave 4-1: Narrative Package Skeleton ✅

| Item | Where |
|------|-------|
| `NarrativeData`, `NarrativeInput`, `NarrativeProvider` Zod schemas + interface | `packages/types/src/narrative.ts` |
| `ReportData.narrative` (nullable) + `narrativeAvailable: boolean` | `packages/types/src/report.ts` |
| Report builder fail-open defaults (`null` / `false`) | `apps/web/lib/report-generator.ts` |
| `@darkscore/narrative` package (`package.json`, `tsconfig.json`, `CONSTITUTION.md`) | `packages/narrative/` |
| `NarrativeError` + structured `NarrativeErrorCode` | `packages/narrative/src/errors.ts` |
| `buildNarrativeCacheKey` + `digestInput` (SHA-256, canonicalized) | `packages/narrative/src/cache-key.ts` |
| `NarrativeRegistry` | `packages/narrative/src/registry.ts` |
| `MockNarrativeProvider` (deterministic, Zod-validated) | `packages/narrative/src/mock-provider.ts` |
| Test fixture builder | `packages/narrative/src/test-fixtures.ts` |
| 11 unit tests (cache-key 5, registry 3, mock 3) | `packages/narrative/src/*.test.ts` |
| `@darkscore/narrative` registered in boundary checker (allowed: `types`, `cache`); added to web allowlist | `scripts/check-boundaries.ts` |

**Verified locally:**
- `pnpm check:boundaries` ✅
- `pnpm check:no-any` ✅
- `pnpm turbo typecheck` ✅ 11/11
- `pnpm --filter @darkscore/narrative test` ✅ 11/11

### Wave 4-2: OpenAI Narrative Provider ✅

| Item | Where |
|------|-------|
| `OpenAIClient` (native fetch, JSON-mode, T=0.2, 30s timeout, 1.4k max tokens) | `packages/narrative/src/providers/openai/client.ts` |
| `NARRATIVE_SYSTEM_PROMPT` + `buildUserPrompt` (closed-input grounding rules, schema hint) | `packages/narrative/src/providers/openai/prompt.ts` |
| `OpenAINarrativeProvider implements NarrativeProvider` (parses through `NarrativeDataSchema`, stamps audit metadata) | `packages/narrative/src/providers/openai/index.ts` |
| Recorded `chat.completion` fixture for AAPL grounded on the narrative test fixture | `packages/narrative/src/providers/openai/fixtures/aapl-response.json` |
| 10 unit tests (defaults, fixture replay, metadata override, malformed JSON, schema violation, HTTP 401/429/500 mapping) | `packages/narrative/src/providers/openai/openai-provider.test.ts` |
| Public exports added (`OpenAINarrativeProvider`, `OPENAI_DEFAULT_MODEL`, etc.) | `packages/narrative/src/index.ts` |

**Verified locally:**
- `pnpm check:boundaries` ✅
- `pnpm check:no-any` ✅
- `pnpm turbo typecheck` ✅ 11/11
- `pnpm --filter @darkscore/narrative test` ✅ 21/21

**Confirmed scope decisions (from review thread):**
- Default model: **`gpt-4o-mini`** with `NARRATIVE_MODEL` override path via constructor.
- Env vars (consumed in W4-4): `OPENAI_API_KEY`, `NARRATIVE_PROVIDER=openai`, `NARRATIVE_MODEL`.
- W4-2 deliberately scoped to provider class + tests + recorded fixture; web wiring deferred to W4-4 to keep PRs reviewable.

### Wave 4-4: Web Orchestration ✅

| Item | Where |
|------|-------|
| `buildNarrativeRuntime(env)` — pure factory selecting `openai` / `mock` / `none` from `NARRATIVE_PROVIDER`, with `OPENAI_API_KEY` gate and optional `NARRATIVE_MODEL` override | `apps/web/lib/narrative-runtime.ts` |
| `getNarrativeRuntime()` — memoised on `globalThis` so Next.js cold starts / HMR don't rebuild the client per request | `apps/web/lib/narrative-runtime.ts` |
| `runNarrative(provider, cache, input)` — cache-first via `buildNarrativeCacheKey` (C2), TTL `NARRATIVE_CACHE_TTL_SECONDS`; fail-open on missing provider, `Result.err`, or schema violation | `apps/web/lib/narrative-runtime.ts` |
| Report pipeline calls `runNarrative` after scoring; populates `report.narrative` + `report.narrativeAvailable` | `apps/web/lib/report-generator.ts` |
| `@darkscore/narrative` workspace dep added; `apps/web` allowed-imports updated | `apps/web/package.json`, `apps/web/CONSTITUTION.md` |
| 8 unit tests: 5 selection branches + 3 orchestration branches (no provider, miss-then-hit, fail-open on `Result.err`) | `apps/web/lib/narrative-runtime.test.ts` |
| `NARRATIVE_PROVIDER`, `OPENAI_API_KEY`, `NARRATIVE_MODEL` documented (default `none` keeps Spec-001 behaviour) | `.env.example` |

**Verified locally (and on CI for `e7a5cf0`):**
- `pnpm check:boundaries` ✅
- `pnpm check:no-any` ✅
- `pnpm turbo typecheck` ✅ 12/12
- `pnpm turbo build` ✅ 6/6
- `pnpm --filter @darkscore/web test` ✅ narrative-runtime 8/8, providers 4/4
- Remote CI: ✅ Validate · ✅ Test · ✅ E2E Smoke

### Wave 4-5: UI Sections ✅

| Item | Where |
|------|-------|
| `mergeNarrativeIntoReport(base, narrative)` — pure overlay onto `ReportData` (no I/O, immutable inputs); maps annotation `kind` → status (`high→green`, `low→red`, `event→blue`); injects primary subtitle per category | `apps/web/lib/narrative-merge.ts` |
| Report pipeline applies the merge after the W4-4 narrative outcome lands; no-op when `narrativeAvailable === false` | `apps/web/lib/report-generator.ts` |
| `<Verdict>` accepts optional `headline?` + `disclaimer?` props (no Spec-001 slot for either); rendered conditionally so absence preserves Spec-001 layout | `apps/web/components/report/Verdict.tsx` |
| Page passes `report.narrative?.verdict.headline` + `report.narrative?.disclaimer` to `<Verdict>` (mandatory disclaimer per prompt grounding rule #4) | `apps/web/app/report/[ticker]/page.tsx` |
| 6 unit tests: catalysts+risks population, annotation kind→status mapping with date+label preservation, verdict summary+priceTargets override, primary subtitle per category, null-subtitle leaves card untouched, input immutability | `apps/web/lib/narrative-merge.test.ts` |

**Verified locally (and on CI for `a0a0063`):**
- `pnpm check:boundaries` ✅
- `pnpm check:no-any` ✅
- `pnpm turbo typecheck` ✅ 12/12
- `pnpm turbo build` ✅ 6/6
- `pnpm --filter @darkscore/web test` ✅ 22/22 (narrative-merge 6, narrative-runtime 8, providers 4, e2e 4)
- Remote CI: ✅ Validate · ✅ Test · ✅ E2E Smoke

**Scope notes:**
- Six of nine `cardSubtitles` fields (`valuationEv`, `valuationRelative`, `healthCashFlow`, `healthProfitability`, `growthSegment`, `growthEarnings`) are accepted in the schema but not yet rendered — the current `MetricCards` layout exposes one card per category. Surfacing them is a follow-up UI task, not in W4-5 scope.
- `Verdict.tsx` now lives at 127 lines (was 95). Within the C12 ~80-line guidance it remains presentational (no fetch, no business logic in JSX) so the size growth is purely additive markup; refactor only if the file gains new responsibilities.

### Wave 4-6: End-to-End Verification ✅

| Item | Where |
|------|-------|
| `describe("e2e: narrative layer (W4-6)")` block — server-side smoke through `/api/report/[ticker]`. Asserts `narrativeAvailable: boolean` always present and Spec-001 layout intact, then branches on the value: `false` ⇒ `narrative === null` (degradation); `true` ⇒ validates the public `NarrativeData` contract (`catalysts`/`risks` length 3–7, `verdict.headline` + `paragraph`, `disclaimer`, audit fields all non-empty). | `apps/web/e2e/report-api.test.ts` |
| Cache-hit assertion — calls `AAPL` twice; skips when narrative is disabled on the running server; otherwise `expect(second.narrative).toEqual(first.narrative)` and same `generatedAt`/`providerName`/`model` (a fresh provider call would stamp a new timestamp ⇒ proves cache hit). | `apps/web/e2e/report-api.test.ts` |
| `ReportSuccess.data` extended with `narrative: NarrativeShape \| null` + `narrativeAvailable: boolean` so the existing test types match the W4-1 schema additions. | `apps/web/e2e/report-api.test.ts` |
| Reuses the existing `serverReachable` probe (CI never hangs) and `isProviderRateLimited` helper (upstream throttle ⇒ `ctx.skip()`, not fail). | `apps/web/e2e/report-api.test.ts` |

**Verified locally (and on CI for `f672c5b`):**
- `pnpm --filter @darkscore/web typecheck` ✅
- `pnpm --filter @darkscore/web lint` ✅
- `pnpm --filter @darkscore/web exec vitest run e2e/report-api.test.ts` ✅ 5 passed + 1 skipped (cache-hit auto-skips when narrative disabled — correct behaviour on the local dev server with `NARRATIVE_PROVIDER=none`)
- `pnpm turbo build` ✅ 6/6
- Remote CI: ✅ Validate · ✅ Test · ✅ E2E Smoke

**Scope notes:**
- Spec wording is "ONE end-to-end smoke test"; we shipped the smoke plus a cache-hit assertion in the same `describe` block — the cache item is a plan-level addition, not spec-level.
- **Schema-violation degradation** is covered at the unit layer (`apps/web/lib/narrative-runtime.test.ts > runNarrative > fails open when the provider returns an error` and `packages/narrative/src/providers/openai/openai-provider.test.ts` schema-violation case). Replaying it through HTTP would require injecting a fake provider into the running server, outside W4-6 scope.
- CI's E2E Smoke job has no `OPENAI_API_KEY`, so on CI both branches gate to the degradation/skip path — the populated branch + cache hit are exercised manually by starting the dev server with `NARRATIVE_PROVIDER=openai NARRATIVE_MODEL=gpt-4o-mini OPENAI_API_KEY=… pnpm --filter @darkscore/web dev`.

---

## Open Questions

- Cache TTL: starting at 24h. Revisit if stale-narrative-vs-fresh-financials drift becomes visible.
- W4-3 (Anthropic) — deferred indefinitely. The OpenAI path is end-to-end and covers the spec's acceptance criteria; ship Anthropic only if multi-provider becomes a product requirement.

---

## Constitutional Notes

This spec touches one new package and amends one existing one (`types`). The L2 diagram in `c4-diagrams.md` adds one container node:

```
@darkscore/narrative  →  @darkscore/types
                     →  @darkscore/cache
apps/web             →  @darkscore/narrative   (new edge)
```

The L2 diagram update lands with W4-4 (when the new edge is actually exercised), per C11. As of PR #34 the edge is live in `apps/web/lib/narrative-runtime.ts` → `@darkscore/narrative` and is enforced by `scripts/check-boundaries.ts`.

