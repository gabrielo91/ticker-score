# `@darkscore/web` — Constitution

**Purpose:** Next.js app — the only orchestrator. Fetches via providers, scores via the engine, persists via db, reads cache, renders to users.

## Applicable rules
C1 (Adapter Pattern), C2 (Cache-First), C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Error Boundaries), C7 (Spec-Driven), C9 (Monorepo Hygiene).

## Allowed imports
- `@darkscore/types`, `@darkscore/cache`, `@darkscore/db`, `@darkscore/data-providers`, `@darkscore/scoring-engine`.
- External: `next`, `react`, `react-dom`, plus what the spec lists. New runtime deps require a spec amendment.

## Forbidden patterns
- No `any`, no `@ts-ignore`/`@ts-expect-error`. Validate every API/route input with a Zod schema from `@darkscore/types`.
- No raw SQL — all persistence flows through `@darkscore/db` (C6).
- No direct HTTP calls to external providers — go through `@darkscore/data-providers` (C1).
- No unhandled rejections reaching the UI: every server action / route handler returns a Result-shaped response and degrades gracefully (C5).
- No business logic that belongs in `scoring-engine` or `data-providers`. The web app composes; it does not compute or fetch.
- Server-only code (DB client, Redis client, secrets) must never be imported into a client component.

## Reminders
- Check the cache before calling a provider; persist the report; render whatever is available even when some pieces failed.

