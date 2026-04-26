import { describe, expect, it } from "vitest";
import {
  ChartResponseSchema,
  QuoteSummaryResponseSchema,
} from "./schemas.js";
import {
  epochSecondsToIsoDate,
  transformFinancials,
  transformKeyMetrics,
  transformPriceHistory,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";

function parseSummary(sample: unknown) {
  const parsed = QuoteSummaryResponseSchema.parse(sample);
  const result = parsed.quoteSummary.result?.[0];
  if (result === undefined) throw new Error("test: empty result");
  return result;
}

const SAMPLE_SUMMARY = {
  quoteSummary: {
    result: [
      {
        price: {
          longName: "Amazon.com, Inc.",
          shortName: "Amazon",
          currency: "USD",
          exchangeName: "NMS",
          regularMarketPrice: { raw: 175.12, fmt: "175.12" },
          regularMarketChange: { raw: 1.5, fmt: "1.50" },
          regularMarketChangePercent: { raw: 0.0086, fmt: "0.86%" },
          marketCap: { raw: 1_800_000_000_000, fmt: "1.8T" },
          regularMarketVolume: { raw: 35_000_000, fmt: "35M" },
          averageDailyVolume3Month: { raw: 42_000_000, fmt: "42M" },
        },
        summaryDetail: {
          fiftyTwoWeekHigh: { raw: 200, fmt: "200" },
          fiftyTwoWeekLow: { raw: 100, fmt: "100" },
          trailingPE: { raw: 60, fmt: "60" },
          forwardPE: { raw: 35, fmt: "35" },
          priceToSalesTrailing12Months: { raw: 3.2, fmt: "3.2" },
          dividendYield: {},
          payoutRatio: {},
        },
        assetProfile: {
          sector: "Consumer Cyclical",
          industry: "Internet Retail",
        },
        financialData: {
          totalRevenue: { raw: 600_000_000_000, fmt: "600B" },
          grossMargins: { raw: 0.45, fmt: "45%" },
          operatingMargins: { raw: 0.08, fmt: "8%" },
          profitMargins: { raw: 0.06, fmt: "6%" },
          returnOnEquity: { raw: 0.18, fmt: "18%" },
          returnOnAssets: { raw: 0.07, fmt: "7%" },
          debtToEquity: { raw: 60, fmt: "60" },
          currentRatio: { raw: 1.05, fmt: "1.05" },
          totalCash: { raw: 90_000_000_000, fmt: "90B" },
          totalDebt: { raw: 150_000_000_000, fmt: "150B" },
          operatingCashflow: { raw: 80_000_000_000, fmt: "80B" },
          freeCashflow: { raw: 30_000_000_000, fmt: "30B" },
          capitalExpenditures: { raw: -50_000_000_000, fmt: "-50B" },
        },
        defaultKeyStatistics: {
          trailingEps: { raw: 4.5, fmt: "4.50" },
          forwardEps: { raw: 5.0, fmt: "5.00" },
          priceToBook: { raw: 8.1, fmt: "8.1" },
          enterpriseToEbitda: { raw: 18, fmt: "18" },
          enterpriseToRevenue: { raw: 3.0, fmt: "3.0" },
          pegRatio: { raw: 1.5, fmt: "1.5" },
          netIncomeToCommon: { raw: 36_000_000_000, fmt: "36B" },
          lastFiscalYearEnd: { raw: 1_703_980_800, fmt: "2023-12-31" },
        },
        incomeStatementHistoryQuarterly: {
          incomeStatementHistory: [
            { endDate: { raw: 1_703_980_800 }, totalRevenue: { raw: 170_000_000_000 }, operatingIncome: { raw: 13_000_000_000 }, netIncome: { raw: 10_000_000_000 } },
            { endDate: { raw: 1_696_032_000 }, totalRevenue: { raw: 143_000_000_000 }, operatingIncome: { raw: 11_000_000_000 }, netIncome: { raw: 9_000_000_000 } },
            { endDate: { raw: 1_688_083_200 }, totalRevenue: { raw: 134_000_000_000 }, operatingIncome: { raw: 7_000_000_000 }, netIncome: { raw: 6_000_000_000 } },
            { endDate: { raw: 1_680_220_800 }, totalRevenue: { raw: 127_000_000_000 }, operatingIncome: { raw: 4_000_000_000 }, netIncome: { raw: 3_000_000_000 } },
            { endDate: { raw: 1_672_444_800 }, totalRevenue: { raw: 149_000_000_000 }, operatingIncome: { raw: 2_000_000_000 }, netIncome: { raw: 1_000_000_000 } },
          ],
        },
      },
    ],
    error: null,
  },
};

describe("epochSecondsToIsoDate", () => {
  it("formats seconds since epoch as ISO date (UTC)", () => {
    expect(epochSecondsToIsoDate(1_703_980_800)).toBe("2023-12-31");
  });
});

describe("transformTickerInfo", () => {
  it("maps a Yahoo summary into a TickerInfo", () => {
    const result = parseSummary(SAMPLE_SUMMARY);
    const info = transformTickerInfo("AMZN", result);
    expect(info.symbol).toBe("AMZN");
    expect(info.name).toBe("Amazon.com, Inc.");
    expect(info.sector).toBe("Consumer Cyclical");
    expect(info.currentPrice).toBeCloseTo(175.12);
    expect(info.week52High).toBe(200);
    expect(info.marketCap).toBe(1_800_000_000_000);
    expect(info.volume).toBe(35_000_000);
  });

  it("falls back to symbol when neither long nor short name present", () => {
    const minimal = parseSummary({
      quoteSummary: {
        result: [{ price: {}, summaryDetail: {}, assetProfile: {} }],
        error: null,
      },
    });
    expect(transformTickerInfo("XYZ", minimal).name).toBe("XYZ");
  });
});

describe("transformFinancials", () => {
  it("maps revenue, margins, cash, and fiscal year correctly", () => {
    const result = parseSummary(SAMPLE_SUMMARY);
    const financials = transformFinancials(result);
    expect(financials.revenueTTM).toBe(600_000_000_000);
    expect(financials.grossMargin).toBeCloseTo(0.45);
    expect(financials.fiscalYear).toBe(2023);
    expect(financials.netIncomeTTM).toBe(36_000_000_000);
  });
});

describe("transformKeyMetrics", () => {
  it("preserves null for missing metrics", () => {
    const result = parseSummary(SAMPLE_SUMMARY);
    const metrics = transformKeyMetrics(result);
    expect(metrics.peRatioTTM).toBe(60);
    expect(metrics.dividendYield).toBeNull();
    expect(metrics.evToEbitda).toBe(18);
  });
});

describe("transformPriceHistory", () => {
  it("turns parallel arrays into PricePoint objects, dropping null closes", () => {
    const sample = {
      chart: {
        result: [
          {
            timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
            indicators: {
              quote: [
                {
                  open: [100, 101, null],
                  high: [102, 103, null],
                  low: [99, 100, null],
                  close: [101, 102, null],
                  volume: [1_000_000, 1_100_000, null],
                },
              ],
            },
          },
        ],
        error: null,
      },
    };
    const parsed = ChartResponseSchema.parse(sample);
    const result = parsed.chart.result?.[0];
    if (result === undefined) throw new Error("test: empty result");
    const points = transformPriceHistory(result);
    expect(points.length).toBe(2);
    expect(points[0]?.close).toBe(101);
    expect(points[1]?.volume).toBe(1_100_000);
  });
});

describe("transformQuarterlyResults", () => {
  it("computes YoY revenue growth from the row 4 quarters back", () => {
    const result = parseSummary(SAMPLE_SUMMARY);
    const quarterly = transformQuarterlyResults(result, 1);
    expect(quarterly.length).toBe(1);
    const q = quarterly[0];
    if (q === undefined) throw new Error("test: empty quarterly");
    expect(q.fiscalYear).toBe(2023);
    expect(q.quarter).toMatch(/^Q\d 2023$/u);
    expect(q.revenue).toBe(170_000_000_000);
    expect(q.revenueGrowthYoYPercent).toBeCloseTo(
      (170_000_000_000 - 149_000_000_000) / 149_000_000_000,
    );
    expect(q.operatingMarginPercent).toBeCloseTo(13 / 170);
  });

  it("respects the quarters limit", () => {
    const result = parseSummary(SAMPLE_SUMMARY);
    expect(transformQuarterlyResults(result, 2).length).toBe(2);
    expect(transformQuarterlyResults(result, 99).length).toBe(5);
  });
});

