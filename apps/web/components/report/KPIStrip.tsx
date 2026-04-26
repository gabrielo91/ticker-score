/**
 * KPIStrip — six headline metrics rendered as mini-cards. The strip covers
 * both valuation (KeyMetrics) and quality/health (Financials). Status
 * thresholds and cell construction live in helpers (C12: no business logic
 * in JSX); each card receives a precomputed status color class.
 */
import type { Financials, KeyMetrics } from "@darkscore/types";
import { STATUS_TEXT, buildCells } from "./KPIStrip.helpers";

interface KPIStripProps {
  readonly keyMetrics: KeyMetrics;
  readonly financials: Financials;
}

export function KPIStrip({ keyMetrics, financials }: KPIStripProps): JSX.Element {
  const cells = buildCells(keyMetrics, financials);
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {cells.map((cell) => {
        const colorClass =
          cell.status !== null ? STATUS_TEXT[cell.status] : "text-[#f0f0f0]";
        return (
          <div
            key={cell.label}
            className="rounded-xl border border-[#1e2130] bg-[#11131a] p-3 text-center"
          >
            <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">
              {cell.label}
            </div>
            <div className={`font-mono text-lg font-bold ${colorClass}`}>
              {cell.value}
            </div>
            <div className={`text-[10px] mt-1 ${colorClass}`}>{cell.note}</div>
          </div>
        );
      })}
    </div>
  );
}

