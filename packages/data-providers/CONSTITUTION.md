# `@darkscore/data-providers` — Constitution

**Purpose:** Adapters that fetch market data from external providers (Yahoo, etc.), validate responses, and surface a uniform interface to the rest of the system (C1, C2).

## Applicable rules
C1 (Adapter Pattern), C2 (Cache-First), C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types), C7 (Spec-Driven), C10 (Tests).

## Allowed imports
- `@darkscore/types`, `@darkscore/cache`.
- External: HTTP client + provider SDKs that the spec lists. No `axios`/`got` etc. unless the spec adds them.

## Forbidden patterns
- No imports from `@darkscore/db`, `@darkscore/scoring-engine`, or `apps/web`.
- No direct concrete-provider imports outside the adapter that owns them — consumers see the adapter interface only (C1).
- All provider calls **must** route through the cache layer first; bypassing cache except via an explicit `forceRefresh` flag violates C2.
- No `any`, no `@ts-ignore`/`@ts-expect-error`. Validate every external response with a Zod schema from `@darkscore/types` before returning.
- No persistence here. Writing reports/scores/users to the database is the web app's job.
- No throwing across the package boundary — return Result types (C5).

## Reminders
- Cache key format: `{provider}:{ticker}:{dataType}:{timestamp_bucket}`.
- Add the new provider behind the registry pattern shown in the L3 `data-providers` diagram.

