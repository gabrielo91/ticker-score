/**
 * EditorialStrategy — the heuristic that produced the static legacy reports.
 * Combines the three component scorers via the editorial weights, inverts to
 * a risk score (higher = worse), and maps to a Rating + risk label.
 */
import type {
  ComponentScore,
  Financials,
  GrowthData,
  KeyMetrics,
  Rating,
} from "@darkscore/types";
import { evaluateFinancialHealth } from "../components/financial-health.js";
import { evaluateGrowth } from "../components/growth.js";
import { evaluateValuation } from "../components/valuation.js";
import {
  determineRating,
  determineRiskLabel,
  EDITORIAL_RATING_BREAKPOINTS,
  ratingPosition,
  type RatingBreakpoint,
} from "../rating.js";
import {
  EDITORIAL_THRESHOLDS,
  type ScoringThresholds,
} from "../thresholds.js";
import type {
  ComponentResult,
  CompositeResult,
  ScoringStrategy,
} from "./interface.js";

export interface EditorialStrategyOptions {
  readonly thresholds?: ScoringThresholds;
  readonly breakpoints?: ReadonlyArray<RatingBreakpoint>;
}

export class EditorialStrategy implements ScoringStrategy {
  public readonly name = "editorial";
  public readonly version = "1.0.0";

  private readonly thresholds: ScoringThresholds;
  private readonly breakpoints: ReadonlyArray<RatingBreakpoint>;

  constructor(options: EditorialStrategyOptions = {}) {
    this.thresholds = options.thresholds ?? EDITORIAL_THRESHOLDS;
    this.breakpoints = options.breakpoints ?? EDITORIAL_RATING_BREAKPOINTS;
  }

  computeValuationScore(metrics: KeyMetrics): ComponentResult {
    return evaluateValuation(metrics, this.thresholds);
  }

  computeHealthScore(financials: Financials): ComponentResult {
    return evaluateFinancialHealth(financials, this.thresholds);
  }

  computeGrowthScore(growth: GrowthData): ComponentResult {
    return evaluateGrowth(growth, this.thresholds);
  }

  computeComposite(
    components: ReadonlyArray<ComponentScore>,
  ): CompositeResult {
    const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
    const weightedSum = components.reduce(
      (acc, c) => acc + c.score * c.weight,
      0,
    );
    const weightedAverage = totalWeight === 0 ? 0 : weightedSum / totalWeight;
    const composite = Math.round(clamp(100 - weightedAverage, 0, 100));
    return {
      composite,
      rating: determineRating(composite, this.breakpoints),
      ratingPosition: ratingPosition(composite),
      riskLabel: determineRiskLabel(composite, this.breakpoints),
    };
  }

  determineRating(compositeRisk: number): Rating {
    return determineRating(compositeRisk, this.breakpoints);
  }
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

