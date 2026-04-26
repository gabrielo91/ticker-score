/**
 * Pure helpers shared by the three component scorers. Kept colocated under
 * `components/` because they are only meaningful to the scoring math.
 */
import type { MetricStatus } from "../strategies/interface.js";
import type { MetricThreshold } from "../thresholds.js";

/**
 * Linearly interpolate `value` between the `bad` anchor (=> 0) and the
 * `good` anchor (=> 100), respecting `lowerIsBetter`. Out-of-range values
 * clamp to 0 / 100. Returns `null` when the metric is missing so callers can
 * skip it instead of penalising the average.
 */
export function scoreDirectional(
  value: number | null,
  threshold: MetricThreshold,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const { good, bad, lowerIsBetter } = threshold;
  if (good === bad) return 0;
  const span = lowerIsBetter ? bad - good : good - bad;
  const distance = lowerIsBetter ? bad - value : value - bad;
  const raw = (distance / span) * 100;
  return clamp(raw, 0, 100);
}

export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Decide the green/amber/red status for a metric. `amberAt` is the value
 * separating "great" from "watch"; without it we fall back to the midpoint
 * between `good` and `bad`.
 */
export function statusFor(
  value: number | null,
  threshold: MetricThreshold,
): MetricStatus {
  if (value === null || !Number.isFinite(value)) return "unknown";
  const { good, bad, lowerIsBetter, amberAt } = threshold;
  const midpoint = amberAt ?? (good + bad) / 2;
  if (lowerIsBetter) {
    if (value <= midpoint) return "green";
    if (value <= bad) return "amber";
    return "red";
  }
  if (value >= midpoint) return "green";
  if (value >= bad) return "amber";
  return "red";
}

/**
 * Average a list of optional sub-scores, ignoring `null`. Returns `0` when
 * every metric was missing — callers may treat that as "no signal".
 */
export function averageScores(scores: ReadonlyArray<number | null>): number {
  const present = scores.filter(
    (s): s is number => s !== null && Number.isFinite(s),
  );
  if (present.length === 0) return 0;
  const sum = present.reduce((acc, n) => acc + n, 0);
  return sum / present.length;
}

export function roundToInt(n: number): number {
  return Math.round(clamp(n, 0, 100));
}

