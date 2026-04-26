import { describe, expect, it } from "vitest";
import { AMZN_GROWTH } from "../test-fixtures.js";
import { evaluateGrowth } from "./growth.js";

describe("evaluateGrowth", () => {
  it("scores AMZN-like growth as strong (>= 70)", () => {
    const result = evaluateGrowth(AMZN_GROWTH);
    expect(result.summary.name).toBe("growth");
    expect(result.summary.weight).toBeCloseTo(0.3);
    expect(result.summary.score).toBeGreaterThanOrEqual(70);
  });

  it("scores stagnant revenue / shrinking earnings as weak", () => {
    const result = evaluateGrowth({
      ...AMZN_GROWTH,
      revenueGrowthYoY: 0,
      revenueGrowthForward: 0,
      earningsGrowthForward: -10,
      ebitdaGrowthForward: -5,
    });
    expect(result.summary.score).toBeLessThan(20);
  });

  it("skips missing forward estimates without penalising", () => {
    const result = evaluateGrowth({
      ...AMZN_GROWTH,
      revenueGrowthForward: null,
      earningsGrowthForward: null,
      ebitdaGrowthForward: null,
    });
    expect(result.summary.note).toMatch(/1\/4/);
    expect(result.summary.score).toBeGreaterThanOrEqual(0);
  });

  it("returns one assessment per metric", () => {
    const keys = evaluateGrowth(AMZN_GROWTH)
      .metrics.map((m) => m.key)
      .sort();
    expect(keys).toEqual([
      "earningsGrowthForward",
      "ebitdaGrowthForward",
      "revenueGrowthForward",
      "revenueGrowthYoY",
    ]);
  });
});

