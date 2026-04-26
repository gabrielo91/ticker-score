/**
 * Shared fixtures for scoring-engine unit tests. Approximates the AMZN
 * fundamentals shown in `legacy/index.html`. Kept in `src/` (not under a
 * `__fixtures__` dir) so the test runner picks it up without extra config.
 */
import type { Financials, GrowthData, KeyMetrics } from "@darkscore/types";

export const AMZN_KEY_METRICS: KeyMetrics = {
  peRatioTTM: 34.9,
  peRatioForward: 28.85,
  priceToSales: 3.7,
  priceToBook: null,
  evToEbitda: 18.8,
  evToRevenue: 3.8,
  pegRatio: 1.2,
  dividendYield: null,
  payoutRatio: null,
};

export const AMZN_FINANCIALS: Financials = {
  revenueTTM: 716_900_000_000,
  netIncomeTTM: 77_700_000_000,
  epsTTM: 7.17,
  cash: 86_800_000_000,
  totalDebt: 67_000_000_000,
  debtToEquity: 43.4,
  currentRatio: 1.06,
  operatingCashFlowTTM: 139_500_000_000,
  freeCashFlowTTM: 7_700_000_000,
  capexTTM: 131_800_000_000,
  grossMargin: 50.3,
  operatingMargin: 11.2,
  netMargin: 10.8,
  returnOnEquity: 22.3,
  returnOnAssets: 9.0,
  fiscalYear: 2025,
};

export const AMZN_GROWTH: GrowthData = {
  revenueGrowthYoY: 11,
  revenueGrowthForward: 14.5,
  earningsGrowthYoY: 18.0,
  earningsGrowthForward: 9.6,
  ebitdaGrowthForward: 44.8,
  segments: [
    { name: "AWS", growthYoYPercent: 24, revenue: 113_000_000_000 },
    { name: "Advertising", growthYoYPercent: 22, revenue: 56_000_000_000 },
    { name: "North America", growthYoYPercent: 10, revenue: 433_000_000_000 },
    { name: "International", growthYoYPercent: 17, revenue: 170_000_000_000 },
  ],
};

