/**
 * Valuation scorer (35% weight). Inputs: `KeyMetrics`. The component score is
 * the unweighted average of the available metric sub-scores; missing metrics
 * (e.g. `priceToBook` for AMZN) are skipped, not penalised.
 */
import type { ComponentScore, KeyMetrics } from "@darkscore/types";
import type { ComponentResult, MetricAssessment } from "../strategies/interface.js";
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
  readonly thresholdKey: keyof ScoringThresholds["valuation"];
}

export function evaluateValuation(
  metrics: KeyMetrics,
  thresholds: ScoringThresholds = EDITORIAL_THRESHOLDS,
): ComponentResult {
  const specs: ReadonlyArray<MetricSpec> = [
    { key: "peRatioTTM", label: "P/E (TTM)", value: metrics.peRatioTTM, thresholdKey: "peTTM" },
    { key: "peRatioForward", label: "Forward P/E", value: metrics.peRatioForward, thresholdKey: "peForward" },
    { key: "priceToSales", label: "P/S", value: metrics.priceToSales, thresholdKey: "priceToSales" },
    { key: "priceToBook", label: "P/B", value: metrics.priceToBook, thresholdKey: "priceToBook" },
    { key: "evToEbitda", label: "EV/EBITDA", value: metrics.evToEbitda, thresholdKey: "evToEbitda" },
    { key: "pegRatio", label: "PEG", value: metrics.pegRatio, thresholdKey: "pegRatio" },
  ];

  const assessments: MetricAssessment[] = specs.map((spec) => {
    const threshold = thresholds.valuation[spec.thresholdKey];
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
    name: "valuation",
    score,
    weight: thresholds.weights.valuation,
    note: noteFor(present.length, assessments.length),
  };

  return { summary, metrics: assessments };
}

function noteFor(present: number, total: number): string | null {
  if (present === 0) return "No valuation metrics available";
  if (present < total) return `${present}/${total} metrics evaluated`;
  return null;
}

