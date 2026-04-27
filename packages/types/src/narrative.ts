/**
 * LLM-synthesized narrative layer for the report (Spec 002, W4-1).
 *
 * This module defines the cross-boundary types only — no provider
 * implementations live in `@darkscore/types`. The actual OpenAI / Anthropic
 * adapters live in `@darkscore/narrative` and implement `NarrativeProvider`.
 *
 * The narrative is grounded strictly on `NarrativeInput` (a snapshot of the
 * already-computed report data). Providers MUST NOT invent numbers.
 * `NarrativeData` is Zod-validated on every read so a malformed model
 * response surfaces as `Result.err`, not as undefined behaviour downstream.
 */
import { z } from "zod";
import type { Result } from "./result.js";
import {
  FinancialsSchema,
  KeyMetricsSchema,
  QuarterlyResultSchema,
} from "./financials.js";
import { RiskScoreSchema, ScoreBreakdownSchema } from "./score.js";
import { PricePointSchema, TickerInfoSchema } from "./ticker.js";

const SUBTITLE_MAX = 160;
const ANNOTATION_LABEL_MAX = 48;
const CATALYST_RISK_MAX = 160;
const HEADLINE_MAX = 80;
const PARAGRAPH_MAX = 600;

export const NarrativeCardSubtitlesSchema = z.object({
  valuationPe: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  valuationEv: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  valuationRelative: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  healthBalance: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  healthCashFlow: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  healthProfitability: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  growthRevenue: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  growthSegment: z.string().min(1).max(SUBTITLE_MAX).nullable(),
  growthEarnings: z.string().min(1).max(SUBTITLE_MAX).nullable(),
});
export type NarrativeCardSubtitles = z.infer<
  typeof NarrativeCardSubtitlesSchema
>;

export const NarrativeAnnotationKindSchema = z.enum(["high", "low", "event"]);
export type NarrativeAnnotationKind = z.infer<
  typeof NarrativeAnnotationKindSchema
>;

export const NarrativeAnnotationSchema = z.object({
  date: z.string().min(1),
  label: z.string().min(1).max(ANNOTATION_LABEL_MAX),
  kind: NarrativeAnnotationKindSchema,
});
export type NarrativeAnnotation = z.infer<typeof NarrativeAnnotationSchema>;

export const NarrativePriceTargetsSchema = z
  .object({
    bear: z.number().finite(),
    base: z.number().finite(),
    bull: z.number().finite(),
  })
  .refine((t) => t.bear <= t.base && t.base <= t.bull, {
    message: "price targets must satisfy bear <= base <= bull",
  });
export type NarrativePriceTargets = z.infer<typeof NarrativePriceTargetsSchema>;

export const NarrativeVerdictSchema = z.object({
  headline: z.string().min(1).max(HEADLINE_MAX),
  paragraph: z.string().min(1).max(PARAGRAPH_MAX),
});
export type NarrativeVerdict = z.infer<typeof NarrativeVerdictSchema>;

const FORWARD_REASONING_MAX = 600;

export const AnalystConsensusSchema = z.enum([
  "strong_buy",
  "buy",
  "hold",
  "sell",
  "strong_sell",
]);
export type AnalystConsensus = z.infer<typeof AnalystConsensusSchema>;

export const ForwardEstimateConfidenceSchema = z.enum(["high", "medium", "low"]);
export type ForwardEstimateConfidence = z.infer<
  typeof ForwardEstimateConfidenceSchema
>;

/**
 * LLM-produced forward-looking estimates (W5-2). Every numeric field MUST be
 * either a finite number or `null` — the prompt forbids guessing. A
 * `confidenceLevel` and a free-form `reasoning` string are required so the
 * orchestrator can audit which data points the model used.
 */
export const ForwardEstimatesSchema = z.object({
  forwardPE: z.number().finite().nullable(),
  earningsGrowthForward: z.number().finite().nullable(),
  revenueGrowthForward: z.number().finite().nullable(),
  ebitdaGrowthForward: z.number().finite().nullable(),
  analystConsensus: AnalystConsensusSchema.nullable(),
  confidenceLevel: ForwardEstimateConfidenceSchema,
  reasoning: z.string().min(1).max(FORWARD_REASONING_MAX),
});
export type ForwardEstimates = z.infer<typeof ForwardEstimatesSchema>;

export const NarrativeDataSchema = z.object({
  cardSubtitles: NarrativeCardSubtitlesSchema,
  chartAnnotations: z.array(NarrativeAnnotationSchema).max(5),
  catalysts: z.array(z.string().min(1).max(CATALYST_RISK_MAX)).min(3).max(7),
  risks: z.array(z.string().min(1).max(CATALYST_RISK_MAX)).min(3).max(7),
  priceTargets: NarrativePriceTargetsSchema,
  verdict: NarrativeVerdictSchema,
  disclaimer: z.string().min(1),
  /** Optional forward estimates — `null` when the model could not estimate
   * confidently, or when the response failed `ForwardEstimatesSchema` and
   * the provider salvaged the rest of the narrative. */
  forwardEstimates: ForwardEstimatesSchema.nullable(),
  /** Provider name + model that produced this narrative (for audit + cache key). */
  providerName: z.string().min(1),
  model: z.string().min(1),
  generatedAt: z.string().min(1),
});
export type NarrativeData = z.infer<typeof NarrativeDataSchema>;

/**
 * Snapshot of the structured report state passed to a narrative provider.
 * Everything the LLM is allowed to reference must be in this object — the
 * system prompt instructs the model to use only these facts.
 */
export const NarrativeInputSchema = z.object({
  ticker: TickerInfoSchema,
  riskScore: RiskScoreSchema,
  scoreBreakdown: ScoreBreakdownSchema,
  financials: FinancialsSchema,
  keyMetrics: KeyMetricsSchema,
  quarterlyResults: z.array(QuarterlyResultSchema),
  priceHistory: z.array(PricePointSchema),
});
export type NarrativeInput = z.infer<typeof NarrativeInputSchema>;

/**
 * Narrative provider contract. Mirrors the `DataProvider` shape: a name, a
 * single `generate` method returning `Result`, and an `isAvailable` probe so
 * the orchestrator can skip cleanly when no key is configured.
 */
export interface NarrativeProvider {
  readonly name: string;
  readonly model: string;

  isAvailable(): Promise<boolean>;

  generate(input: NarrativeInput): Promise<Result<NarrativeData>>;
}

