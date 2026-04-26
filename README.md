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

## Prerequisites

- **Node.js** 20+ (see `engines.node` in `package.json`)
- **pnpm** 9+ — enable via Corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
  ```
- **Docker Desktop** (or any Docker engine + `docker compose`) for the local PostgreSQL and Redis services in [`docker/docker-compose.yml`](./docker/docker-compose.yml)

## Quick start

```bash
# 1. Clone
git clone git@github.com:gabrielo91/ticker-score.git
cd ticker-score

# 2. Install dependencies
pnpm install

# 3. Start local infrastructure (PostgreSQL on :5432, Redis on :6379)
docker compose -f docker/docker-compose.yml up -d

# 4. Configure environment
cp .env.example .env

# 5. Build all packages
pnpm turbo build

# 6. Run tests
pnpm turbo test

# 7. Start the Next.js dev server
pnpm --filter @darkscore/web dev
```

The defaults in `.env.example` (`DATABASE_URL`, `REDIS_URL`) point at the Docker compose services, so no edits are required for a local run.

## Project structure

```
apps/
  web/                          # Next.js 14 App Router (SSR) — @darkscore/web
packages/
  types/                        # @darkscore/types          — shared types + Zod schemas (leaf)
  cache/                        # @darkscore/cache          — Redis adapter (ioredis)
  db/                           # @darkscore/db             — Drizzle ORM + PostgreSQL
  data-providers/               # @darkscore/data-providers — pluggable data-source adapters
  scoring-engine/               # @darkscore/scoring-engine — pure-computation risk scoring (Strategy pattern)
legacy/                         # Original static HTML reports (archived reference)
docker/                         # PostgreSQL + Redis compose file
.specify/                       # Constitution, specs, plan, C4 diagrams
scripts/                        # Boundary, no-any, and constitution-drift guards
```

Detailed folder layout, package responsibilities, and the runtime data flow are documented in [`.specify/specs/001-darkscore-foundation/architecture.md`](./.specify/specs/001-darkscore-foundation/architecture.md).

## Architecture

DarkScore is a strict layered monorepo. Each `@darkscore/*` package may only import from a fixed set of siblings; any other import is rejected by `scripts/check-boundaries.ts`. The L2 Container diagram in [`.specify/specs/001-darkscore-foundation/c4-diagrams.md`](./.specify/specs/001-darkscore-foundation/c4-diagrams.md) is the normative source of truth.

| Package                     | May import from                                            |
| --------------------------- | ---------------------------------------------------------- |
| `@darkscore/types`          | Nothing (leaf)                                             |
| `@darkscore/cache`          | `types`                                                    |
| `@darkscore/db`             | `types`                                                    |
| `@darkscore/data-providers` | `types`, `cache`                                           |
| `@darkscore/scoring-engine` | `types` (pure computation, no I/O)                         |
| `apps/web`                  | `types`, `cache`, `db`, `data-providers`, `scoring-engine` |

For the full architecture (folder structure, dependency rules, runtime data flow, and C4 diagrams), see [`.specify/specs/001-darkscore-foundation/architecture.md`](./.specify/specs/001-darkscore-foundation/architecture.md) and [`.specify/specs/001-darkscore-foundation/c4-diagrams.md`](./.specify/specs/001-darkscore-foundation/c4-diagrams.md).

## Available scripts

Run from the repo root.

| Command                          | What it does                                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| `pnpm turbo build`               | Build every package and app via the Turborepo graph                 |
| `pnpm turbo test`                | Run Vitest in every package that defines tests                      |
| `pnpm turbo typecheck`           | Run `tsc --noEmit` across the graph                                 |
| `pnpm turbo lint`                | Run ESLint across the graph                                         |
| `pnpm turbo validate`            | Full validation: boundary check + no-any check + typecheck + lint   |
| `pnpm turbo dev`                 | Run the `dev` task for every package that declares one              |
| `pnpm check:boundaries`          | Enforce the package import rules from `scripts/check-boundaries.ts` |
| `pnpm check:no-any`              | Reject `any`, `@ts-ignore`, and `@ts-expect-error` escape hatches   |
| `pnpm check:constitution-drift`  | Verify the constitution version header has not drifted              |
| `pnpm db:generate`               | Generate Drizzle migrations (`@darkscore/db`)                       |
| `pnpm db:migrate`                | Apply Drizzle migrations against `DATABASE_URL`                     |
| `pnpm db:studio`                 | Open Drizzle Studio against `DATABASE_URL`                          |

`pnpm turbo validate` is the single command CI runs; it must exit 0 before any task is reported complete.

## Governance

DarkScore follows Spec-Driven Development. Three documents are required reading before any change:

1. [`AGENTS.md`](./AGENTS.md) — entry point for humans and agents (file map, dependency rules, forbidden patterns, workflow protocol)
2. [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — thirteen normative rules (C1–C13) covering adapter discipline, cache-first I/O, strict TypeScript, package boundaries, error handling, schema-first DB, spec-driven delivery, agent harness limits, monorepo hygiene, testing, C4 diagrams as constraints, frontend layering, and the living plan protocol
3. [`.specify/specs/001-darkscore-foundation/`](./.specify/specs/001-darkscore-foundation/) — the active spec, architecture notes, C4 diagrams, data model, frontend guidelines, and the living plan

Per-package rules live in `packages/*/CONSTITUTION.md` and `apps/web/CONSTITUTION.md`.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution workflow, and [`AGENTS.md`](./AGENTS.md) for the end-to-end Agent Workflow Protocol (orient → branch → implement → validate → PR → review → merge → update plan).

In short: branch from `main` using a conventional prefix (`feat/`, `fix/`, `docs/`, `chore/`), make focused commits, run `pnpm turbo validate` and `pnpm turbo test`, then open a PR using [`.github/pull_request_template.md`](./.github/pull_request_template.md).

## License

MIT
