> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

# `@darkscore/scoring-engine` — Constitution

**Purpose:** Pure-computation scoring strategies and components that turn validated market data into a composite score.

## Applicable rules
C1 (Adapter Pattern — strategy interface), C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types), C8 (Anti-hallucination), C10 (Tests + 80% coverage).

## Allowed imports
- `@darkscore/types` **only**.

## Forbidden patterns
- **This package has ZERO I/O.** No `fetch`, no `fs`, no database, no cache, no logger that hits the network, no `process.env` reads, no `Date.now()` inside the scoring math (inject the timestamp).
- No imports from `@darkscore/cache`, `@darkscore/db`, `@darkscore/data-providers`, or `apps/web`.
- No `any`, no `@ts-ignore`/`@ts-expect-error`.
- No randomness inside scoring math — strategies must be deterministic given the same input.
- No throwing across the package boundary — return Result types.

## Reminders
- New strategies plug in through the strategy interface shown in the L3 `scoring-engine` diagram.
- Test coverage target: 80% (C10). All branches of every component should be exercised.

