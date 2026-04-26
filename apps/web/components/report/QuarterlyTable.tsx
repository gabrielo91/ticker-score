/**
 * Quarterly trend table — renders a row per QuarterlyResult with revenue,
 * net margin, EPS, and YoY revenue growth. Mirrors the legacy `q-table`
 * section in `legacy/index.html`.
 *
 * Pure presentational (C12). All derivations live above the JSX.
 */
import type { QuarterlyResult } from "@darkscore/types";

interface QuarterlyTableProps {
  readonly quarters: ReadonlyArray<QuarterlyResult>;
}

interface QuarterlyRow {
  readonly key: string;
  readonly quarter: string;
  readonly revenue: string;
  readonly netMargin: string;
  readonly eps: string;
  readonly yoyGrowth: string;
  readonly yoyPositive: boolean;
}

const REVENUE_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function toRow(q: QuarterlyResult): QuarterlyRow {
  const netMarginPct =
    q.netIncome !== null && q.revenue !== 0
      ? (q.netIncome / q.revenue) * 100
      : null;
  return {
    key: `${q.fiscalYear}-${q.quarter}`,
    quarter: `${q.quarter} ${q.fiscalYear}`,
    revenue: `$${REVENUE_FORMATTER.format(q.revenue)}`,
    netMargin: netMarginPct !== null ? `${netMarginPct.toFixed(1)}%` : "—",
    eps: `$${q.eps.toFixed(2)}`,
    yoyGrowth: `${q.revenueGrowthYoYPercent >= 0 ? "+" : ""}${q.revenueGrowthYoYPercent.toFixed(1)}%`,
    yoyPositive: q.revenueGrowthYoYPercent >= 0,
  };
}

export function QuarterlyTable({ quarters }: QuarterlyTableProps): JSX.Element {
  const rows = quarters.map(toRow);
  return (
    <section className="rounded-xl border border-zinc-800 bg-[#11131a] p-6 mb-6 overflow-x-auto">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0] mb-4">
        Quarterly Trend
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[#8a8f98] border-b border-zinc-800">
            <th className="py-2 pr-4 font-medium">Quarter</th>
            <th className="py-2 pr-4 font-medium">Revenue</th>
            <th className="py-2 pr-4 font-medium">Net Margin</th>
            <th className="py-2 pr-4 font-medium">EPS</th>
            <th className="py-2 font-medium">YoY Growth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.key}
              className={i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/40"}
            >
              <td className="py-2 pr-4 font-medium text-[#f0f0f0]">
                {row.quarter}
              </td>
              <td className="py-2 pr-4 font-mono text-[#f0f0f0]">
                {row.revenue}
              </td>
              <td className="py-2 pr-4 font-mono text-[#f0f0f0]">
                {row.netMargin}
              </td>
              <td className="py-2 pr-4 font-mono text-[#f0f0f0]">{row.eps}</td>
              <td
                className={`py-2 font-mono ${row.yoyPositive ? "text-[#00dc82]" : "text-[#ff4757]"}`}
              >
                {row.yoyGrowth}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

