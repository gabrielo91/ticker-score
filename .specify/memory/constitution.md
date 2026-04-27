<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# DarkScore Constitution

> **Version**: 4 (C1–C14) · **Last amended**: 2026-04-27 · **Entry point**: `AGENTS.md`

<!-- When adding or amending a rule, bump the version, update "Last amended",
     update the C-range above, and run pnpm check:constitution-drift to find
     all files that need updating. -->

The DarkScore Constitution defines the **immutable governing principles** for the platform. Every agent, contributor, and tool MUST read this document before writing or modifying code. Violations are blocking.

These fourteen rules (C1–C14) are the contract that keeps the codebase coherent across time, agents, and refactors. They are referenced by spec, plan, and task documents throughout `.specify/`.

---

## Purpose

- Establish non-negotiable architectural boundaries
- Prevent drift, hallucination, and scope creep across agents
- Make the spec the single source of truth for *what to build* and *how to build it*
- Keep the system swappable (providers, strategies, storage) by enforcing adapter discipline

---

## Rules

### C1 — Adapter Pattern is Law
Every external dependency (data sources, cache, database, scoring algorithms) MUST be accessed through a well-typed adapter interface. No package may import a concrete provider directly — only the interface. This ensures any component can be swapped without touching consumers.

### C2 — Cache-First Architecture
All data provider calls MUST go through the cache layer first. Cache TTL defaults to 2 hours. The cache key format is `{provider}:{ticker}:{dataType}:{timestamp_bucket}`. Cache misses trigger provider calls. Cache is never bypassed except in explicit force-refresh scenarios.

### C3 — Strict TypeScript — No Escape Hatches
- `strict: true` in all tsconfigs
- Zero `any` types allowed (use `unknown` + type guards)
- Zero `@ts-ignore` or `@ts-expect-error` allowed
- All function parameters and return types must be explicitly typed
- All API responses must be validated with Zod schemas at the boundary

### C4 — Package Boundaries are Hard Walls
Each package in the monorepo has a single responsibility. Packages may only import from packages listed in their `package.json` dependencies. Circular dependencies are forbidden. The dependency graph flows: `types ← db/cache ← data-providers ← scoring-engine ← web`.

### C5 — Error Boundaries, Not Crashes
All data provider calls must be wrapped in Result types (`{ ok: true, data } | { ok: false, error }`). The web app must never show an unhandled error to the user. Failed data fetches degrade gracefully — show what we have, mark what's missing.

### C6 — Schema-First Database
All database changes go through Drizzle migrations. No raw SQL in application code. Schema is the source of truth. Every table must have `created_at` and `updated_at` timestamps.

### C7 — Spec-Driven Development
No feature is implemented without a spec. Every task must reference which spec section it fulfills. Agents must read the spec and constitution before writing code. Implementation that contradicts the spec is rejected.

### C8 — Agent Harness Rules (Anti-Hallucination)
- Agents MUST read their context chain before writing code: AGENTS.md → package CONSTITUTION.md → task note → then ONLY the files they will modify
- Agents MUST NOT explore the full codebase — the specs, AGENTS.md, and CONSTITUTION.md files provide all necessary context. If a task's scope is unclear, stop and ask — don't go looking
- Agents MUST NOT add dependencies not listed in the spec or task note
- Agents MUST NOT create files outside their task's stated scope
- Agents MUST run `pnpm turbo validate` (boundary check + no-any check + typecheck) before reporting completion
- Agents MUST NOT invent API endpoints, database columns, or type fields not in the spec
- If an agent is unsure about a design decision, it must stop and report back — NOT guess

### C9 — Monorepo Hygiene
- All packages use the `@darkscore/` npm scope
- Shared dev dependencies (TypeScript, ESLint, tsconfig) live at root
- Each package has its own `tsconfig.json` extending root
- Turborepo pipeline: `build` depends on `^build`, `lint` is independent, `typecheck` depends on `^build`
- `turbo.json` defines the task graph — agents must not modify it without spec approval

### C10 — Test Expectations
- Unit tests for all pure logic (scoring engine, data transforms)
- Integration tests for data provider adapters (with mocked HTTP)
- No E2E tests in Phase 0 — they come in Phase 1
- Test runner: Vitest
- Coverage target: 80% for scoring-engine and data-providers packages

### C11 — Architecture Diagrams as Constraints
- The [C4 Architecture Diagrams](../specs/001-darkscore-foundation/c4-diagrams.md) are **normative**, not decorative
- Agents MUST read the relevant C4 diagram before implementing a task
- Any package dependency not shown in the L2 Container diagram is **forbidden**
- Any component not shown in L3 diagrams must not be created without a spec amendment
- Adding a new data provider or scoring strategy must follow the pattern shown in the L3 diagrams
- When in doubt about what a package can import, the L2 diagram is the source of truth

### C12 — Frontend Layering (Presentation-Domain-Data)
- React is a **view library**, not the architecture. Components render; they do not fetch, transform, or compute.
- The frontend follows four layers: **Views** (React components) → **Hooks** (state management) → **Domain Models** (plain TS classes) → **Data Access** (network gateways)
- Components must be **pure presentational functions** whenever possible — receive typed props, return JSX, no side effects
- Business logic belongs in **plain TypeScript classes/functions** in a `models/` directory, not in components or hooks
- Hooks manage **state and lifecycle only** — they delegate computation to domain models and data fetching to gateways
- Network clients act as **Anti-Corruption Layers** — they fetch external data and transform it into domain types. Views never call `fetch` directly.
- Use **polymorphism over conditionals** — scattered if/else across components is shotgun surgery. Encapsulate variants in Strategy classes.
- See `.specify/specs/001-darkscore-foundation/frontend-guidelines.md` for detailed patterns and examples.

### C13 — Living Plan Protocol
- `.specify/specs/001-darkscore-foundation/plan.md` must **always reflect the current project state** — it is the handoff document
- After every wave completion, plan.md must be updated: move tasks to Completed, update statuses, advance "Current State" and "Next Action"
- A cold-start agent's instruction is: **"Read `.specify/specs/001-darkscore-foundation/plan.md` — continue from the Current State section."** Nothing else should be needed.
- The Current State section must be the FIRST thing in plan.md after the title — never more than 5 lines
- If plan.md is stale, updating it is the highest priority before any implementation work

### C14 — Server-Side Observability
- All server-side logging goes through `@darkscore/observability` (`getRootLogger()` + `createLogger()`). No direct `pino` import outside the package; no `console.*` in any request-path code.
- Every log call MUST be **structured**: `logger.<level>({ ...fields }, message)`. String-only log calls are forbidden in app code (CLI scripts under `scripts/` and one-shot tools like `packages/db/src/migrate.ts` are exempt).
- **Never log secrets.** API keys, bearer tokens, passwords, and any value listed in the package's `REDACT_PATHS` MUST be censored. The redactor is a safety net, not a license — code MUST also avoid placing secrets into log payloads in the first place.
- **Levels have meaning.** `error` = unrecoverable / unexpected; `warn` = recoverable / fail-open by design (e.g. provider quota exhausted ⇒ Spec-001 layout); `info` = boot + request milestones; `debug`/`trace` = opt-in only, never enabled in prod.
- Modules that log more than once MUST own a child logger: `getRootLogger().child({ component: "<name>" })`. Request-scoped fields (`ticker`, `requestId`) attach via further `.child()` at the orchestration layer.
- The two pure packages — `@darkscore/types` and `@darkscore/scoring-engine` — MUST NOT import `@darkscore/observability` (no I/O is allowed in either, per their package CONSTITUTIONs).
- Output is JSON to stdout. Pretty-printing is a presentation concern; pipe through `pino-pretty` at the dev shell if desired. APM, error aggregation (Sentry), distributed tracing (OpenTelemetry) and metrics are out of scope until a future spec amends this rule.
