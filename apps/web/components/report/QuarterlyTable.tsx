/**
 * Stub for W3-3 — replaced by the real implementation in
 * `feat/w3-page2-components`. Renders the trailing-quarters table with
 * revenue, growth, operating income, margin, and EPS columns.
 */
import type { QuarterlyResult } from "@darkscore/types";

export interface QuarterlyTableProps {
  readonly quarters: ReadonlyArray<QuarterlyResult>;
}

export function QuarterlyTable({
  quarters,
}: QuarterlyTableProps): JSX.Element {
  return (
    <div className="ds-card overflow-x-auto">
      <h2 className="section-title">Quarterly Results</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-text-muted text-[11px] uppercase tracking-[0.1em]">
            <th className="text-left py-2 px-3 border-b border-darkscore-border">
              Quarter
            </th>
            <th className="text-right py-2 px-3 border-b border-darkscore-border">
              Revenue
            </th>
            <th className="text-right py-2 px-3 border-b border-darkscore-border">
              YoY %
            </th>
            <th className="text-right py-2 px-3 border-b border-darkscore-border">
              Op Margin
            </th>
            <th className="text-right py-2 px-3 border-b border-darkscore-border">
              EPS
            </th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {quarters.map((q) => (
            <tr key={q.quarter} className="text-text-muted">
              <td className="py-2 px-3 border-b border-darkscore-border">
                {q.quarter}
              </td>
              <td className="py-2 px-3 text-right border-b border-darkscore-border">
                {q.revenue.toFixed(0)}
              </td>
              <td className="py-2 px-3 text-right border-b border-darkscore-border">
                {q.revenueGrowthYoYPercent.toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right border-b border-darkscore-border">
                {q.operatingMarginPercent.toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right border-b border-darkscore-border">
                {q.eps.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
