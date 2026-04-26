/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders the conic-gradient risk gauge with the
 * composite score and rating label in the centre.
 */
import type { RiskScore } from "@darkscore/types";

export interface RiskGaugeProps {
  readonly riskScore: RiskScore;
}

export function RiskGauge({ riskScore }: RiskGaugeProps): JSX.Element {
  return (
    <div className="ds-card flex flex-col items-center py-8">
      <div className="font-mono text-5xl font-bold">{riskScore.composite}</div>
      <div className="font-mono text-text-muted text-base">/ 100</div>
      <div className="mt-3 text-base font-semibold tracking-wider status-green">
        {riskScore.rating.replace("_", " ")}
      </div>
      <div className="mt-1 text-text-muted text-xs">{riskScore.riskLabel}</div>
    </div>
  );
}
