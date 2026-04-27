<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Narrative Enrichment — Living Plan

## Current State

**Status**: Wave 4-4 COMPLETE (PR #34 merged to main as `61b022a`). The `apps/web` report pipeline now consumes `@darkscore/narrative` end-to-end: env-driven selection in `apps/web/lib/narrative-runtime.ts` (`NARRATIVE_PROVIDER` ∈ `openai`/`mock`/`none`), cache-first execution via `buildNarrativeCacheKey` against `@darkscore/cache` (Constitution C2), and fail-open semantics — any provider failure surfaces as `narrativeAvailable: false` and the page renders the Spec-001 layout. With no env vars set the runtime returns `provider: null` and behaviour is identical to pre-Spec-002. The narrative payload reaches `ReportData.narrative` but the UI does not yet render any of its fields.
**Next action**: Start W4-5 (UI sections): consume `report.narrative` in `apps/web/app/report/[ticker]/page.tsx` to render catalysts/risks columns, verdict prose, card subtitles, chart annotations, and scenario targets — every section gated on `report.narrativeAvailable` so the Spec-001 layout remains the fallback. W4-3 (Anthropic) remains optional/stretch.
**Handoff instruction**: Read this file, then [`spec.md`](./spec.md), then [`apps/web/CONSTITUTION.md`](../../../apps/web/CONSTITUTION.md) before touching code. Inspect the `NarrativeData` shape in `packages/types/src/narrative.ts` for the field surface available to the UI. Run `pnpm turbo typecheck && pnpm --filter @darkscore/web test` to confirm a clean baseline.
**Last updated**: 2026-04-27

---

## Wave Map

| Wave | Scope | Status |
|------|-------|--------|
| W4-1 | Narrative package skeleton: types, registry, content-hash cache key, mock provider, errors, tests, boundary-checker entry, package CONSTITUTION | ✅ Done (PR #30) |
| W4-2 | OpenAI adapter (`gpt-4o-mini`, JSON-mode, T≤0.2), recorded-fixture integration test | ✅ Done (PR #32) |
| W4-3 | *(optional)* Anthropic adapter, parallel shape | ⏳ Stretch |
| W4-4 | `apps/web` orchestration: cache-first call to active provider after scoring; `narrativeAvailable` flag wiring | ✅ Done (PR #34) |
| W4-5 | UI sections: catalysts/risks columns, verdict prose, card subtitles, chart annotations, scenario targets — all gated on `narrativeAvailable` | ⏳ Next |
| W4-6 | End-to-end smoke + cache-hit verification + schema-violation degradation test | ⏳ Pending W4-5 |

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

