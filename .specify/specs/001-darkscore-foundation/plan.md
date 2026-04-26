<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# DarkScore Foundation — Living Plan

## Current State

**Status**: Wave 3 COMPLETE. Foundation spec (001-darkscore-foundation) DELIVERED.
**Next action**: No active task. Next wave / spec is TBD by the coordinator. Candidates: end-to-end smoke test against a live ticker, Postgres migrations applied to a real DB, deploy pipeline, additional providers, persistence of `ScoreReport` to `report_history`.
**Handoff instruction**: Read this section, then read AGENTS.md and `.specify/memory/constitution.md` before scoping the next spec. All current code is on `main`; run `pnpm turbo validate && pnpm turbo test` to confirm a clean baseline.
**Last updated**: 2026-04-26

---

## Completed Work

### Wave 1: Scaffold & Infrastructure ✅

| Task | Description | Status | Verified |
|------|------------|--------|----------|
| W1-1 | Turborepo monorepo scaffold | ✅ Done | turbo build 5/5, turbo typecheck 8/8, 11 legacy HTML files moved |
| W1-2 | Docker Compose + Drizzle DB schema | ✅ Done | 4 tables, migrations generated, typecheck passes |
| W1-3 | Materialize specs into .specify/ | ✅ Done | Constitution (C1–C13), spec, plan, architecture, C4 diagrams |
| W1-4 | Harness hardening (AGENTS.md, boundary checker, no-any checker, package CONSTITUTIONs) | ✅ Done | Both checkers pass, 6 CONSTITUTION.md files, AGENTS.md |

**Post-Wave 1 fixes applied:**
- C8 updated: explicit context chain (AGENTS.md → CONSTITUTION.md → task → files)
- C12 added: Frontend Layering (Presentation-Domain-Data)
- C13 added: Living Plan Protocol (this document)
- Breadcrumb links added to all CONSTITUTION.md files
- frontend-guidelines.md created
- Stale references fixed (C1-C11 → C1-C13)

### Wave 2: Core Packages ✅

| Task | Package | Description | Status | Verified |
|------|---------|------------|--------|----------|
| W2-1 | @darkscore/types | Shared TypeScript types + Zod schemas (TickerInfo, Financials, RiskScore, ReportData, Result<T>, DataProvider interface) | ✅ Done | 15 tests, PR #3 |
| W2-2 | @darkscore/cache | Redis cache layer (CacheService, CacheBackend adapter, key builder, 2hr TTL) | ✅ Done | 30 tests, PR #5 |
| W2-3 | @darkscore/data-providers | Yahoo Finance adapter, ProviderRegistry, DataAggregator, Zod response schemas, rate limiter | ✅ Done | 42 tests, PR #9 |
| W2-4 | @darkscore/scoring-engine | EditorialStrategy (35/35/30), Valuation/Health/Growth scorers, thresholds, rating mapper | ✅ Done | 55 tests, PR #4 |

**Total**: 142 unit tests across 4 packages.

### Wave 3: Web App & Integration ✅

Wave 3 was decomposed into four sub-tasks (the original `W3-1` row in plan.md was split during execution to keep PRs reviewable).

| Task | Package | Description | Status | Verified |
|------|---------|------------|--------|----------|
| W3-1 | apps/web | Server-side report orchestration, `/report/[ticker]` route, ReportData assembly via DataAggregator + ScoringEngine | ✅ Done | PR #12 |
| W3-2 | apps/web | Page 1 components (TickerBar, KPIStrip, RiskGauge, Verdict, MetricCards, ScoreBreakdown) | ✅ Done | PR #14 |
| W3-3 | apps/web | Page 2 components (PriceChart, QuarterlyTable, EarningsUpdate, CatalystsRisks, ClipboardExport) | ✅ Done | PR #13 |
| W3-4 | apps/web | Dark theme, layout, fonts (DM Sans + JetBrains Mono via next/font), print CSS via `@media print` + CSS variables | ✅ Done | PR #15 |

**Wave 3 baseline (verified on `main` 2026-04-26):**
- `pnpm check:boundaries` ✅
- `pnpm check:no-any` ✅
- `pnpm check:constitution-drift` ✅ (v3, C1–C13, 8 files scanned)
- `pnpm turbo typecheck` ✅ 10/10
- `pnpm turbo build` ✅ 5/5
- `pnpm turbo test` ✅ 8/8 (142 tests passing, FULL TURBO)
- `pnpm --filter @darkscore/web lint` ✅

---

## Active Work

_No active tasks. Foundation spec delivered._

---

## Upcoming Work

_No upcoming tasks scoped. Next spec / wave to be defined by coordinator._

Possible follow-ups (not yet specced):
- Persist `ScoreReport` to `report_history` table on each `/report/[ticker]` request.
- Apply Drizzle migrations to a managed Postgres and wire connection string in deploy env.
- Add a second data provider (e.g., Alpha Vantage, FMP) behind the `DataProvider` interface.
- Deployment pipeline (Vercel / Fly / etc.).
- E2E smoke test (Playwright) hitting `/report/AAPL` against live providers.

---

## Verification Checkpoints

After each wave, these must pass before moving to the next:

| Command | Purpose |
|---------|---------|
| `pnpm turbo build` | All packages compile |
| `pnpm turbo typecheck` | Zero type errors |
| `pnpm turbo validate` | Boundary checker + no-any checker + lint |
| `pnpm turbo test` | All unit tests pass |

---

## Document Map

| Document | Location | Purpose |
|----------|----------|---------|
| Constitution | `.specify/memory/constitution.md` | Immutable rules (C1-C13) |
| Architecture | `.specify/specs/001-darkscore-foundation/architecture.md` | Folder structure, dependency graph, data flow |
| Data Model | `.specify/specs/001-darkscore-foundation/data-model.md` | Database schema (4 tables) |
| C4 Diagrams | `.specify/specs/001-darkscore-foundation/c4-diagrams.md` | L1 Context, L2 Container, L3 Components |
| Frontend Guidelines | `.specify/specs/001-darkscore-foundation/frontend-guidelines.md` | Presentation-Domain-Data layering |
| Agent Entry Point | `AGENTS.md` | File map, dependency rules, forbidden patterns |

