/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders Valuation / Health / Growth horizontal
 * score bars with weights and notes.
 */
import type { ScoreBreakdown as ScoreBreakdownData } from "@darkscore/types";

export interface ScoreBreakdownProps {
  readonly breakdown: ScoreBreakdownData;
}

export function ScoreBreakdown({
  breakdown
}: ScoreBreakdownProps): JSX.Element {
  return (
    <div className="ds-card">
      <h2 className="section-title">Score Breakdown</h2>
      {breakdown.components.map((component) => (
        <div key={component.name} className="mb-4 last:mb-0">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold capitalize">
              {component.name.replace("_", " ")}
            </span>
            <span className="font-mono font-semibold">
              {component.score}{" "}
              <span className="text-text-muted text-xs">
                · {Math.round(component.weight * 100)}%
              </span>
            </span>
          </div>
          <div className="h-2 bg-darkscore-border rounded">
            <div
              className="h-full bg-accent-green rounded"
              style={{ width: `${component.score}%` }}
            />
          </div>
          {component.note !== null ? (
            <div className="text-text-muted text-[11px] mt-1">
              {component.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
