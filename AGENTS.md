# AGENTS.md

> **Governance**: This project follows Spec-Driven Development. Constitution: `.specify/memory/constitution.md` · Specs: `.specify/specs/`

Single entry point for any AI agent working in this repository. Read this file in full before reading or modifying any code. Then read the documents linked below.

## Project identity

DarkScore is a stock-rating platform: it fetches market data from external providers, computes a composite score via swappable strategies, persists reports, and renders them in a Next.js web app. The codebase is a pnpm + Turborepo monorepo organized as a strict layered architecture. The platform is governed by a twelve-rule **Constitution** that is the contract between humans and agents — drift is not allowed.

## File map

| What | Where |
|------|-------|
| Constitution (C1–C12, normative) | `.specify/memory/constitution.md` |
| Active spec | `.specify/specs/001-darkscore-foundation/spec.md` |
| Architecture notes | `.specify/specs/001-darkscore-foundation/architecture.md` |
| C4 diagrams (L1/L2/L3, normative per C11) | `.specify/specs/001-darkscore-foundation/c4-diagrams.md` |
| Data model | `.specify/specs/001-darkscore-foundation/data-model.md` |
| Implementation plan | `.specify/specs/001-darkscore-foundation/plan.md` |
| Per-package rules | `packages/*/CONSTITUTION.md`, `apps/web/CONSTITUTION.md` |
| Boundary check | `scripts/check-boundaries.ts` |
| `any`/escape-hatch check | `scripts/check-no-any.ts` |
| Task graph | `turbo.json` |
| Workspace layout | `pnpm-workspace.yaml` |
| Source code | `packages/*/src`, `apps/web/app` |

## Package dependency rules

Source of truth: the **L2 Container diagram** in `c4-diagrams.md`. Reproduced here for convenience — the diagram wins on conflict.

| Package | May import from |
|---------|----------------|
| `@darkscore/types` | Nothing (leaf) |
| `@darkscore/cache` | `types` |
| `@darkscore/db` | `types` |
| `@darkscore/data-providers` | `types`, `cache` |
| `@darkscore/scoring-engine` | `types` (ONLY — pure computation, no I/O) |
| `apps/web` | `types`, `cache`, `db`, `data-providers`, `scoring-engine` |

Any `@darkscore/*` import not listed above is a **C4 violation** and will be rejected by `scripts/check-boundaries.ts`.

## Forbidden patterns

These are detected by `scripts/check-no-any.ts` and `scripts/check-boundaries.ts`. CI fails on any match.

- **No `any` types.** Use `unknown` plus a type guard, or define the shape.
  ```ts
  // ❌
  const data: any = await res.json();
  function f(x: any) {}
  const y = z as any;
  // ✅
  const data: unknown = await res.json();
  function f(x: unknown) { /* narrow with a guard */ }
  ```
- **No `@ts-ignore` or `@ts-expect-error`.** Fix the type instead.
- **No cross-boundary imports.** A package may only import from packages allowed by the table above.
  ```ts
  // ❌ inside packages/scoring-engine/src/foo.ts
  import { db } from "@darkscore/db";
  // ✅ scoring-engine is pure computation; pass data in as arguments
  ```
- **No raw SQL in application code.** All DB access goes through Drizzle schemas in `@darkscore/db` (C6).
- **No direct provider calls.** Data providers are accessed only through their adapter interfaces (C1) and always via the cache layer (C2).
- **No new files outside the task's stated scope** (C8). If you think you need one, stop and report back.
- **No new dependencies** unless the spec lists them (C8).
- **No edits to `turbo.json`** without spec approval (C9).
- **No fetch in components**: Data fetching must go through gateways (data-providers) or Next.js server components, never directly in React components (C12).
- **No business logic in JSX**: Encapsulate in domain models or utility functions. `{method.provider === "cash"}` → `{method.isDefault}` (C12).

## Pre-submission checklist

Before reporting a task as done, run from the repo root:

```bash
pnpm turbo validate     # boundaries + no-any + typecheck + lint
pnpm turbo typecheck    # tsc --noEmit across the graph
pnpm turbo test         # vitest where present
```

`pnpm turbo validate` is the single command CI uses; it must exit 0. Per C8, an agent must run `pnpm turbo validate` (boundary check + no-any check + typecheck) and verify it passes before reporting completion.

Individual checks can be run directly:

```bash
pnpm check:boundaries
pnpm check:no-any
```

## Naming conventions

- **Package scope:** `@darkscore/*`. New packages must use this scope and be registered in `pnpm-workspace.yaml` (C9).
- **Functions and variables:** `camelCase`.
- **Types, interfaces, classes, Zod schemas:** `PascalCase` (e.g. `ScoreReport`, `YahooQuoteSchema`).
- **Constants:** `SCREAMING_SNAKE_CASE`.
- **Files:** `kebab-case.ts` for modules; `PascalCase.tsx` for React components.
- **Test files:** colocated as `*.test.ts` next to the unit under test.
- **Cache keys:** `{provider}:{ticker}:{dataType}:{timestamp_bucket}` (C2).

## When in doubt

1. Re-read `.specify/memory/constitution.md`.
2. Re-read the L2 diagram in `c4-diagrams.md`.
3. Read the relevant `packages/*/CONSTITUTION.md`.
4. If still unsure — **stop and report back**. Do not guess (C8).

