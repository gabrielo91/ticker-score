import { describe, expect, it } from "vitest";
import {
  ChartResponseSchema,
  QuoteSummaryResponseSchema,
  RawNumberSchema,
} from "./schemas.js";

describe("RawNumberSchema", () => {
  it("unwraps Yahoo's {raw, fmt} envelope", () => {
    expect(RawNumberSchema.parse({ raw: 123.45, fmt: "123.45" })).toBe(123.45);
  });

  it("accepts a bare number", () => {
    expect(RawNumberSchema.parse(42)).toBe(42);
  });

  it("returns null for the empty-object placeholder", () => {
    expect(RawNumberSchema.parse({})).toBeNull();
  });

  it("rejects strings and other shapes", () => {
    expect(RawNumberSchema.safeParse("123").success).toBe(false);
    expect(RawNumberSchema.safeParse(null).success).toBe(false);
  });
});

describe("QuoteSummaryResponseSchema", () => {
  it("accepts a realistic quoteSummary payload", () => {
    const sample = {
      quoteSummary: {
        result: [
          {
            price: {
              longName: "Amazon.com, Inc.",
              currency: "USD",
              regularMarketPrice: { raw: 175.12, fmt: "175.12" },
              regularMarketChange: { raw: 1.5, fmt: "1.50" },
              regularMarketChangePercent: { raw: 0.0086, fmt: "0.86%" },
              marketCap: { raw: 1_800_000_000_000, fmt: "1.8T" },
              regularMarketVolume: { raw: 35_000_000, fmt: "35M" },
              averageDailyVolume3Month: { raw: 42_000_000, fmt: "42M" },
              exchangeName: "NMS",
            },
            summaryDetail: {
              fiftyTwoWeekHigh: { raw: 200, fmt: "200" },
              fiftyTwoWeekLow: { raw: 100, fmt: "100" },
              trailingPE: { raw: 60, fmt: "60" },
              dividendYield: {},
              payoutRatio: {},
            },
            assetProfile: {
              sector: "Consumer Cyclical",
              industry: "Internet Retail",
            },
          },
        ],
        error: null,
      },
    };
    const parsed = QuoteSummaryResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("preserves unknown top-level keys via passthrough", () => {
    const sample = {
      quoteSummary: { result: [], error: null, somethingNew: 1 },
      meta: { version: "v10" },
    };
    const parsed = QuoteSummaryResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("rejects payloads missing quoteSummary entirely", () => {
    expect(QuoteSummaryResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("ChartResponseSchema", () => {
  it("accepts a chart payload with timestamps and quote arrays", () => {
    const sample = {
      chart: {
        result: [
          {
            meta: { symbol: "AMZN", currency: "USD" },
            timestamp: [1_700_000_000, 1_700_086_400],
            indicators: {
              quote: [
                {
                  open: [100, 101],
                  high: [102, 103],
                  low: [99, 100],
                  close: [101, 102],
                  volume: [1_000_000, 1_100_000],
                },
              ],
            },
          },
        ],
        error: null,
      },
    };
    expect(ChartResponseSchema.safeParse(sample).success).toBe(true);
  });

  it("rejects when indicators.quote is empty", () => {
    const sample = {
      chart: {
        result: [
          {
            timestamp: [],
            indicators: { quote: [] },
          },
        ],
        error: null,
      },
    };
    expect(ChartResponseSchema.safeParse(sample).success).toBe(false);
  });
});

