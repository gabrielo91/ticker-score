/**
 * Pure helpers for `PriceChart`: SVG dimensions, projection from price
 * series to plot coordinates, geometry/path building, and annotation
 * lookup. Kept out of the component so JSX stays declarative (C12).
 */

export const VIEW_W = 1000;
export const VIEW_H = 320;
export const PAD_L = 60;
export const PAD_R = 30;
export const PAD_T = 30;
export const PAD_B = 50;
export const PLOT_W = VIEW_W - PAD_L - PAD_R;
export const PLOT_H = VIEW_H - PAD_T - PAD_B;

export interface PlotPoint {
  readonly x: number;
  readonly y: number;
  readonly date: string;
  readonly close: number;
}

export interface ProjectedSeries {
  readonly points: ReadonlyArray<PlotPoint>;
  readonly min: number;
  readonly max: number;
}

export function project(
  prices: ReadonlyArray<{ date: string; close: number }>,
): ProjectedSeries {
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

export function findIndexByDate(
  points: ReadonlyArray<PlotPoint>,
  date: string,
): number {
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.date === date) return i;
  }
  return -1;
}

export function annotationColor(
  status: "green" | "amber" | "red" | "blue",
): string {
  if (status === "green") return "#00dc82";
  if (status === "red") return "#ff4757";
  if (status === "amber") return "#ffc107";
  return "#06b6d4";
}

export interface PlotGeometry {
  readonly linePath: string;
  readonly fillPath: string;
  readonly yLabels: ReadonlyArray<number>;
}

export function buildGeometry(
  points: ReadonlyArray<PlotPoint>,
  min: number,
  max: number,
): PlotGeometry {
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const fillPath = `${linePath} L${last.x.toFixed(1)},${PAD_T + PLOT_H} L${first.x.toFixed(1)},${PAD_T + PLOT_H} Z`;
  const yLabels = [max, min + (max - min) * 0.66, min + (max - min) * 0.33, min];
  return { linePath, fillPath, yLabels };
}

