<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Narrative Enrichment — Living Plan

## Current State

**Status**: Wave 4-5 COMPLETE (PR #36 merged to main as `d9017e1`). The narrative pipeline is live end-to-end and now visible: `apps/web/lib/narrative-merge.ts` overlays `NarrativeData` onto `ReportData` after the W4-4 runtime call, populating catalysts/risks columns, chart annotations (`high→green`, `low→red`, `event→blue`), verdict headline + paragraph + scenario targets, primary card subtitles per category, and the mandatory disclaimer (prompt grounding rule #4). Every surface is gated on `narrativeAvailable`: when the runtime returns `null` or fails, the merge is skipped and the page renders the Spec-001 layout unchanged. C12 component layering is preserved — `Verdict.tsx` accepts optional `headline?` / `disclaimer?` props; all merge logic lives in `lib/`.
**Next action**: Start W4-6 (end-to-end verification): exercise the full pipeline with a real ticker against the OpenAI provider (smoke), verify cache-hit behaviour on the second call (first call provider invocation, second call served from `@darkscore/cache` with no provider request), and verify clean degradation when the provider returns a payload that fails `NarrativeDataSchema` (runtime returns fail-open, page renders Spec-001 layout). W4-3 (Anthropic) remains optional/stretch.
**Handoff instruction**: Read this file, then [`spec.md`](./spec.md), then [`apps/web/CONSTITUTION.md`](../../../apps/web/CONSTITUTION.md) before touching code. Inspect `apps/web/lib/narrative-runtime.ts` (env-driven selection + cache-first execution) and `apps/web/lib/narrative-merge.ts` (UI overlay). Run `pnpm turbo typecheck && pnpm --filter @darkscore/web test` to confirm a clean baseline; W4-6 likely adds a recorded-fixture-driven e2e test alongside `apps/web/e2e/report-api.test.ts`.
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
| W4-6 | End-to-end smoke + cache-hit verification + schema-violation degradation test | ⏳ Next |

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

---

## Open Questions

- Cache TTL: starting at 24h. Revisit if stale-narrative-vs-fresh-financials drift becomes visible.
- Should W4-3 (Anthropic) ship before W4-4, or after the OpenAI path is end-to-end? Currently planned as optional / parallel.

---

## Constitutional Notes

This spec touches one new package and amends one existing one (`types`). The L2 diagram in `c4-diagrams.md` adds one container node:

```
@darkscore/narrative  →  @darkscore/types
                     →  @darkscore/cache
apps/web             →  @darkscore/narrative   (new edge)
```

The L2 diagram update lands with W4-4 (when the new edge is actually exercised), per C11. As of PR #34 the edge is live in `apps/web/lib/narrative-runtime.ts` → `@darkscore/narrative` and is enforced by `scripts/check-boundaries.ts`.

