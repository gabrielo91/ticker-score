<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# DarkScore Foundation — Living Plan

## Current State

**Status**: Wave 2 COMPLETE. Wave 3 NOT STARTED.
**Next action**: Implement W3-1 (apps/web) — Next.js SSR report page with all React components, server-side orchestration, and Tailwind dark theme.
**Handoff instruction**: Read this section, then review the Wave 3 task details below. Read AGENTS.md, apps/web/CONSTITUTION.md, and .specify/specs/001-darkscore-foundation/frontend-guidelines.md before writing code.
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

---

## Active Work

_No active tasks._

---

## Upcoming Work

### Wave 3: Web App & Integration ⏳

| Task | Package | Description | Dependencies | Status |
|------|---------|------------|--------------|--------|
| W3-1 | apps/web | Next.js SSR report page at /report/[ticker], all React components, Tailwind dark theme | W2-1, W2-2, W2-3, W2-4 | ⏳ Not Started |

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

