/**
 * @darkscore/scoring-engine — public surface. Named exports only (per
 * package CONSTITUTION). Importers should depend on this entry point so
 * the boundary checker can verify cross-package usage.
 */
export const PACKAGE_NAME = "@darkscore/scoring-engine";

export {
  runScoring,
  ScoringError,
  type ScoringInput,
  type ScoringResult,
} from "./engine.js";

export {
  EditorialStrategy,
  type EditorialStrategyOptions,
} from "./strategies/editorial.js";

export {
  type ComponentResult,
  type CompositeResult,
  type MetricAssessment,
  type MetricStatus,
  type ScoringStrategy,
} from "./strategies/interface.js";

export { evaluateValuation } from "./components/valuation.js";
export { evaluateFinancialHealth } from "./components/financial-health.js";
export { evaluateGrowth } from "./components/growth.js";

export {
  EDITORIAL_THRESHOLDS,
  type ComponentWeights,
  type FinancialHealthThresholds,
  type GrowthThresholds,
  type MetricThreshold,
  type ScoringThresholds,
  type ValuationThresholds,
} from "./thresholds.js";

export {
  determineRating,
  determineRiskLabel,
  EDITORIAL_RATING_BREAKPOINTS,
  ratingPosition,
  type RatingBreakpoint,
} from "./rating.js";
