import { describe, expect, it } from "vitest";
import {
  ComponentScoreSchema,
  RatingSchema,
  RiskScoreSchema,
} from "./score.js";
import { TickerInfoSchema, TickerSymbolSchema } from "./ticker.js";
import {
  KeyMetricsSchema,
  QuarterlyResultSchema,
} from "./financials.js";
import { ReportDataSchema } from "./report.js";
import { ProviderConfigSchema } from "./provider.js";

describe("TickerSymbolSchema", () => {
  it("accepts uppercase symbols including '.' and '-'", () => {
    expect(TickerSymbolSchema.parse("AMZN")).toBe("AMZN");
    expect(TickerSymbolSchema.parse("BRK.B")).toBe("BRK.B");
    expect(TickerSymbolSchema.parse("RDS-A")).toBe("RDS-A");
  });

  it("rejects lowercase, empty, or oversized symbols", () => {
    expect(() => TickerSymbolSchema.parse("amzn")).toThrow();
    expect(() => TickerSymbolSchema.parse("")).toThrow();
    expect(() => TickerSymbolSchema.parse("TOOLONGSYMBOL")).toThrow();
  });
});

describe("RatingSchema", () => {
  it("accepts every required rating literal", () => {
    const ratings = [
      "STRONG_BUY",
      "BUY",
      "HOLD",
      "SELL",
      "STRONG_SELL",
      "SPECULATIVE_BUY",
      "SPECULATIVE_HOLD",
    ] as const;
    for (const r of ratings) {
      expect(RatingSchema.parse(r)).toBe(r);
    }
  });

  it("rejects unknown rating strings", () => {
    expect(() => RatingSchema.parse("MAYBE")).toThrow();
  });
});

describe("ComponentScoreSchema", () => {
  it("validates a well-formed component score", () => {
    const parsed = ComponentScoreSchema.parse({
      name: "valuation",
      score: 72,
      weight: 0.35,
      note: "Fair",
    });
    expect(parsed.score).toBe(72);
  });

  it("rejects scores outside 0-100", () => {
    expect(() =>
      ComponentScoreSchema.parse({
        name: "growth",
        score: 120,
        weight: 0.3,
        note: null,
      }),
    ).toThrow();
  });

  it("rejects weights outside 0-1", () => {
    expect(() =>
      ComponentScoreSchema.parse({
        name: "growth",
        score: 80,
        weight: 1.2,
        note: null,
      }),
    ).toThrow();
  });
});

describe("RiskScoreSchema", () => {
  it("requires an integer composite in 0-100 and a known rating", () => {
    const parsed = RiskScoreSchema.parse({
      composite: 38,
      rating: "BUY",
      ratingPosition: 72,
      riskLabel: "Moderate-Low",
      strategy: "editorial",
      strategyVersion: "1.0.0",
      computedAt: "2026-04-24T00:00:00.000Z",
    });
    expect(parsed.composite).toBe(38);
    expect(parsed.rating).toBe("BUY");
  });
});

describe("ProviderConfigSchema", () => {
  it("requires positive timeout and non-negative priority", () => {
    expect(() =>
      ProviderConfigSchema.parse({
        name: "twelvedata",
        priority: -1,
        baseUrl: "https://example.com",
        apiKey: null,
        timeoutMs: 5000,
        enabled: true,
      }),
    ).toThrow();
  });
});

describe("ReportDataSchema (smoke)", () => {
  it("composes nested types — minimal AMZN-shaped payload validates", () => {
    const ticker = TickerInfoSchema.parse({
      symbol: "AMZN",
      name: "Amazon.com, Inc.",
      sector: "Consumer Discretionary",
      industry: "Internet Retail",
      exchange: "NASDAQ",
      description:
        "Amazon.com, Inc. engages in the retail sale of consumer products, advertising, and subscriptions service through online and physical stores.",
      currency: "USD",
      currentPrice: 263.99,
      priceChange: 8.91,
      priceChangePercent: 3.49,
      week52High: 264.5,
      week52Low: 165.29,
      marketCap: 2_830_000_000_000,
      volume: 53_350_000,
      averageVolume: 50_000_000,
    });
    expect(ticker.symbol).toBe("AMZN");

    const metrics = KeyMetricsSchema.parse({
      peRatioTTM: 34.9,
      peRatioForward: 28.85,
      priceToSales: 3.7,
      priceToBook: null,
      evToEbitda: 18.8,
      evToRevenue: 3.8,
      pegRatio: 1.2,
      dividendYield: null,
      payoutRatio: null,
    });
    expect(metrics.peRatioTTM).toBe(34.9);

    const q = QuarterlyResultSchema.parse({
      quarter: "Q4 2025",
      fiscalYear: 2025,
      revenue: 213.4,
      revenueGrowthYoYPercent: 14,
      operatingIncome: 21.2,
      operatingMarginPercent: 9.9,
      netIncome: null,
      eps: 2.12,
      segments: [
        { name: "AWS", revenue: 35.6, growthYoYPercent: 24 },
      ],
      notes: null,
    });
    expect(q.eps).toBe(2.12);

    expect(ReportDataSchema.shape.ticker).toBeDefined();
  });
});

