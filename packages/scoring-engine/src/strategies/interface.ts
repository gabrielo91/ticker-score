/**
 * ScoringStrategy — the adapter contract for swappable scoring approaches
 * (Constitution C1). All implementations MUST be deterministic and pure: no
 * I/O, no `Date.now()`, no randomness. Timestamps and metadata are attached
 * by the engine, not the strategy.
 */
import type {
  ComponentScore,
  Financials,
  GrowthData,
  KeyMetrics,
  Rating,
} from "@darkscore/types";

export type MetricStatus = "green" | "amber" | "red" | "unknown";

/**
 * Per-metric assessment used to render the report cards (one row per metric
 * with its raw value, sub-score, and traffic-light status).
 */
export interface MetricAssessment {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly score: number;
  readonly status: MetricStatus;
}

/**
 * Result of scoring one component (valuation, financial health, growth):
 * the aggregate `summary` (which matches the wire-level `ComponentScore`)
 * plus the per-metric breakdown that drives the card UI.
 */
export interface ComponentResult {
  readonly summary: ComponentScore;
  readonly metrics: ReadonlyArray<MetricAssessment>;
}

/**
 * Output of `computeComposite` — the strategy decides composite/rating but
 * does not own the timestamp or strategy metadata, which the engine attaches.
 */
export interface CompositeResult {
  readonly composite: number;
  readonly rating: Rating;
  readonly ratingPosition: number;
  readonly riskLabel: string;
}

export interface ScoringStrategy {
  readonly name: string;
  readonly version: string;

  computeValuationScore(metrics: KeyMetrics): ComponentResult;
  computeHealthScore(financials: Financials): ComponentResult;
  computeGrowthScore(growth: GrowthData): ComponentResult;

  computeComposite(
    components: ReadonlyArray<ComponentScore>,
  ): CompositeResult;

  determineRating(compositeRisk: number): Rating;
}

