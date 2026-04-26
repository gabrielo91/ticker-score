> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

# `@darkscore/types` — Constitution

**Purpose:** Shared Zod schemas, TypeScript interfaces, and `Result` types — the lingua franca every other package speaks.

## Applicable rules
C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types), C9 (Monorepo Hygiene).

## Allowed imports
- **Zero `@darkscore/*` dependencies.** This is a leaf.
- External: `zod` only (per spec). No runtime, I/O, or framework deps.

## Forbidden patterns
- No `any`, `as any`, `<any>`, `@ts-ignore`, `@ts-expect-error`.
- No I/O of any kind: no `fetch`, `fs`, `process.env` reads, DB clients, Redis clients, loggers.
- No framework code (React, Next, Express). Types and schemas only.
- No dependency on any other `@darkscore/*` package — adding one is a C4 violation.
- No default exports; named exports only so consumers' import lines are greppable.

## Reminders
- Validate shapes at boundaries with Zod, then export the inferred TS type alongside the schema.
- Result type is `{ ok: true, data: T } | { ok: false, error: E }` (C5). Define it here.

