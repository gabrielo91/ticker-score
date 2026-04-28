/**
 * KPIStrip — six headline metrics rendered as mini-cards. The strip covers
 * both valuation (KeyMetrics) and quality/health (Financials). Status
 * thresholds and cell construction live in helpers (C12: no business logic
 * in JSX); each card receives a precomputed status color class.
 */
import type {
  Financials,
  ForwardEstimateConfidence,
  KeyMetrics,
} from "@darkscore/types";
import { STATUS_TEXT, buildCells } from "./KPIStrip.helpers";
import { AIBadge } from "./AIBadge";

interface KPIStripProps {
  readonly keyMetrics: KeyMetrics;
  readonly financials: Financials;
  /** W5-3: confidence level when `Fwd P/E` was AI-estimated; `null` when the
   * provider supplied the value (or no narrative is available). */
  readonly aiForwardConfidence?: ForwardEstimateConfidence | null;
}

export function KPIStrip({
  keyMetrics,
  financials,
  aiForwardConfidence = null,
}: KPIStripProps): JSX.Element {
  const cells = buildCells(keyMetrics, financials, aiForwardConfidence);
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
              {cell.aiConfidence !== null ? (
                <AIBadge confidence={cell.aiConfidence} />
              ) : null}
            </div>
            <div className={`text-[10px] mt-1 ${colorClass}`}>{cell.note}</div>
          </div>
        );
      })}
    </div>
  );
}

