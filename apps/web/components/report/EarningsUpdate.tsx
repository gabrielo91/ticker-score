/**
 * Stub for W3-3 — replaced by the real implementation in
 * `feat/w3-page2-components`. Renders the latest earnings highlights and any
 * upcoming earnings guidance.
 */
import type { LatestEarnings } from "@darkscore/types";

export interface EarningsUpdateProps {
  readonly earnings: LatestEarnings;
}

export function EarningsUpdate({
  earnings,
}: EarningsUpdateProps): JSX.Element {
  return (
    <div className="ds-card">
      <h2 className="section-title">Latest Earnings</h2>
      <div className="text-sm font-semibold mb-3">
        {earnings.quarter}
        <span className="text-text-muted font-normal ml-2 text-xs">
          reported {earnings.reportedAt}
        </span>
      </div>
      <dl>
        {earnings.highlights.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center py-2 border-b border-darkscore-border last:border-b-0 text-sm"
          >
            <dt className="text-text-muted">{item.label}</dt>
            <dd className="font-mono font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
      {earnings.upcoming !== null ? (
        <div className="mt-4 pt-4 border-t border-darkscore-border text-xs text-text-muted">
          Next: {earnings.upcoming.quarter} on{" "}
          {earnings.upcoming.nextEarningsDate}
        </div>
      ) : null}
    </div>
  );
}
