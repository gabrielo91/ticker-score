/**
 * Pure helpers for `KPIStrip`: status-threshold logic and cell builders for
 * the six headline metrics. Kept out of the component so JSX stays
 * declarative (C12).
 */
import type { Financials, KeyMetrics } from "@darkscore/types";
import { NOT_AVAILABLE, formatCompact } from "../../lib/format";

export type KpiStatus = "green" | "amber" | "red" | null;

export interface KpiCell {
  readonly label: string;
  readonly value: string;
  readonly status: KpiStatus;
  readonly note: string;
}

export const STATUS_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-[#00dc82]",
  amber: "text-[#ffc107]",
  red: "text-[#ff4757]",
};

export function buildCells(
  metrics: KeyMetrics,
  fin: Financials,
): ReadonlyArray<KpiCell> {
  return [
    {
      label: "P/E (TTM)",
      value: metrics.peRatioTTM !== null ? `${metrics.peRatioTTM.toFixed(1)}x` : NOT_AVAILABLE,
      status: peStatus(metrics.peRatioTTM),
      note: peNote(metrics.peRatioTTM),
    },
    {
      label: "Fwd P/E",
      value:
        metrics.peRatioForward !== null ? `${metrics.peRatioForward.toFixed(1)}x` : NOT_AVAILABLE,
      status: peStatus(metrics.peRatioForward),
      note: forwardPeNote(metrics.peRatioTTM, metrics.peRatioForward),
    },
    {
      label: "Revenue TTM",
      value: formatCompact(fin.revenueTTM, { prefix: "$" }),
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
      value: formatCompact(fin.freeCashFlowTTM, { prefix: "$" }),
      status: fin.freeCashFlowTTM > 0 ? "green" : "red",
      note: fin.freeCashFlowTTM > 0 ? "Positive" : "Negative",
    },
    {
      label: "Debt/Equity",
      value: fin.debtToEquity !== null ? fin.debtToEquity.toFixed(2) : NOT_AVAILABLE,
      status: deStatus(fin.debtToEquity),
      note: deNote(fin.debtToEquity),
    },
  ];
}

function peStatus(pe: number | null): KpiStatus {
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

function deStatus(de: number | null): KpiStatus {
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

