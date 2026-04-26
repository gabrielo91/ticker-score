/**
 * Pure helpers for `RiskGauge`: zone-color lookup and gauge geometry. Kept
 * out of the component so JSX stays declarative (C12).
 */

interface Zone {
  readonly max: number;
  readonly color: string;
}

export const RISK_ZONES: ReadonlyArray<Zone> = [
  { max: 20, color: "#00dc82" },
  { max: 40, color: "#84cc16" },
  { max: 60, color: "#ffc107" },
  { max: 80, color: "#fb923c" },
  { max: 100, color: "#ff4757" },
];

export const RADIUS = 80;
export const STROKE = 14;
export const CIRCUMFERENCE = Math.PI * RADIUS;

export function colorForScore(score: number): string {
  for (const zone of RISK_ZONES) {
    if (score <= zone.max) return zone.color;
  }
  return RISK_ZONES[RISK_ZONES.length - 1]!.color;
}

