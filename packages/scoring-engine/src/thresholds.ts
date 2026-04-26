/**
 * Editorial scoring thresholds. Each metric has a `good` and `bad` anchor;
 * scores interpolate linearly between them and clamp to 0-100. Thresholds are
 * tuned so the legacy AMZN report data yields a composite risk near 38.
 *
 * The thresholds module is the only source of "what is good" — components
 * never inline magic numbers (per task brief).
 */

export interface MetricThreshold {
  readonly good: number;
  readonly bad: number;
  readonly lowerIsBetter: boolean;
  readonly amberAt?: number;
}

export interface ValuationThresholds {
  readonly peTTM: MetricThreshold;
  readonly peForward: MetricThreshold;
  readonly priceToSales: MetricThreshold;
  readonly priceToBook: MetricThreshold;
  readonly evToEbitda: MetricThreshold;
  readonly pegRatio: MetricThreshold;
}

export interface FinancialHealthThresholds {
  readonly debtToEquity: MetricThreshold;
  readonly currentRatio: MetricThreshold;
  readonly netMargin: MetricThreshold;
  readonly fcfMargin: MetricThreshold;
  readonly returnOnEquity: MetricThreshold;
}

export interface GrowthThresholds {
  readonly revenueGrowthYoY: MetricThreshold;
  readonly revenueGrowthForward: MetricThreshold;
  readonly earningsGrowthForward: MetricThreshold;
  readonly ebitdaGrowthForward: MetricThreshold;
}

export interface ComponentWeights {
  readonly valuation: number;
  readonly financialHealth: number;
  readonly growth: number;
}

export interface ScoringThresholds {
  readonly valuation: ValuationThresholds;
  readonly financialHealth: FinancialHealthThresholds;
  readonly growth: GrowthThresholds;
  readonly weights: ComponentWeights;
}

export const EDITORIAL_THRESHOLDS: ScoringThresholds = {
  valuation: {
    peTTM: { good: 10, bad: 50, lowerIsBetter: true, amberAt: 25 },
    peForward: { good: 10, bad: 40, lowerIsBetter: true, amberAt: 22 },
    priceToSales: { good: 2, bad: 15, lowerIsBetter: true, amberAt: 6 },
    priceToBook: { good: 1.5, bad: 10, lowerIsBetter: true, amberAt: 4 },
    evToEbitda: { good: 8, bad: 30, lowerIsBetter: true, amberAt: 18 },
    pegRatio: { good: 1, bad: 3, lowerIsBetter: true, amberAt: 1.5 },
  },
  financialHealth: {
    debtToEquity: { good: 50, bad: 200, lowerIsBetter: true, amberAt: 100 },
    currentRatio: { good: 1.5, bad: 0.8, lowerIsBetter: false, amberAt: 1.1 },
    netMargin: { good: 20, bad: 0, lowerIsBetter: false, amberAt: 8 },
    fcfMargin: { good: 10, bad: 0, lowerIsBetter: false, amberAt: 4 },
    returnOnEquity: { good: 25, bad: 5, lowerIsBetter: false, amberAt: 12 },
  },
  growth: {
    revenueGrowthYoY: { good: 15, bad: 0, lowerIsBetter: false, amberAt: 6 },
    revenueGrowthForward: { good: 15, bad: 0, lowerIsBetter: false, amberAt: 6 },
    earningsGrowthForward: { good: 15, bad: -5, lowerIsBetter: false, amberAt: 5 },
    ebitdaGrowthForward: { good: 15, bad: 0, lowerIsBetter: false, amberAt: 6 },
  },
  weights: {
    valuation: 0.35,
    financialHealth: 0.35,
    growth: 0.3,
  },
};

