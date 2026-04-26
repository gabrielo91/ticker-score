/**
 * Score → Rating + risk-label mapping used by the editorial strategy. The
 * composite score is a RISK score (higher = worse), so a low composite maps
 * to BUY-side ratings and a high composite maps to SELL-side ratings.
 */
import { Rating } from "@darkscore/types";

export interface RatingBreakpoint {
  readonly maxRisk: number;
  readonly rating: Rating;
  readonly riskLabel: string;
}

/**
 * Breakpoints listed by ascending `maxRisk`. The first breakpoint whose
 * `maxRisk` is >= the composite risk wins. The last entry is open-ended at 100.
 */
export const EDITORIAL_RATING_BREAKPOINTS: ReadonlyArray<RatingBreakpoint> = [
  { maxRisk: 20, rating: Rating.STRONG_BUY, riskLabel: "Low Risk" },
  { maxRisk: 40, rating: Rating.BUY, riskLabel: "Low-Moderate Risk" },
  { maxRisk: 60, rating: Rating.HOLD, riskLabel: "Moderate Risk" },
  { maxRisk: 75, rating: Rating.SELL, riskLabel: "Moderate-High Risk" },
  { maxRisk: 100, rating: Rating.STRONG_SELL, riskLabel: "High Risk" },
];

export function determineRating(
  compositeRisk: number,
  breakpoints: ReadonlyArray<RatingBreakpoint> = EDITORIAL_RATING_BREAKPOINTS,
): Rating {
  return resolveBreakpoint(compositeRisk, breakpoints).rating;
}

export function determineRiskLabel(
  compositeRisk: number,
  breakpoints: ReadonlyArray<RatingBreakpoint> = EDITORIAL_RATING_BREAKPOINTS,
): string {
  return resolveBreakpoint(compositeRisk, breakpoints).riskLabel;
}

/**
 * Position of the composite risk on the 0-100 axis, clamped. Useful for
 * gauge rendering (the report's risk dial).
 */
export function ratingPosition(compositeRisk: number): number {
  if (compositeRisk < 0) return 0;
  if (compositeRisk > 100) return 100;
  return compositeRisk;
}

function resolveBreakpoint(
  compositeRisk: number,
  breakpoints: ReadonlyArray<RatingBreakpoint>,
): RatingBreakpoint {
  if (breakpoints.length === 0) {
    throw new Error("rating: at least one breakpoint required");
  }
  const clamped = ratingPosition(compositeRisk);
  for (const bp of breakpoints) {
    if (clamped <= bp.maxRisk) return bp;
  }
  const last = breakpoints[breakpoints.length - 1];
  if (!last) {
    throw new Error("rating: breakpoint list unexpectedly empty");
  }
  return last;
}

