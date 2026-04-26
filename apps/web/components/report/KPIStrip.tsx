/**
 * KPIStrip — six headline metrics rendered as mini-cards. The strip covers
 * both valuation (KeyMetrics) and quality/health (Financials), so it takes
 * both objects as props. Status thresholds live in helpers (C12: no business
 * logic in JSX); each card receives a precomputed status color class.
 */
import type { Financials, KeyMetrics } from "@darkscore/types";

interface KPIStripProps {
  readonly keyMetrics: KeyMetrics;
  readonly financials: Financials;
}

interface KpiCell {
  readonly label: string;
  readonly value: string;
  readonly status: "green" | "amber" | "red" | null;
  readonly note: string;
}

const STATUS_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-[#00dc82]",
  amber: "text-[#ffc107]",
  red: "text-[#ff4757]",
};

function buildCells(metrics: KeyMetrics, fin: Financials): ReadonlyArray<KpiCell> {
  return [
    {
      label: "P/E (TTM)",
      value: metrics.peRatioTTM !== null ? `${metrics.peRatioTTM.toFixed(1)}x` : "—",
      status: peStatus(metrics.peRatioTTM),
      note: peNote(metrics.peRatioTTM),
    },
    {
      label: "Fwd P/E",
      value:
        metrics.peRatioForward !== null ? `${metrics.peRatioForward.toFixed(1)}x` : "—",
      status: peStatus(metrics.peRatioForward),
      note: forwardPeNote(metrics.peRatioTTM, metrics.peRatioForward),
    },
    {
      label: "Revenue TTM",
      value: formatCompact(fin.revenueTTM),
      status: fin.revenueTTM > 0 ? "green" : "red",
      note: "Trailing 12 months",
    },
    {
      label: "Net Margin",
      value: `${(fin.netMargin * 100).toFixed(1)}%`,
      status: marginStatus(fin.netMargin),
      note: marginNote(fin.netMargin),
    },
    {
      label: "FCF TTM",
      value: formatCompact(fin.freeCashFlowTTM),
      status: fin.freeCashFlowTTM > 0 ? "green" : "red",
      note: fin.freeCashFlowTTM > 0 ? "Positive" : "Negative",
    },
    {
      label: "Debt/Equity",
      value: fin.debtToEquity !== null ? fin.debtToEquity.toFixed(2) : "—",
      status: deStatus(fin.debtToEquity),
      note: deNote(fin.debtToEquity),
    },
  ];
}

function peStatus(pe: number | null): "green" | "amber" | "red" | null {
  if (pe === null) return null;
  if (pe <= 0) return "red";
  if (pe < 20) return "green";
  if (pe < 35) return "amber";
  return "red";
}

function peNote(pe: number | null): string {
  if (pe === null || pe <= 0) return "Not meaningful";
  if (pe < 20) return "Below avg";
  if (pe < 35) return "Above avg";
  return "Expensive";
}

function forwardPeNote(ttm: number | null, fwd: number | null): string {
  if (ttm === null || fwd === null) return "—";
  if (fwd < ttm) return "Compression";
  return "Expansion";
}

function marginStatus(margin: number): "green" | "amber" | "red" {
  if (margin >= 0.1) return "green";
  if (margin >= 0.05) return "amber";
  return "red";
}

function marginNote(margin: number): string {
  if (margin >= 0.1) return "Strong";
  if (margin >= 0.05) return "Moderate";
  if (margin >= 0) return "Thin";
  return "Negative";
}

function deStatus(de: number | null): "green" | "amber" | "red" | null {
  if (de === null) return null;
  if (de < 0.5) return "green";
  if (de < 1) return "amber";
  return "red";
}

function deNote(de: number | null): string {
  if (de === null) return "—";
  if (de < 0.5) return "Manageable";
  if (de < 1) return "Elevated";
  return "High";
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function KPIStrip({ keyMetrics, financials }: KPIStripProps): JSX.Element {
  const cells = buildCells(keyMetrics, financials);
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {cells.map((cell) => {
        const colorClass = cell.status !== null ? STATUS_TEXT[cell.status] : "text-[#f0f0f0]";
        return (
          <div
            key={cell.label}
            className="rounded-xl border border-[#1e2130] bg-[#11131a] p-3 text-center"
          >
            <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">
              {cell.label}
            </div>
            <div className={`font-mono text-lg font-bold ${colorClass}`}>{cell.value}</div>
            <div className={`text-[10px] mt-1 ${colorClass}`}>{cell.note}</div>
          </div>
        );
      })}
    </div>
  );
}

