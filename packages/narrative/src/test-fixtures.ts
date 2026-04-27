/**
 * Shared test fixtures for the narrative package. Kept out of `index.ts`
 * so they don't leak into the public API surface.
 */
import {
  NarrativeInputSchema,
  type NarrativeInput,
} from "@darkscore/types";

export function buildNarrativeInputFixture(
  overrides: Partial<NarrativeInput> = {},
): NarrativeInput {
  const base: NarrativeInput = {
    ticker: {
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      industry: "Consumer Electronics",
      exchange: "NASDAQ",
      description: "Apple designs, manufactures and markets consumer devices.",
      currency: "USD",
      currentPrice: 200,
      priceChange: 1,
      priceChangePercent: 0.5,
      week52High: 250,
      week52Low: 150,
      marketCap: 3_000_000_000_000,
      volume: 50_000_000,
      averageVolume: 60_000_000,
    },
    riskScore: {
      composite: 70,
      rating: "BUY",
      ratingPosition: 70,
      riskLabel: "Moderate",
      strategy: "editorial",
      strategyVersion: "1.0.0",
      computedAt: "2026-04-27T00:00:00.000Z",
    },
    scoreBreakdown: {
      components: [
        { name: "valuation", score: 65, weight: 0.35, note: null },
        { name: "financial_health", score: 80, weight: 0.35, note: null },
        { name: "growth", score: 65, weight: 0.3, note: null },
      ],
      composite: {
        composite: 70,
        rating: "BUY",
        ratingPosition: 70,
        riskLabel: "Moderate",
        strategy: "editorial",
        strategyVersion: "1.0.0",
        computedAt: "2026-04-27T00:00:00.000Z",
      },
    },
    financials: {
      revenueTTM: 400,
      netIncomeTTM: 100,
      epsTTM: 6.5,
      cash: 60,
      totalDebt: 110,
      debtToEquity: 1.5,
      currentRatio: 1.0,
      operatingCashFlowTTM: 120,
      freeCashFlowTTM: 100,
      capexTTM: 20,
      grossMargin: 0.45,
      operatingMargin: 0.3,
      netMargin: 0.25,
      returnOnEquity: 1.5,
      returnOnAssets: 0.3,
      fiscalYear: 2025,
    },
    keyMetrics: {
      peRatioTTM: 30,
      peRatioForward: 28,
      priceToSales: 7,
      priceToBook: 50,
      evToEbitda: 22,
      evToRevenue: 7,
      pegRatio: 2.5,
      dividendYield: 0.005,
      payoutRatio: 0.15,
    },
    quarterlyResults: [
      {
        quarter: "Q1 2026",
        fiscalYear: 2026,
        revenue: 100,
        revenueGrowthYoYPercent: 5,
        operatingIncome: 30,
        operatingMarginPercent: 30,
        netIncome: 25,
        eps: 1.6,
        segments: [],
        notes: null,
      },
    ],
    priceHistory: [
      {
        date: "2025-04-27",
        close: 180,
        open: 179,
        high: 182,
        low: 178,
        volume: 45_000_000,
      },
      {
        date: "2026-04-27",
        close: 200,
        open: 199,
        high: 201,
        low: 198,
        volume: 50_000_000,
      },
    ],
  };
  return NarrativeInputSchema.parse({ ...base, ...overrides });
}

