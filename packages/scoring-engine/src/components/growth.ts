/**
 * Growth scorer (30% weight). Inputs: `GrowthData`. Combines trailing
 * revenue growth with forward revenue, earnings, and EBITDA growth. Forward
 * estimates that are missing simply drop out of the average.
 */
import type { ComponentScore, GrowthData } from "@darkscore/types";
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
  readonly thresholdKey: keyof ScoringThresholds["growth"];
}

export function evaluateGrowth(
  growth: GrowthData,
  thresholds: ScoringThresholds = EDITORIAL_THRESHOLDS,
): ComponentResult {
  const specs: ReadonlyArray<MetricSpec> = [
    {
      key: "revenueGrowthYoY",
      label: "Revenue Growth (YoY)",
      value: growth.revenueGrowthYoY,
      thresholdKey: "revenueGrowthYoY",
    },
    {
      key: "revenueGrowthForward",
      label: "Revenue Growth (Fwd)",
      value: growth.revenueGrowthForward,
      thresholdKey: "revenueGrowthForward",
    },
    {
      key: "earningsGrowthForward",
      label: "Earnings Growth (Fwd)",
      value: growth.earningsGrowthForward,
      thresholdKey: "earningsGrowthForward",
    },
    {
      key: "ebitdaGrowthForward",
      label: "EBITDA Growth (Fwd)",
      value: growth.ebitdaGrowthForward,
      thresholdKey: "ebitdaGrowthForward",
    },
  ];

  const assessments: MetricAssessment[] = specs.map((spec) => {
    const threshold = thresholds.growth[spec.thresholdKey];
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
    name: "growth",
    score,
    weight: thresholds.weights.growth,
    note: noteFor(present.length, assessments.length),
  };

  return { summary, metrics: assessments };
}

function noteFor(present: number, total: number): string | null {
  if (present === 0) return "No growth metrics available";
  if (present < total) return `${present}/${total} metrics evaluated`;
  return null;
}

