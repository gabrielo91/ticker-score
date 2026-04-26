/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders the SVG price line chart with optional
 * earnings/event annotations.
 */
import type { PriceChart as PriceChartData } from "@darkscore/types";

export interface PriceChartProps {
  readonly chart: PriceChartData;
}

export function PriceChart({ chart }: PriceChartProps): JSX.Element {
  const points = chart.points;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className="ds-card">
      <div className="section-title">Price History</div>
      <div className="text-text-muted text-sm font-mono">
        {points.length} points
        {first !== undefined && last !== undefined
          ? ` · ${first.date} → ${last.date}`
          : null}
      </div>
    </div>
  );
}
