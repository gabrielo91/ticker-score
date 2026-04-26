/**
 * Financial-health scorer (35% weight). Inputs: `Financials`. Combines
 * leverage (D/E), liquidity (current ratio), profitability (net margin, ROE)
 * and cash conversion (FCF margin) into a single 0-100 score.
 */
import type { ComponentScore, Financials } from "@darkscore/types";
import type {
  ComponentResult,
  MetricAssessment,
} from "../strategies/interface.js";
import {
  EDITORIAL_THRESHOLDS,
  type ScoringThresholds,
} from "../thresholds.js";
import {
  averageScores,
  roundToInt,
  scoreDirectional,
  statusFor,
} from "./score-helpers.js";

interface MetricSpec {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly thresholdKey: keyof ScoringThresholds["financialHealth"];
}

export function evaluateFinancialHealth(
  financials: Financials,
  thresholds: ScoringThresholds = EDITORIAL_THRESHOLDS,
): ComponentResult {
  const fcfMargin =
    financials.revenueTTM > 0
      ? (financials.freeCashFlowTTM / financials.revenueTTM) * 100
      : null;

  const specs: ReadonlyArray<MetricSpec> = [
    {
      key: "debtToEquity",
      label: "Debt / Equity",
      value: financials.debtToEquity,
      thresholdKey: "debtToEquity",
    },
    {
      key: "currentRatio",
      label: "Current Ratio",
      value: financials.currentRatio,
      thresholdKey: "currentRatio",
    },
    {
      key: "netMargin",
      label: "Net Margin",
      value: financials.netMargin,
      thresholdKey: "netMargin",
    },
    {
      key: "fcfMargin",
      label: "FCF Margin",
      value: fcfMargin,
      thresholdKey: "fcfMargin",
    },
    {
      key: "returnOnEquity",
      label: "ROE",
      value: financials.returnOnEquity,
      thresholdKey: "returnOnEquity",
    },
  ];

  const assessments: MetricAssessment[] = specs.map((spec) => {
    const threshold = thresholds.financialHealth[spec.thresholdKey];
    const sub = scoreDirectional(spec.value, threshold);
    return {
      key: spec.key,
      label: spec.label,
      value: spec.value,
      score: sub === null ? 0 : roundToInt(sub),
      status: statusFor(spec.value, threshold),
    };
  });

  const present = assessments.filter((a) => a.status !== "unknown");
  const score = roundToInt(
    averageScores(present.map((a) => a.score)),
  );

  const summary: ComponentScore = {
    name: "financial_health",
    score,
    weight: thresholds.weights.financialHealth,
    note: noteFor(present.length, assessments.length),
  };

  return { summary, metrics: assessments };
}

function noteFor(present: number, total: number): string | null {
  if (present === 0) return "No financial-health metrics available";
  if (present < total) return `${present}/${total} metrics evaluated`;
  return null;
}

