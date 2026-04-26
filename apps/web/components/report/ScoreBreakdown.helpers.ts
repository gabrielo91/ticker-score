/**
 * Pure helpers for `ScoreBreakdown`: bar gradients and composite-score
 * color. Kept out of the component so JSX stays declarative (C12).
 */
import type { ComponentScore } from "@darkscore/types";

export const COMPONENT_LABELS: Record<ComponentScore["name"], string> = {
  valuation: "Valuation Score",
  financial_health: "Financial Health Score",
  growth: "Growth Score",
};

export function barColor(score: number): string {
  if (score >= 70) return "linear-gradient(90deg,#00dc82,#06b6d4)";
  if (score >= 40) return "linear-gradient(90deg,#ffc107,#00dc82)";
  return "linear-gradient(90deg,#ff4757,#ffc107)";
}

export function compositeColor(score: number): string {
  if (score <= 40) return "#00dc82";
  if (score <= 70) return "#ffc107";
  return "#ff4757";
}

