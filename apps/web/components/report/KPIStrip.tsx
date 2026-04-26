/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders the 4-up KPI grid below the ticker bar.
 */
import type { KpiHighlight } from "@darkscore/types";

export interface KPIStripProps {
  readonly items: ReadonlyArray<KpiHighlight>;
}

export function KPIStrip({ items }: KPIStripProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="ds-card text-center py-4">
          <div className="text-text-muted text-[10px] uppercase tracking-[0.1em] mb-1.5">
            {item.label}
          </div>
          <div className="font-mono text-lg font-bold">{item.value}</div>
          {item.note !== null ? (
            <div className={`mt-1 text-[10px] status-${item.status ?? "amber"}`}>
              {item.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
