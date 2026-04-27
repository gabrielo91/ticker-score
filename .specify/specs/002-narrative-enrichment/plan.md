<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Narrative Enrichment — Living Plan

## Current State

**Status**: Wave 4-1 IN REVIEW. Skeleton package landed on `feat/w4-1-narrative-package`; PR open against `main`.
**Next action**: After W4-1 merges, start W4-2 (OpenAI adapter) on a fresh branch.
**Handoff instruction**: Read this file, then [`spec.md`](./spec.md), then [`packages/narrative/CONSTITUTION.md`](../../../packages/narrative/CONSTITUTION.md) before touching code. Run `pnpm turbo validate && pnpm turbo test` to confirm a clean baseline.
**Last updated**: 2026-04-27

---

## Wave Map

| Wave | Scope | Status |
|------|-------|--------|
| W4-1 | Narrative package skeleton: types, registry, content-hash cache key, mock provider, errors, tests, boundary-checker entry, package CONSTITUTION | 🔄 In review |
| W4-2 | OpenAI adapter (`gpt-4o-mini`, JSON-mode, T≤0.2), recorded-fixture integration test | ⏳ Next |
| W4-3 | *(optional)* Anthropic adapter, parallel shape | ⏳ Stretch |
| W4-4 | `apps/web` orchestration: cache-first call to active provider after scoring; `narrativeAvailable` flag wiring | ⏳ Pending W4-2 |
| W4-5 | UI sections: catalysts/risks columns, verdict prose, card subtitles, chart annotations, scenario targets — all gated on `narrativeAvailable` | ⏳ Pending W4-4 |
| W4-6 | End-to-end smoke + cache-hit verification + schema-violation degradation test | ⏳ Pending W4-5 |

---

## Completed Work

### Wave 4-1: Narrative Package Skeleton 🔄

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

---

## Open Questions

- Default model: `gpt-4o-mini` (cheap, JSON-mode supported) vs `gpt-4o` (higher fidelity). Pin in W4-2 PR.
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

