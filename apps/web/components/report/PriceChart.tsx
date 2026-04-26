/**
 * PriceChart — SVG line chart for ~12 months of price history with optional
 * event annotations (earnings dates, capex shocks). Coordinates are computed
 * pure-functionally from the price series; the SVG is responsive via
 * `viewBox` so the parent controls width. The component takes the full
 * `PriceChart` payload (points + annotations) per `ReportData`.
 */
import type { PriceChart as PriceChartData } from "@darkscore/types";

interface PriceChartProps {
  readonly chart: PriceChartData;
}

const VIEW_W = 1000;
const VIEW_H = 320;
const PAD_L = 60;
const PAD_R = 30;
const PAD_T = 30;
const PAD_B = 50;
const PLOT_W = VIEW_W - PAD_L - PAD_R;
const PLOT_H = VIEW_H - PAD_T - PAD_B;

interface PlotPoint {
  readonly x: number;
  readonly y: number;
  readonly date: string;
  readonly close: number;
}

interface ProjectedSeries {
  readonly points: ReadonlyArray<PlotPoint>;
  readonly min: number;
  readonly max: number;
}

function project(prices: ReadonlyArray<{ date: string; close: number }>): ProjectedSeries {
  if (prices.length === 0) return { points: [], min: 0, max: 0 };
  const closes = prices.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = prices.length > 1 ? PLOT_W / (prices.length - 1) : 0;
  const points = prices.map((p, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((p.close - min) / range) * PLOT_H,
    date: p.date,
    close: p.close,
  }));
  return { points, min, max };
}

function findIndexByDate(points: ReadonlyArray<PlotPoint>, date: string): number {
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.date === date) return i;
  }
  return -1;
}

function annotationColor(status: "green" | "amber" | "red" | "blue"): string {
  if (status === "green") return "#00dc82";
  if (status === "red") return "#ff4757";
  if (status === "amber") return "#ffc107";
  return "#06b6d4";
}

export function PriceChart({ chart }: PriceChartProps): JSX.Element {
  const { points, min, max } = project(chart.points);
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6">
        <div className="text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-4">
          12-Month Price History
        </div>
        <p className="text-sm text-[#8a8f98]">No price history available.</p>
      </div>
    );
  }
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const fillPath = `${linePath} L${last.x.toFixed(1)},${PAD_T + PLOT_H} L${first.x.toFixed(1)},${PAD_T + PLOT_H} Z`;
  const yLabels = [max, min + (max - min) * 0.66, min + (max - min) * 0.33, min];

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6">
      <div className="text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-4">
        12-Month Price History
      </div>
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
            return (
              <line
                key={i}
                x1={PAD_L}
                y1={y}
                x2={VIEW_W - PAD_R}
                y2={y}
                strokeDasharray={i === yLabels.length - 1 ? undefined : "4"}
              />
            );
          })}
        </g>
        <g fill="#64748b" fontFamily="JetBrains Mono, monospace" fontSize={11}>
          {yLabels.map((v, i) => (
            <text
              key={i}
              x={PAD_L - 8}
              y={PAD_T + (PLOT_H * i) / (yLabels.length - 1) + 4}
              textAnchor="end"
            >
              ${v.toFixed(0)}
            </text>
          ))}
        </g>
        <path d={fillPath} fill="url(#priceFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chart.annotations.map((ann, i) => {
          const idx = findIndexByDate(points, ann.date);
          if (idx < 0) return null;
          const p = points[idx]!;
          const color = annotationColor(ann.status);
          return (
            <g key={`${ann.date}-${i}`}>
              <circle cx={p.x} cy={p.y} r={5} fill={color} />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize={10} fill={color}>
                {ann.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

