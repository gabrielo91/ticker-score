/**
 * PriceChart — SVG line chart for ~12 months of price history with optional
 * event annotations (earnings dates, capex shocks). Coordinates and paths
 * are pre-computed in helpers; the SVG is responsive via `viewBox`. Pure
 * presentational (C12).
 */
import type { PriceChart as PriceChartData } from "@darkscore/types";
import { PAD_L, PAD_R, PAD_T, PLOT_H, VIEW_H, VIEW_W, annotationColor, buildGeometry, findIndexByDate, project } from "./PriceChart.helpers";

interface PriceChartProps {
  readonly chart: PriceChartData;
}

const CARD = "rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6";
const HEADING = "text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-4";

export function PriceChart({ chart }: PriceChartProps): JSX.Element {
  const { points, min, max } = project(chart.points);
  if (points.length === 0) {
    return (
      <div className={CARD}>
        <div className={HEADING}>12-Month Price History</div>
        <p className="text-sm text-[#8a8f98]">No price history available.</p>
      </div>
    );
  }
  const { linePath, fillPath, yLabels } = buildGeometry(points, min, max);

  return (
    <div className={CARD}>
      <div className={HEADING}>12-Month Price History</div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <g stroke="#1e2130" strokeWidth={1}>
          {yLabels.map((_, i) => {
            const y = PAD_T + (PLOT_H * i) / (yLabels.length - 1);
            const dash = i === yLabels.length - 1 ? undefined : "4";
            return <line key={i} x1={PAD_L} y1={y} x2={VIEW_W - PAD_R} y2={y} strokeDasharray={dash} />;
          })}
        </g>
        <g fill="#64748b" fontFamily="JetBrains Mono, monospace" fontSize={11}>
          {yLabels.map((v, i) => {
            const y = PAD_T + (PLOT_H * i) / (yLabels.length - 1) + 4;
            return <text key={i} x={PAD_L - 8} y={y} textAnchor="end">${v.toFixed(0)}</text>;
          })}
        </g>
        <path d={fillPath} fill="url(#priceFill)" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {chart.annotations.map((ann, i) => {
          const idx = findIndexByDate(points, ann.date);
          if (idx < 0) return null;
          const p = points[idx]!;
          const color = annotationColor(ann.status);
          return (
            <g key={`${ann.date}-${i}`}>
              <circle cx={p.x} cy={p.y} r={5} fill={color} />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize={10} fill={color}>{ann.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

