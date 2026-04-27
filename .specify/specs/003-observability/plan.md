<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Server-Side Observability — Living Plan

## Current State

**Status**: Spec 003 in progress on `feat/spec-003-observability`. W5-1 (`@darkscore/observability` package) and W5-2 (narrative-runtime instrumentation) are being delivered together in a single PR alongside the Constitution C14 amendment and the L2 C4 diagram update — they are tightly coupled and have no value individually. No prior code on `main` references the package yet.
**Next action**: Land the W5-1 + W5-2 PR. After merge, queue follow-up tasks to instrument the remaining server-side surfaces (`report-generator`, `cache-runtime`, `data-providers` adapters, `db` migrations). None are in scope for this PR.
**Handoff instruction**: For new contributors continuing on this spec: read this file, then [`spec.md`](./spec.md), then [`packages/observability/CONSTITUTION.md`](../../../packages/observability/CONSTITUTION.md). Use `apps/web/lib/narrative-runtime.ts` as the structural template for any new consumer — own a `child({ component: "<name>" })`, log structured fields not strings, never log secrets (the redactor is a safety net only).
**Last updated**: 2026-04-27

---

## Wave Map

| Wave | Scope | Status |
|------|-------|--------|
| W5-1 | `@darkscore/observability` package: pino + redaction + singleton + tests; boundary registration; C4 L2 diagram entry | ⏳ In progress |
| W5-2 | First consumer wired: `apps/web/lib/narrative-runtime.ts` emits structured `warn` on fail-open; existing test asserts the call | ⏳ In progress |
| W5-3 | *(follow-up, separate spec or task)* Instrument `report-generator`, `cache-runtime`, data provider adapters, db migrations | ⏳ Not started |
| W5-4 | *(follow-up)* Request-id middleware in `apps/web` so child loggers carry a correlation id end-to-end | ⏳ Not started |

---

## Completed Work

*(none yet — W5-1 and W5-2 land together with this PR)*

---

## Open Questions / Decisions Captured

- **Pretty-print in dev**: Out of the package — devs pipe `pnpm dev | pino-pretty` if they want it. Keeps the package surface minimal and avoids transport workers in the Next.js runtime.
- **Request id**: Deferred to W5-4. Today every log is process-scoped; that is enough to debug the narrative quota issue that motivated the spec.
- **APM / Sentry / OTel**: Explicitly out of scope. Future spec when the platform has prod traffic worth instrumenting.
- **Log destination**: Always `stdout`. Host platforms (Vercel/Render/Fly) aggregate stdout natively; we don't ship logs from the package.

