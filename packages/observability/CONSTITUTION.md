> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md) · [`Spec 003`](../../.specify/specs/003-observability/spec.md)

# `@darkscore/observability` — Constitution

**Purpose:** Process-wide structured logger (pino) with built-in secret redaction. The platform's only server-side observability primitive (C14).

## Applicable rules
C3 (Strict TypeScript), C4 (Package Boundaries), C8 (Scope discipline), C14 (Server-Side Observability).

## Allowed imports
- Nothing from `@darkscore/*` — this is a **leaf** package.
- External: `pino` only.

## Who may import this package
- `@darkscore/web` (the orchestrator).
- `@darkscore/cache`, `@darkscore/db`, `@darkscore/data-providers`, `@darkscore/narrative` (server-side adapters that catch errors at the boundary).
- **Forbidden** in `@darkscore/types` (leaf, no I/O) and `@darkscore/scoring-engine` (pure computation, no I/O — explicit in their CONSTITUTIONs and C14).

## Forbidden patterns
- No `any`, no `@ts-ignore` / `@ts-expect-error`.
- No string-only log calls in this package's tests of contract — every example MUST be `logger.<level>({ ...fields }, message)`.
- No transport workers, no async destinations — write JSON to stdout, period. Pretty-printing is the dev shell's job (`pnpm dev | pino-pretty`).
- No new public API beyond what `src/index.ts` exports — adding to the surface requires a spec amendment.
- No reading of secrets at log-time. The `REDACT_PATHS` list is a **safety net**, not a license to log raw payloads.

## Reminders
- Default level: `info`. Override via `LOG_LEVEL` env.
- Singleton: callers must use `getRootLogger()`; tests use `createLogger(opts)` with an injected `destination` for assertions.
- Child loggers carry component / request context: `getRootLogger().child({ component: "<name>" })`. Every consumer that logs more than once MUST own a child.
- When extending `REDACT_PATHS`, add a test asserting the new path is censored. The list is the security contract.

