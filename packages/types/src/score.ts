/**
 * Risk score, component scores, rating enum, and the overall score breakdown
 * shape. Scoring components carry both their raw 0-100 score and the weight
 * they contribute to the composite — the `editorial` strategy uses
 * 35% / 35% / 30% (Valuation / Health / Growth).
 */
import { z } from "zod";

export const RatingSchema = z.enum([
  "STRONG_BUY",
  "BUY",
  "HOLD",
  "SELL",
  "STRONG_SELL",
  "SPECULATIVE_BUY",
  "SPECULATIVE_HOLD",
]);

export type Rating = z.infer<typeof RatingSchema>;

export const Rating = {
  STRONG_BUY: "STRONG_BUY",
  BUY: "BUY",
  HOLD: "HOLD",
  SELL: "SELL",
  STRONG_SELL: "STRONG_SELL",
  SPECULATIVE_BUY: "SPECULATIVE_BUY",
  SPECULATIVE_HOLD: "SPECULATIVE_HOLD",
} as const satisfies Record<Rating, Rating>;

export const ScoreComponentNameSchema = z.enum([
  "valuation",
  "financial_health",
  "growth",
]);

export type ScoreComponentName = z.infer<typeof ScoreComponentNameSchema>;

export const ComponentScoreSchema = z.object({
  name: ScoreComponentNameSchema,
  score: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(1),
  note: z.string().nullable(),
});

export type ComponentScore = z.infer<typeof ComponentScoreSchema>;

export const RiskScoreSchema = z.object({
  composite: z.number().int().min(0).max(100),
  rating: RatingSchema,
  ratingPosition: z.number().min(0).max(100),
  riskLabel: z.string().min(1),
  strategy: z.string().min(1),
  strategyVersion: z.string().min(1),
  computedAt: z.string().min(1),
});

export type RiskScore = z.infer<typeof RiskScoreSchema>;

export const ScoreBreakdownSchema = z.object({
  components: z.array(ComponentScoreSchema),
  composite: RiskScoreSchema,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

