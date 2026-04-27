/**
 * ReportData — the complete data contract rendered by `apps/web` for the
 * 2-page risk score report. Mirrors the section structure of
 * `legacy/index.html`: ticker bar → KPI strip → price chart → valuation /
 * health / growth cards → score breakdown → quarterly table → latest
 * earnings → catalysts vs risks → verdict + price targets.
 *
 * Persisted as the `reports.report_data` jsonb column, so this is the
 * primary cross-boundary type — every nested shape carries a Zod schema.
 */
import { z } from "zod";
import {
  FinancialsSchema,
  GrowthDataSchema,
  KeyMetricsSchema,
  QuarterlyResultSchema,
} from "./financials.js";
import { NarrativeDataSchema } from "./narrative.js";
import { RiskScoreSchema, ScoreBreakdownSchema } from "./score.js";
import { SourceAttributionSchema } from "./source-attribution.js";
import { PricePointSchema, TickerInfoSchema } from "./ticker.js";

export const StatusColorSchema = z.enum(["green", "amber", "red", "blue"]);
export type StatusColor = z.infer<typeof StatusColorSchema>;

export const DataPointSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  status: StatusColorSchema.nullable(),
  note: z.string().nullable(),
});
export type DataPoint = z.infer<typeof DataPointSchema>;

export const KpiHighlightSchema = DataPointSchema;
export type KpiHighlight = z.infer<typeof KpiHighlightSchema>;

export const DataCardSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  items: z.array(DataPointSchema),
});
export type DataCard = z.infer<typeof DataCardSchema>;

export const PriceChartAnnotationSchema = z.object({
  date: z.string().min(1),
  label: z.string().min(1),
  status: StatusColorSchema,
});
export type PriceChartAnnotation = z.infer<typeof PriceChartAnnotationSchema>;

export const PriceChartSchema = z.object({
  points: z.array(PricePointSchema),
  annotations: z.array(PriceChartAnnotationSchema),
});
export type PriceChart = z.infer<typeof PriceChartSchema>;

export const EarningsGuidanceSchema = z.object({
  low: z.number().finite(),
  high: z.number().finite(),
});
export type EarningsGuidance = z.infer<typeof EarningsGuidanceSchema>;

export const UpcomingEarningsSchema = z.object({
  quarter: z.string().min(1),
  nextEarningsDate: z.string().min(1),
  guidance: EarningsGuidanceSchema.nullable(),
  consensusRevenue: z.number().finite().nullable(),
  consensusEps: z.number().finite().nullable(),
});
export type UpcomingEarnings = z.infer<typeof UpcomingEarningsSchema>;

export const LatestEarningsSchema = z.object({
  quarter: z.string().min(1),
  reportedAt: z.string().min(1),
  highlights: z.array(DataPointSchema),
  upcoming: UpcomingEarningsSchema.nullable(),
});
export type LatestEarnings = z.infer<typeof LatestEarningsSchema>;

export const PriceTargetsSchema = z.object({
  bear: z.number().finite(),
  base: z.number().finite(),
  bull: z.number().finite(),
});
export type PriceTargets = z.infer<typeof PriceTargetsSchema>;

export const VerdictSchema = z.object({
  summary: z.string().min(1),
  priceTargets: PriceTargetsSchema,
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const ReportDataSchema = z.object({
  ticker: TickerInfoSchema,
  priceChart: PriceChartSchema,
  kpiStrip: z.array(KpiHighlightSchema),
  valuationCards: z.array(DataCardSchema),
  financialHealthCards: z.array(DataCardSchema),
  growthCards: z.array(DataCardSchema),
  financials: FinancialsSchema,
  keyMetrics: KeyMetricsSchema,
  growth: GrowthDataSchema,
  quarterlyResults: z.array(QuarterlyResultSchema),
  scoreBreakdown: ScoreBreakdownSchema,
  riskScore: RiskScoreSchema,
  latestEarnings: LatestEarningsSchema,
  catalysts: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  verdict: VerdictSchema,
  generatedAt: z.string().min(1),
  dataAsOf: z.string().min(1),
  notFinancialAdvice: z.boolean(),
  /**
   * `true` when the provider supplied financials, key metrics, and
   * quarterly results — i.e. the report can be scored. `false` when those
   * endpoints are gated or refused (e.g. Twelve Data Basic plan); the UI
   * suppresses the score gauge, score breakdown, and verdict so the user
   * isn't shown a misleading rating computed from missing data.
   */
  fundamentalsAvailable: z.boolean(),
  /**
   * Optional LLM-synthesized narrative (Spec 002). Present when a
   * `NarrativeProvider` is configured and the call succeeded; absent when
   * no provider is registered or the call failed. The UI gates rendering
   * on `narrativeAvailable` so a missing narrative degrades to the
   * Spec 001 layout without errors.
   */
  narrative: NarrativeDataSchema.nullable(),
  narrativeAvailable: z.boolean(),
  /**
   * Per-method record of which provider served each `DataProvider` call
   * (W5-1). `null` when the report is built from a single-provider path
   * (no composite aggregator); a `SourceAttribution` map when produced by
   * `CompositeAggregator`. Method keys mirror the `DataProvider` surface
   * (`tickerInfo`, `priceHistory`, `financials`, `keyMetrics`,
   * `quarterlyResults`).
   */
  sourceAttribution: SourceAttributionSchema.nullable(),
});

export type ReportData = z.infer<typeof ReportDataSchema>;

