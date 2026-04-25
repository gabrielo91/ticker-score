<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# Plan — DarkScore Foundation (Phase 0)

This plan breaks the work into three sequential **waves**. Tasks within a wave can run in parallel; tasks across waves have dependencies.

> See [spec.md](./spec.md) for goal and acceptance criteria. See [architecture.md](./architecture.md) for package boundaries. See [c4-diagrams.md](./c4-diagrams.md) for normative architectural constraints.

---

## Wave 1 — Scaffold & Infrastructure

Lay the foundation: monorepo, infrastructure, and portable governing documents.

| Task ID | Title | Depends On | Status |
|---------|-------|-----------|--------|
| W1-1 | Initialize Turborepo monorepo scaffold | — | Not Started |
| W1-2 | Docker Compose + Database schema | — | Not Started |
| W1-3 | Materialize specs into `.specify/` directory | — | Not Started |

**Exit criteria for Wave 1:**
- `pnpm install` succeeds; `turbo build` runs (no packages yet, but pipeline works)
- `docker compose up -d` starts PostgreSQL + Redis healthy
- Drizzle migrations create all 4 tables in the local DB
- `.specify/` directory exists with constitution, spec, plan, architecture, c4-diagrams, data-model

---

## Wave 2 — Core Packages

Build the five `@darkscore/*` packages bottom-up following the dependency graph in [c4-diagrams.md](./c4-diagrams.md) (L2 Container).

| Task ID | Title | Depends On | Status |
|---------|-------|-----------|--------|
| W2-1 | Shared types package (`@darkscore/types`) | W1-1 | Not Started |
| W2-2 | Cache package (`@darkscore/cache`) | W2-1, W1-2 | Not Started |
| W2-3 | Data providers package (`@darkscore/data-providers`) | W2-1, W2-2 | Not Started |
| W2-4 | Scoring engine package (`@darkscore/scoring-engine`) | W2-1 | Not Started |

**Exit criteria for Wave 2:**
- All four packages compile with `tsc --noEmit` — zero errors
- Yahoo Finance adapter returns typed results for AMZN
- Cache layer stores and retrieves with 2-hour TTL
- Scoring engine computes ~38/100 for AMZN test fixture
- Vitest passes for all packages with ≥80% coverage on `scoring-engine` and `data-providers`

---

## Wave 3 — Web App & Integration

Wire all packages into the Next.js application and reproduce the legacy report visual quality.

| Task ID | Title | Depends On | Status |
|---------|-------|-----------|--------|
| W3-1 | Next.js report page with React components | W2-1, W2-2, W2-3, W2-4 | Not Started |

**Exit criteria for Wave 3:**
- `apps/web` starts and `/report/AMZN` SSR-renders the full dark-themed report
- Visual quality matches `legacy/index.html`
- Legacy HTML reports moved to `legacy/` folder
- `turbo lint` and `turbo typecheck` pass across the monorepo

---

## Dependency Order Summary

```
W1-1 ─┐
W1-2 ─┼── W2-1 ── W2-2 ── W2-3 ──┐
W1-3 ─┘           └── W2-4 ──────┴── W3-1
```

W1-3 (this task) is independent of all code work — it only materializes governance documents.
