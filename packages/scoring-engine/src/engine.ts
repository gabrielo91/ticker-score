/**
 * Scoring engine entry point. Wraps a `ScoringStrategy` to:
 *  - run all three component scorers
 *  - call the strategy's composite calculation
 *  - attach `computedAt`/strategy metadata that the strategy itself MUST NOT
 *    produce (per CONSTITUTION: no `Date.now()` inside scoring math)
 *  - return a `Result` so callers handle errors without a try/catch
 */
import type {
  Financials,
  GrowthData,
  KeyMetrics,
  ScoreBreakdown,
} from "@darkscore/types";
import { err, ok, type Result } from "@darkscore/types";
import type {
  ComponentResult,
  ScoringStrategy,
} from "./strategies/interface.js";

export interface ScoringInput {
  readonly metrics: KeyMetrics;
  readonly financials: Financials;
  readonly growth: GrowthData;
  /** ISO 8601 timestamp injected by the caller. Strategies are pure. */
  readonly computedAt: string;
}

export interface ScoringResult {
  readonly breakdown: ScoreBreakdown;
  readonly components: {
    readonly valuation: ComponentResult;
    readonly financialHealth: ComponentResult;
    readonly growth: ComponentResult;
  };
}

export class ScoringError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ScoringError";
    this.cause = cause;
  }
}

export function runScoring(
  input: ScoringInput,
  strategy: ScoringStrategy,
): Result<ScoringResult, ScoringError> {
  try {
    const valuation = strategy.computeValuationScore(input.metrics);
    const financialHealth = strategy.computeHealthScore(input.financials);
    const growth = strategy.computeGrowthScore(input.growth);

    const components = [
      valuation.summary,
      financialHealth.summary,
      growth.summary,
    ];

    const composite = strategy.computeComposite(components);

    const breakdown: ScoreBreakdown = {
      components,
      composite: {
        composite: composite.composite,
        rating: composite.rating,
        ratingPosition: composite.ratingPosition,
        riskLabel: composite.riskLabel,
        strategy: strategy.name,
        strategyVersion: strategy.version,
        computedAt: input.computedAt,
      },
    };

    return ok({
      breakdown,
      components: { valuation, financialHealth, growth },
    });
  } catch (cause) {
    return err(new ScoringError("Scoring failed", cause));
  }
}

