import { describe, expect, it, vi } from "vitest";
import {
  transformFinancials,
  transformKeyMetrics,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";
import type {
  FinnhubFinancialsReported,
  FinnhubMetricBlock,
  FinnhubMetricResponse,
  FinnhubProfile2,
  FinnhubQuote,
} from "./schemas.js";

const QUOTE: FinnhubQuote = { c: 175, d: 1.5, dp: 0.86, h: 176, l: 173 };
const PROFILE: FinnhubProfile2 = {
  name: "Apple Inc",
  exchange: "NASDAQ",
  finnhubIndustry: "Technology",
  currency: "USD",
  marketCapitalization: 2_500_000, // millions of USD => 2.5T
};
const METRIC: FinnhubMetricBlock = {
  peTTM: 30,
  psTTM: 7,
  pbAnnual: 40,
  pegRatio: 2,
  dividendYieldIndicatedAnnual: 0.6,
  payoutRatioTTM: 0.15,
  currentRatioAnnual: 1.05,
  "totalDebt/totalEquityAnnual": 1.5,
  roeTTM: 145,
  roaTTM: 28,
  grossMarginTTM: 45,
  operatingMarginTTM: 30,
  netProfitMarginTTM: 25,
  epsTTM: 6.2,
  revenueTTM: 380_000_000_000,
  netIncomeCommonTTM: 95_000_000_000,
  "52WeekHigh": 200,
  "52WeekLow": 130,
  "10DayAverageTradingVolume": 50_000_000,
  "currentEv/EBITDA": 22,
};

describe("transformTickerInfo", () => {
  it("maps quote + profile + metrics into TickerInfo", () => {
    const info = transformTickerInfo("AAPL", QUOTE, PROFILE, METRIC);
    expect(info.symbol).toBe("AAPL");
    expect(info.name).toBe("Apple Inc");
    expect(info.industry).toBe("Technology");
    expect(info.sector).toBeNull();
    expect(info.description).toBeNull();
    expect(info.currentPrice).toBe(175);
    expect(info.priceChange).toBe(1.5);
    expect(info.priceChangePercent).toBeCloseTo(0.0086, 6);
    expect(info.marketCap).toBe(2_500_000_000_000);
    expect(info.week52High).toBe(200);
    expect(info.week52Low).toBe(130);
    expect(info.averageVolume).toBe(50_000_000);
  });

  it("falls back to quote h/l when metrics are missing", () => {
    const info = transformTickerInfo("AAPL", QUOTE, PROFILE, undefined);
    expect(info.week52High).toBe(176);
    expect(info.week52Low).toBe(173);
    expect(info.averageVolume).toBeNull();
  });
});

describe("transformKeyMetrics", () => {
  it("returns nulls when no metric block is present", () => {
    const m = transformKeyMetrics(undefined);
    expect(m.peRatioTTM).toBeNull();
    expect(m.priceToBook).toBeNull();
    expect(m.dividendYield).toBeNull();
  });

  it("falls back to pbQuarterly when pbAnnual is missing", () => {
    const m = transformKeyMetrics({ pbQuarterly: 5 });
    expect(m.priceToBook).toBe(5);
  });
});

describe("transformFinancials", () => {
  it("converts margins from percent to fraction and computes FCF", () => {
    const reported: FinnhubFinancialsReported = {
      data: [
        {
          year: 2024,
          quarter: 1,
          report: {
            bs: [
              { concept: "CashAndCashEquivalentsAtCarryingValue", value: 50 },
              { concept: "LongTermDebt", value: 100 },
            ],
            cf: [
              { concept: "NetCashProvidedByUsedInOperatingActivities", value: 80 },
              { concept: "PaymentsToAcquirePropertyPlantAndEquipment", value: 30 },
            ],
            ic: [],
          },
        },
      ],
    };
    const metricResp: FinnhubMetricResponse = { metric: METRIC };
    const f = transformFinancials(metricResp, reported);
    expect(f.cash).toBe(50);
    expect(f.totalDebt).toBe(100);
    expect(f.operatingCashFlowTTM).toBe(80);
    expect(f.freeCashFlowTTM).toBe(50);
    expect(f.capexTTM).toBe(-30);
    expect(f.grossMargin).toBeCloseTo(0.45, 6);
    expect(f.operatingMargin).toBeCloseTo(0.3, 6);
    expect(f.netMargin).toBeCloseTo(0.25, 6);
    expect(f.fiscalYear).toBe(2024);
  });
});

describe("transformQuarterlyResults", () => {
  it("computes YoY revenue growth from prior-year quarter and respects limit", () => {
    const mk = (year: number, quarter: number, revenue: number) => ({
      year,
      quarter,
      report: {
        bs: [],
        cf: [],
        ic: [
          { concept: "Revenues", value: revenue },
          { concept: "OperatingIncomeLoss", value: revenue * 0.3 },
          { concept: "EarningsPerShareDiluted", value: 1 },
        ],
      },
    });
    const reported: FinnhubFinancialsReported = {
      data: [mk(2024, 1, 110), mk(2023, 1, 100), mk(2022, 4, 50)],
    };
    const out = transformQuarterlyResults(reported, 2);
    expect(out.length).toBe(2);
    expect(out[0]?.quarter).toBe("Q1 2024");
    expect(out[0]?.revenueGrowthYoYPercent).toBeCloseTo(0.1, 6);
    expect(out[0]?.operatingMarginPercent).toBeCloseTo(0.3, 6);
    // 2023 Q1 has no 2022 Q1 in the dataset, so growth defaults to 0.
    expect(out[1]?.revenueGrowthYoYPercent).toBe(0);
  });

  it("skips annual filings (quarter = 0)", () => {
    const reported: FinnhubFinancialsReported = {
      data: [
        { year: 2024, quarter: 0, report: { bs: [], cf: [], ic: [] } },
      ],
    };
    expect(transformQuarterlyResults(reported, 4)).toEqual([]);
  });

  it("reads revenue from `Revenue` (singular) — Alphabet/Google-style XBRL", () => {
    const reported: FinnhubFinancialsReported = {
      data: [
        {
          year: 2024,
          quarter: 2,
          report: {
            bs: [],
            cf: [],
            ic: [
              { concept: "Revenue", value: 84_700_000_000 },
              { concept: "OperatingIncomeLoss", value: 27_400_000_000 },
              { concept: "NetIncomeLoss", value: 23_600_000_000 },
              { concept: "EarningsPerShareDiluted", value: 1.89 },
            ],
          },
        },
      ],
    };
    const out = transformQuarterlyResults(reported, 1);
    expect(out[0]?.revenue).toBe(84_700_000_000);
    expect(out[0]?.operatingMarginPercent).toBeCloseTo(27_400_000_000 / 84_700_000_000, 6);
  });

  it("reads revenue from `SalesRevenueNet` — older filers", () => {
    const reported: FinnhubFinancialsReported = {
      data: [
        {
          year: 2018,
          quarter: 4,
          report: {
            bs: [],
            cf: [],
            ic: [
              { concept: "SalesRevenueNet", value: 100 },
              { concept: "OperatingIncomeLoss", value: 25 },
              { concept: "NetIncomeLoss", value: 18 },
              { concept: "EarningsPerShareDiluted", value: 0.5 },
            ],
          },
        },
      ],
    };
    const out = transformQuarterlyResults(reported, 1);
    expect(out[0]?.revenue).toBe(100);
  });

  it("warns when revenue resolves to 0 with non-empty income statement", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reported: FinnhubFinancialsReported = {
      data: [
        {
          year: 2024,
          quarter: 1,
          report: {
            bs: [],
            cf: [],
            ic: [
              { concept: "SomeUnknownRevenueTag", value: 999 },
              { concept: "OperatingIncomeLoss", value: 10 },
            ],
          },
        },
      ],
    };
    transformQuarterlyResults(reported, 1);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("XBRL tag mismatch");
    warn.mockRestore();
  });
});

describe("transformFinancials revenueTTM fallback", () => {
  it("sums the four most recent quarterly revenues when m.revenueTTM is missing", () => {
    const mkQuarter = (year: number, quarter: number, revenue: number) => ({
      year,
      quarter,
      report: {
        bs: [],
        cf: [],
        ic: [{ concept: "Revenue", value: revenue }],
      },
    });
    const reported: FinnhubFinancialsReported = {
      data: [
        mkQuarter(2024, 4, 90),
        mkQuarter(2024, 3, 80),
        mkQuarter(2024, 2, 70),
        mkQuarter(2024, 1, 60),
        mkQuarter(2023, 4, 50),
      ],
    };
    const f = transformFinancials({ metric: {} }, reported);
    expect(f.revenueTTM).toBe(300);
  });

  it("prefers m.revenueTTM when provided", () => {
    const reported: FinnhubFinancialsReported = {
      data: [
        {
          year: 2024,
          quarter: 4,
          report: { bs: [], cf: [], ic: [{ concept: "Revenue", value: 1 }] },
        },
      ],
    };
    const f = transformFinancials({ metric: { revenueTTM: 12_345 } }, reported);
    expect(f.revenueTTM).toBe(12_345);
  });
});

