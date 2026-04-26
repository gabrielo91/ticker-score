<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# Architecture — DarkScore Foundation

This document captures the **physical layout** (folder structure), **logical layout** (package boundaries), and **runtime data flow** of the DarkScore platform.

> The diagrams in [c4-diagrams.md](./c4-diagrams.md) are the **normative** view (per Constitution C11). This document is the textual companion.

---

## Folder Structure

```
apps/
  web/                          # Next.js 14+ App Router (SSR)
    app/
      report/[ticker]/page.tsx  # Main report SSR page
      api/report/[ticker]/      # API route (JSON endpoint)
    components/
      report/                   # React report components
        TickerBar.tsx
        RiskGauge.tsx
        KPIStrip.tsx
        PriceChart.tsx
        MetricCards.tsx
        ScoreBreakdown.tsx
        QuarterlyTable.tsx
        EarningsUpdate.tsx
        CatalystsRisks.tsx
        Verdict.tsx
        ClipboardExport.tsx
    lib/
      report-generator.ts       # Orchestrates data → score → render

packages/
  @darkscore/types/             # Shared TypeScript types & Zod schemas
    src/
      ticker.ts                 # TickerData, PriceHistory, Financials
      score.ts                  # RiskScore, ScoreBreakdown, ComponentScore
      report.ts                 # ReportData (full page data contract)
      provider.ts               # DataProvider interface
      result.ts                 # Result<T, E> type

  @darkscore/cache/             # Redis cache layer
    src/
      client.ts                 # Redis connection
      cache.ts                  # get/set/invalidate with TTL
      keys.ts                   # Cache key builder

  @darkscore/db/                # Drizzle + PostgreSQL
    src/
      schema.ts                 # tickers, reports, scores, price_history
      client.ts                 # Drizzle client
      migrations/               # Drizzle migrations
    drizzle.config.ts

  @darkscore/data-providers/    # Pluggable data source adapters
    src/
      interface.ts              # DataProvider interface (the contract)
      registry.ts               # Provider registry (switch sources)
      providers/
        yahoo/                  # Yahoo Finance adapter
          client.ts
          transforms.ts         # Raw → typed data transforms
          schemas.ts            # Zod schemas for Yahoo responses
        alpha-vantage/          # Future: Alpha Vantage adapter (stub)
      aggregator.ts             # Multi-source aggregator

  @darkscore/scoring-engine/    # Risk score computation
    src/
      engine.ts                 # Main scoring function
      strategies/
        editorial.ts            # Current strategy: weighted heuristic
        interface.ts            # ScoringStrategy interface
      components/
        valuation.ts            # Valuation score (35% weight)
        financial-health.ts     # Financial health score (35% weight)
        growth.ts               # Growth score (30% weight)
      thresholds.ts             # Metric thresholds & benchmarks
      rating.ts                 # Score → rating label mapping

legacy/                         # Original static HTML reports (archived)
  index.html                    # AMZN
  alb.html, asts.html, ...      # All 11 reports

docker/
  docker-compose.yml            # PostgreSQL + Redis

turbo.json                      # Turborepo pipeline config
package.json                    # Root workspace config
tsconfig.base.json              # Shared TypeScript config
```

---

## Package Dependency Rules

These rules are derived from the L2 Container diagram in [c4-diagrams.md](./c4-diagrams.md). Any import not listed here is **forbidden** under Constitution C4 and C11.

| Package | May import from |
|---------|----------------|
| `@darkscore/types` | Nothing (leaf) |
| `@darkscore/cache` | `types` |
| `@darkscore/db` | `types` |
| `@darkscore/data-providers` | `types`, `cache` |
| `@darkscore/scoring-engine` | `types` (ONLY — pure computation, zero I/O) |
| `apps/web` | `types`, `cache`, `db`, `data-providers`, `scoring-engine` |

**Forbidden connections** (not in the L2 diagram):
- `scoring-engine` → `db`, `cache`, `data-providers` (scoring is pure computation)
- `cache` → `db` and `db` → `cache` (independent infrastructure adapters)
- `data-providers` → `db` (providers fetch external data; persistence is the app's concern)

Circular dependencies are forbidden in all directions.

---

## Data Flow (Runtime)

The end-to-end request path for `GET /report/[ticker]`:

1. **User → Web** — Browser issues an HTTPS request to `/report/AMZN`.
2. **Web → Cache** — `apps/web` (via `lib/report-generator.ts`) checks `@darkscore/cache` for a cached `ReportData` object using key `report:AMZN:{bucket}`.
3. **Cache hit** — Return cached payload, render SSR HTML, done.
4. **Cache miss → Data Providers** — `@darkscore/data-providers`' `DataAggregator` is invoked. It checks the cache layer per-call (per Constitution C2), then iterates the `ProviderRegistry` by priority. The Yahoo provider is tried first; on failure (Result `{ ok: false }`) the next provider is tried.
5. **Provider → External API** — `YahooFinanceProvider` calls the Yahoo HTTP client (rate-limited, native `fetch`), receives raw JSON, validates it with Zod schemas, and runs transforms to typed `TickerInfo`, `Financials`, `KeyMetrics`, `PricePoint[]`, `QuarterlyResult[]`.
6. **Cache write** — Successful provider responses are written back to the cache with the 2-hour TTL.
7. **Web → Scoring Engine** — `apps/web` passes the typed data into `@darkscore/scoring-engine`, which delegates to the active `ScoringStrategy` (`editorial`). The strategy invokes the three component scorers (Valuation 35%, Financial Health 35%, Growth 30%), reads from `thresholds.ts`, and computes a composite `RiskScore` plus a `Rating` label.
8. **Web → DB** — The full `ReportData` object is persisted to PostgreSQL (`reports` table) with `expires_at` set to now + 2h. A row is also written to `score_snapshots` for historical tracking.
9. **Web → Cache** — The assembled `ReportData` is cached for fast subsequent reads.
10. **SSR render** — Next.js renders the React report tree (`TickerBar`, `RiskGauge`, `KPIStrip`, …) into HTML and ships it to the browser.

This flow honors:
- **C1** Adapter Pattern — every external system is behind an interface
- **C2** Cache-First — cache is consulted before every provider call
- **C5** Error Boundaries — `Result<T, E>` propagates failures without throwing
- **C11** Diagrams as Constraints — the path matches the L1 and L2 diagrams exactly
