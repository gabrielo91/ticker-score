<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# Spec 003 — Server-Side Observability

> Companion documents (read alongside this spec):
> - [Constitution](../../memory/constitution.md) — governing rules C1–C14
> - [Spec 001](../001-darkscore-foundation/spec.md) — foundation
> - [Spec 002](../002-narrative-enrichment/spec.md) — first consumer of the logger (the trigger for this spec)
> - [C4 Diagrams](../001-darkscore-foundation/c4-diagrams.md) — L2 (this spec adds one container)
> - [Plan](./plan.md) — wave breakdown and current state

---

## Goal

Give every server-side surface a **structured, redacted, level-controlled logger** so failures (especially fail-open paths like the narrative provider) are observable in development and in production. Today the platform is silent: when an external provider returns `insufficient_quota`, the page degrades correctly per Constitution C5 — but no operator-visible signal is emitted. This is the bedrock for any future Spec covering APM / tracing / alerting.

---

## Overview

A new **leaf package** `@darkscore/observability` providing:

- A configured **pino** root logger memoised on `globalThis` (mirrors `cache-runtime` / `narrative-runtime`).
- Built-in **secret redaction** (API keys, bearer tokens, password fields) so no log line ever leaks `OPENAI_API_KEY` / `Authorization`.
- **Level control** via `LOG_LEVEL` env (`trace|debug|info|warn|error|fatal`, default `info`).
- **Child loggers** for request- or component-scoped context (`logger.child({ component: "narrative-runtime" })`).
- **JSON output** to `stdout` always — pretty-printing is a presentation concern handled by piping through `pino-pretty` at the dev shell, not by the package.

The package is a leaf — it imports nothing from `@darkscore/*`. It is allowed to be imported by every server-side package (`web`, `db`, `cache`, `data-providers`, `narrative`) and is **forbidden** in the two pure packages (`types`, `scoring-engine`) per their existing constitutional purity rules.

The first consumer wired in this spec is `apps/web/lib/narrative-runtime.ts` — the exact site that motivated the work. Every other consumer is a follow-up under its own task.

---

## Key Interfaces

```typescript
// from @darkscore/observability
export type Logger = pino.Logger; // re-exported for type ergonomics

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  readonly base?: Record<string, unknown>;
  readonly destination?: pino.DestinationStream;
}

export function createLogger(options?: CreateLoggerOptions): Logger;
export function getRootLogger(): Logger;        // singleton
export function resetRootLoggerForTests(): void; // test-only escape hatch

export const REDACT_PATHS: readonly string[];   // public so tests can assert
```

---

## Logging Contract (normative)

1. **Structured only.** Every log call MUST be `logger.<level>({ ...fields }, message)`. No string-only log calls in app code (they pass review only in tests).
2. **No PII / no secrets.** Never log full request bodies, API keys, bearer tokens, user identifiers, or any value listed in `REDACT_PATHS`. The redactor is a safety net, not a license.
3. **Result-shaped errors.** When a `Result.err` is logged, the structured fields MUST include the error `code` and `message` — never the full `Error` object (stack noise, no schema).
4. **Context via child loggers.** Every module that logs more than once MUST own a `child({ component: "<name>" })` so filtering by component works. Request-scoped fields (`ticker`, `requestId`) MUST be added via further `.child()` at the orchestration layer.
5. **Levels have meaning.**
   - `error` — unrecoverable for the request; user-facing degradation occurred *and* the cause is unknown / unexpected.
   - `warn` — recoverable / fail-open; user got a degraded response by design (e.g. narrative provider quota exhausted → Spec-001 layout).
   - `info` — milestones (boot, request completed, cache hit/miss summary at end of request).
   - `debug` / `trace` — opt-in only; never enabled in prod.
6. **No `console.*` in app code.** CLI scripts (`scripts/check-*.ts`, `packages/db/src/migrate.ts`) keep `console.*` because they are not part of the request path. Anywhere a request can flow, use the logger.

---

## Acceptance Criteria

- [ ] **W5-1**: `@darkscore/observability` package landed: `package.json` (pino runtime dep), `tsconfig.json`, `CONSTITUTION.md`, `src/index.ts`, `src/logger.ts`, `src/redact.ts`, `src/*.test.ts`, registered in `scripts/check-boundaries.ts` and the L2 C4 diagram.
- [ ] **W5-2**: `apps/web/lib/narrative-runtime.ts` instrumented — every fail-open path emits a structured `warn` carrying `provider`, `model`, `ticker`, `code`, `message`. Existing tests updated.
- [ ] Constitution amended to **C14 — Server-Side Observability**, version bumped 3 → 4. `AGENTS.md` dependency table updated to include `@darkscore/observability`.
- [ ] All constitutional gates green: `pnpm turbo validate` + `pnpm turbo test`.
- [ ] No new `any` / `@ts-ignore`. No new cross-boundary imports. No `console.*` in `apps/web/lib/` or `apps/web/app/`.

---

## Non-Goals (deferred to future specs)

- No APM / distributed tracing (OpenTelemetry, Honeycomb).
- No error-aggregation SaaS (Sentry, Bugsnag).
- No log shipping / aggregation backend (Loki, Vector, Datadog Logs). Stdout JSON is the contract — the host platform aggregates.
- No metrics / Prometheus.
- No instrumentation of every adapter — only `narrative-runtime` is wired in this spec. Other surfaces (`data-providers`, `cache-runtime`, `report-generator`, `db`) get their own follow-up tasks.
- No request-id middleware in `apps/web` — tracked separately when the first multi-request correlation need arises.

---

## Assumptions

- Hosting platform aggregates `stdout` (Vercel, Render, Fly, Railway, plain `pm2 logs` all do).
- Single-process Node runtime per replica; no log shipping coordination needed.
- Log volume at current scale (single-digit RPS) is well below pino's throughput ceiling.
- `pino` v9 is acceptable as a runtime dependency; it has no native add-ons and works in the Next.js Node runtime.

---

## Verification Plan

1. `pnpm turbo validate` — boundaries + no-any + typecheck + lint must exit 0.
2. `pnpm turbo test` — vitest suites must pass, including the new `@darkscore/observability` tests and the updated `narrative-runtime` test.
3. Manual smoke: run the dev server with `OPENAI_API_KEY` set to an invalid value, request `/api/report/AAPL`, and confirm a single structured `warn` line appears in the dev terminal containing `"component":"narrative-runtime"` and `"code":"transport"` (or similar). The HTTP response stays `200` with `narrativeAvailable: false`.
4. Redaction smoke: a unit test passes a payload containing `{ apiKey: "sk-real" }` and asserts the serialized log line contains `[REDACTED]`, never the raw key.

---

## Rollback Plan

- The package is additive. Removing the `import` in `narrative-runtime.ts` and dropping `@darkscore/observability` from `apps/web/package.json` returns the platform to its current silent behavior.
- No cache, no DB schema, no API contract changes — observability is purely additive.
- `LOG_LEVEL=fatal` silences everything except crashes without removing the package.

