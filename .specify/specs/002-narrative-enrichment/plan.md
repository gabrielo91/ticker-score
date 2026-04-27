<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Narrative Enrichment — Living Plan

## Current State

**Status**: Wave 4-1 COMPLETE (PR #30 merged to main as `bd32c95`). Wave 4-2 IN REVIEW on `feat/w4-2-openai-narrative` — OpenAI adapter (`gpt-4o-mini`, JSON-mode, T=0.2) with 10 unit tests + recorded fixture.
**Next action**: After W4-2 merges, start W4-4 (web orchestration: env-driven provider selection in `apps/web/lib/report-generator.ts`, cache-first call, `narrativeAvailable` wiring). W4-3 (Anthropic) remains optional/stretch.
**Handoff instruction**: Read this file, then [`spec.md`](./spec.md), then [`packages/narrative/CONSTITUTION.md`](../../../packages/narrative/CONSTITUTION.md) before touching code. Run `pnpm turbo validate && pnpm turbo test` to confirm a clean baseline.
**Last updated**: 2026-04-27

---

## Wave Map

| Wave | Scope | Status |
|------|-------|--------|
| W4-1 | Narrative package skeleton: types, registry, content-hash cache key, mock provider, errors, tests, boundary-checker entry, package CONSTITUTION | ✅ Done (PR #30) |
| W4-2 | OpenAI adapter (`gpt-4o-mini`, JSON-mode, T≤0.2), recorded-fixture integration test | 🔄 In review |
| W4-3 | *(optional)* Anthropic adapter, parallel shape | ⏳ Stretch |
| W4-4 | `apps/web` orchestration: cache-first call to active provider after scoring; `narrativeAvailable` flag wiring | ⏳ Next (after W4-2) |
| W4-5 | UI sections: catalysts/risks columns, verdict prose, card subtitles, chart annotations, scenario targets — all gated on `narrativeAvailable` | ⏳ Pending W4-4 |
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

### Wave 4-2: OpenAI Narrative Provider 🔄

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

The L2 diagram update lands with W4-4 (when the new edge is actually exercised), per C11.

