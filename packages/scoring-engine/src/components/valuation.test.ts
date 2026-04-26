import { describe, expect, it } from "vitest";
import { AMZN_KEY_METRICS } from "../test-fixtures.js";
import { evaluateValuation } from "./valuation.js";

describe("evaluateValuation", () => {
  it("scores AMZN-like inputs in the moderate range", () => {
    const result = evaluateValuation(AMZN_KEY_METRICS);
    expect(result.summary.name).toBe("valuation");
    expect(result.summary.weight).toBeCloseTo(0.35);
    expect(result.summary.score).toBeGreaterThanOrEqual(45);
    expect(result.summary.score).toBeLessThanOrEqual(75);
  });

  it("emits a metric assessment for every input field", () => {
    const result = evaluateValuation(AMZN_KEY_METRICS);
    const keys = result.metrics.map((m) => m.key).sort();
    expect(keys).toEqual([
      "evToEbitda",
      "peRatioForward",
      "peRatioTTM",
      "priceToBook",
      "priceToSales",
      "pegRatio",
    ].sort());
  });

  it("marks missing metrics as 'unknown' and skips them in the average", () => {
    const result = evaluateValuation(AMZN_KEY_METRICS);
    const pb = result.metrics.find((m) => m.key === "priceToBook");
    expect(pb?.status).toBe("unknown");
    expect(result.summary.note).toMatch(/5\/6/);
  });

  it("scores cheap valuations higher than expensive ones", () => {
    const expensive = evaluateValuation({
      ...AMZN_KEY_METRICS,
      peRatioTTM: 80,
      peRatioForward: 70,
      priceToSales: 20,
      evToEbitda: 40,
      pegRatio: 5,
    });
    const cheap = evaluateValuation({
      ...AMZN_KEY_METRICS,
      peRatioTTM: 8,
      peRatioForward: 7,
      priceToSales: 1.5,
      evToEbitda: 6,
      pegRatio: 0.8,
    });
    expect(cheap.summary.score).toBeGreaterThan(expensive.summary.score);
    expect(expensive.summary.score).toBeLessThan(20);
    expect(cheap.summary.score).toBeGreaterThan(90);
  });

  it("returns score 0 with a note when every metric is missing", () => {
    const result = evaluateValuation({
      peRatioTTM: null,
      peRatioForward: null,
      priceToSales: null,
      priceToBook: null,
      evToEbitda: null,
      evToRevenue: null,
      pegRatio: null,
      dividendYield: null,
      payoutRatio: null,
    });
    expect(result.summary.score).toBe(0);
    expect(result.summary.note).toBe("No valuation metrics available");
  });
});

