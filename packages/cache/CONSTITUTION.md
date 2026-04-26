> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

# `@darkscore/cache` — Constitution

**Purpose:** Redis-backed cache layer that fronts every external data fetch in the platform (C2).

## Applicable rules
C1 (Adapter Pattern), C2 (Cache-First), C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types).

## Allowed imports
- `@darkscore/types` only.
- External: `ioredis` (per spec).

## Forbidden patterns
- No imports from `@darkscore/db`, `@darkscore/data-providers`, `@darkscore/scoring-engine`, or `apps/web`.
- No business logic — this package only stores/retrieves serializable values.
- No `any`, no `@ts-ignore`/`@ts-expect-error`.
- No direct provider-specific knowledge: cache keys follow the canonical format `{provider}:{ticker}:{dataType}:{timestamp_bucket}` (C2) and are produced by callers.
- No bypassing of cache from inside this package — exposing a "force refresh" flag to callers is fine; silently skipping cache is not.

## Reminders
- Default TTL is 2h unless the caller overrides it.
- All public methods return Result types — never throw across the package boundary.

