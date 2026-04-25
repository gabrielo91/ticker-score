<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# Spec 001 — DarkScore Foundation (Phase 0)

> Companion documents (read alongside this spec):
> - [Constitution](../../memory/constitution.md) — governing rules C1–C11
> - [Architecture](./architecture.md) — folder structure, package dependency rules, data flow
> - [C4 Diagrams](./c4-diagrams.md) — L1/L2/L3 normative diagrams (per C11)
> - [Data Model](./data-model.md) — full database schema
> - [Plan](./plan.md) — wave breakdown and task list

---

## Goal

Build **DarkScore** — a spec-driven, SSR web platform that generates dark-themed risk score reports for any stock ticker on demand. The system uses pluggable data providers, an algorithmic scoring engine, PostgreSQL for persistence, Redis for caching, and deploys via Vercel/AWS. Built as a Turborepo monorepo with TypeScript and Next.js.

**Phase 0 (this spec)**: Foundational monorepo scaffold, shared packages, data provider adapter system, database schema, cache layer, scoring engine interface, Next.js app shell, and one working report page at `/report/[ticker]` that replicates the existing HTML template quality.

---

## Overview

The platform is structured as five `@darkscore/*` packages plus a single Next.js `apps/web` consumer:

- **types** — Zod schemas and shared TypeScript interfaces (leaf, no internal deps)
- **cache** — Redis adapter (depends on types)
- **db** — Drizzle + PostgreSQL adapter (depends on types)
- **data-providers** — Pluggable data-source adapters with cache-first aggregator (depends on types, cache)
- **scoring-engine** — Pure-computation risk scoring with strategy pattern (depends on types only)
- **apps/web** — Next.js 14 SSR application that orchestrates the full flow

The full folder layout, dependency rules, and data flow live in [architecture.md](./architecture.md). The diagrams in [c4-diagrams.md](./c4-diagrams.md) are normative constraints under Constitution rule C11.

---

## Key Interfaces

### DataProvider (see [architecture.md](./architecture.md) for context)
```typescript
interface DataProvider {
  readonly name: string;
  readonly priority: number; // Lower = preferred

  getTickerInfo(symbol: string): Promise<Result<TickerInfo>>;
  getPriceHistory(symbol: string, months: number): Promise<Result<PricePoint[]>>;
  getFinancials(symbol: string): Promise<Result<Financials>>;
  getQuarterlyResults(symbol: string, quarters: number): Promise<Result<QuarterlyResult[]>>;
  getKeyMetrics(symbol: string): Promise<Result<KeyMetrics>>;
  isAvailable(): Promise<boolean>;
}
```

The `registry.ts` holds all registered providers ordered by priority. The `aggregator.ts` tries providers in order, falling back on failure.

### ScoringStrategy
```typescript
interface ScoringStrategy {
  readonly name: string;
  readonly version: string;

  computeValuationScore(metrics: KeyMetrics): ComponentScore;  // 35% weight
  computeHealthScore(financials: Financials): ComponentScore;   // 35% weight
  computeGrowthScore(growth: GrowthData): ComponentScore;       // 30% weight
  computeComposite(components: ComponentScore[]): RiskScore;
  determineRating(score: number): Rating;
}
```

The `editorial` strategy replicates the logic used in the static HTML reports (heuristic thresholds for P/E, margins, FCF, growth rates, etc.).

---

## Database Schema

The full schema (4 tables: `tickers`, `reports`, `price_history`, `score_snapshots`) is documented in [data-model.md](./data-model.md). All tables include `created_at` and `updated_at` per Constitution C6.

---

## Acceptance Criteria

- [ ] Turborepo monorepo initializes and `turbo build` succeeds with zero errors
- [ ] All packages compile with `tsc --noEmit` — zero errors, zero `any` types
- [ ] Docker Compose starts PostgreSQL + Redis successfully
- [ ] Drizzle migrations run and create all 4 tables
- [ ] Yahoo Finance adapter fetches real data for AMZN and returns typed results
- [ ] Cache layer stores/retrieves data with 2-hour TTL
- [ ] Scoring engine computes a risk score matching ~38/100 for AMZN test data
- [ ] Next.js app starts and `/report/AMZN` renders a full dark-themed report via SSR
- [ ] Report visual quality matches the existing `legacy/index.html` template
- [ ] Legacy HTML files are moved to `legacy/` folder
- [ ] All packages have passing unit tests (Vitest)
- [ ] `turbo lint` and `turbo typecheck` pass across all packages

---

## Non-Goals (Phase 0)

- No authentication/user accounts
- No ticker lists, comparisons, or portfolio features
- No E2E tests (Phase 1)
- No CI/CD pipeline (Phase 1)
- No deployment to Vercel/AWS (Phase 1)
- No real-time data or WebSocket updates
- No mobile-responsive design beyond basic readability

---

## Assumptions

- Yahoo Finance unofficial API remains available for free (confirm?)
- Docker is installed locally for PostgreSQL + Redis
- Node.js 20+ is installed
- The existing HTML template design is the target visual quality

---

## Verification Plan

1. `turbo build` — zero errors
2. `turbo typecheck` — zero errors
3. `turbo test` — all passing, 80%+ coverage on scoring-engine and data-providers
4. `docker compose up -d` — Postgres + Redis healthy
5. `pnpm db:migrate` — tables created
6. Visit `http://localhost:3000/report/AMZN` — full report renders
7. Compare rendered report with `legacy/index.html` visually

---

## Rollback Plan

- All code is on a feature branch
- Legacy HTML reports preserved in `legacy/` folder
- Docker volumes are ephemeral in dev — `docker compose down -v` cleans everything
- No production deployment in Phase 0
