> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

# `@darkscore/db` — Constitution

**Purpose:** PostgreSQL persistence via Drizzle — schema, client, and migration runner (C6).

## Applicable rules
C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types), C6 (Schema-First DB), C9 (Monorepo Hygiene).

## Allowed imports
- `@darkscore/types` only.
- External: `drizzle-orm`, `drizzle-kit`, `postgres`, `dotenv` (per spec).

## Forbidden patterns
- No imports from `@darkscore/cache`, `@darkscore/data-providers`, `@darkscore/scoring-engine`, or `apps/web`.
- **No raw SQL in application code.** All DDL via Drizzle migrations; all DML via Drizzle query builders. `sql\`...\`` template literals are reserved for narrow, reviewed cases inside this package only.
- No `any`, no `@ts-ignore`/`@ts-expect-error`.
- Every table must declare `created_at` and `updated_at` timestamp columns (C6).
- No business logic, scoring, or HTTP fetching here — persistence only.
- No reading from cache or providers — those layers depend on us, not the other way around.

## Reminders
- Schema is the source of truth; never edit a migration after it has been applied.
- DB client returns Result types at the boundary; do not leak driver errors upward.

