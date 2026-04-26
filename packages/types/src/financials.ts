/**
 * Financial statement aggregates, key valuation/quality metrics, growth
 * snapshots, and quarterly results. All numeric financial values are plain
 * `number` (Constitution: no string or BigInt for financial values).
 */
import { z } from "zod";

export const FinancialsSchema = z.object({
  revenueTTM: z.number().finite(),
  netIncomeTTM: z.number().finite(),
  epsTTM: z.number().finite(),
  cash: z.number().finite(),
  totalDebt: z.number().finite(),
  debtToEquity: z.number().finite().nullable(),
  currentRatio: z.number().finite().nullable(),
  operatingCashFlowTTM: z.number().finite(),
  freeCashFlowTTM: z.number().finite(),
  capexTTM: z.number().finite(),
  grossMargin: z.number().finite(),
  operatingMargin: z.number().finite(),
  netMargin: z.number().finite(),
  returnOnEquity: z.number().finite().nullable(),
  returnOnAssets: z.number().finite().nullable(),
  fiscalYear: z.number().int(),
});

export type Financials = z.infer<typeof FinancialsSchema>;

export const KeyMetricsSchema = z.object({
  peRatioTTM: z.number().finite().nullable(),
  peRatioForward: z.number().finite().nullable(),
  priceToSales: z.number().finite().nullable(),
  priceToBook: z.number().finite().nullable(),
  evToEbitda: z.number().finite().nullable(),
  evToRevenue: z.number().finite().nullable(),
  pegRatio: z.number().finite().nullable(),
  dividendYield: z.number().finite().nullable(),
  payoutRatio: z.number().finite().nullable(),
});

export type KeyMetrics = z.infer<typeof KeyMetricsSchema>;

export const SegmentGrowthSchema = z.object({
  name: z.string().min(1),
  growthYoYPercent: z.number().finite(),
  revenue: z.number().finite().nullable(),
});

export type SegmentGrowth = z.infer<typeof SegmentGrowthSchema>;

export const GrowthDataSchema = z.object({
  revenueGrowthYoY: z.number().finite(),
  revenueGrowthForward: z.number().finite().nullable(),
  earningsGrowthYoY: z.number().finite().nullable(),
  earningsGrowthForward: z.number().finite().nullable(),
  ebitdaGrowthForward: z.number().finite().nullable(),
  segments: z.array(SegmentGrowthSchema),
});

export type GrowthData = z.infer<typeof GrowthDataSchema>;

export const SegmentResultSchema = z.object({
  name: z.string().min(1),
  revenue: z.number().finite().nullable(),
  growthYoYPercent: z.number().finite().nullable(),
});

export type SegmentResult = z.infer<typeof SegmentResultSchema>;

export const QuarterlyResultSchema = z.object({
  quarter: z.string().min(1),
  fiscalYear: z.number().int(),
  revenue: z.number().finite(),
  revenueGrowthYoYPercent: z.number().finite(),
  operatingIncome: z.number().finite(),
  operatingMarginPercent: z.number().finite(),
  netIncome: z.number().finite().nullable(),
  eps: z.number().finite(),
  segments: z.array(SegmentResultSchema),
  notes: z.string().nullable(),
});

export type QuarterlyResult = z.infer<typeof QuarterlyResultSchema>;

