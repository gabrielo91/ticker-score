# DarkScore

A spec-driven, server-side-rendered web platform that generates dark-themed risk score reports for any stock ticker on demand. DarkScore fetches market data from external providers, computes a composite risk score via swappable strategies, persists reports, and renders them through a Next.js application.

## Status

Phase 0 — foundational scaffold. Wave 1 (monorepo + infrastructure + governance) is complete; Wave 2 (core packages) is the active workstream. The authoritative state lives in [`.specify/specs/001-darkscore-foundation/plan.md`](./.specify/specs/001-darkscore-foundation/plan.md).

## Tech stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Language**: TypeScript (strict, no `any`, no `@ts-ignore`)
- **Web**: Next.js 14 App Router (SSR)
- **Persistence**: PostgreSQL via Drizzle ORM
- **Cache**: Redis (2-hour TTL, key format `{provider}:{ticker}:{dataType}:{timestamp_bucket}`)
- **Validation**: Zod at every external boundary
- **Tests**: Vitest

## Repository layout

```
apps/
  web/                          # Next.js SSR app — /report/[ticker]
packages/
  @darkscore/types              # Shared types + Zod schemas (leaf)
  @darkscore/cache              # Redis adapter
  @darkscore/db                 # Drizzle + PostgreSQL adapter
  @darkscore/data-providers     # Pluggable data-source adapters (Yahoo, …)
  @darkscore/scoring-engine     # Pure-computation risk scoring (Strategy pattern)
legacy/                         # Original static HTML reports (archived)
docker/                         # PostgreSQL + Redis compose file
.specify/                       # Constitution, specs, plan, C4 diagrams
scripts/                        # Boundary + no-any guard scripts
```

## Package dependency rules

The L2 Container diagram in [`.specify/specs/001-darkscore-foundation/c4-diagrams.md`](./.specify/specs/001-darkscore-foundation/c4-diagrams.md) is the source of truth and is enforced by `scripts/check-boundaries.ts`.

| Package                     | May import from                                            |
| --------------------------- | ---------------------------------------------------------- |
| `@darkscore/types`          | Nothing (leaf)                                             |
| `@darkscore/cache`          | `types`                                                    |
| `@darkscore/db`             | `types`                                                    |
| `@darkscore/data-providers` | `types`, `cache`                                           |
| `@darkscore/scoring-engine` | `types` (pure computation, no I/O)                         |
| `apps/web`                  | `types`, `cache`, `db`, `data-providers`, `scoring-engine` |

## Governance

DarkScore follows Spec-Driven Development. Three documents are required reading before any change:

1. [`AGENTS.md`](./AGENTS.md) — entry point for humans and agents (file map, dependency rules, forbidden patterns, workflow protocol)
2. [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — thirteen normative rules (C1–C13) covering adapter discipline, cache-first I/O, strict TypeScript, package boundaries, error handling, schema-first DB, spec-driven delivery, agent harness limits, monorepo hygiene, testing, C4 diagrams as constraints, frontend layering, and the living plan protocol
3. [`.specify/specs/001-darkscore-foundation/`](./.specify/specs/001-darkscore-foundation/) — the active spec, architecture notes, C4 diagrams, data model, frontend guidelines, and the living plan

Per-package rules live in `packages/*/CONSTITUTION.md` and `apps/web/CONSTITUTION.md`.

## Verification

Before reporting any task complete, run from the repo root:

```bash
pnpm turbo validate     # boundaries + no-any + typecheck + lint
pnpm turbo typecheck    # tsc --noEmit across the graph
pnpm turbo test         # vitest where present
```

`pnpm turbo validate` is the single command CI uses; it must exit 0. Individual guards can also be run directly:

```bash
pnpm check:boundaries
pnpm check:no-any
```

## Contributing

Branch from `main` using a conventional prefix (`feat/`, `fix/`, `docs/`, `chore/`), make focused commits, run `pnpm turbo validate` and `pnpm turbo test`, then open a PR using `.github/pull_request_template.md`. The full lifecycle is documented in the **Agent Workflow Protocol** section of [`AGENTS.md`](./AGENTS.md).
