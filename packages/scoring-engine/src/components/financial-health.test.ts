import { describe, expect, it } from "vitest";
import { AMZN_FINANCIALS } from "../test-fixtures.js";
import { evaluateFinancialHealth } from "./financial-health.js";

describe("evaluateFinancialHealth", () => {
  it("scores AMZN-like inputs in the moderate range (~58)", () => {
    const result = evaluateFinancialHealth(AMZN_FINANCIALS);
    expect(result.summary.name).toBe("financial_health");
    expect(result.summary.weight).toBeCloseTo(0.35);
    expect(result.summary.score).toBeGreaterThanOrEqual(45);
    expect(result.summary.score).toBeLessThanOrEqual(70);
  });

  it("flags collapsed FCF as red", () => {
    const result = evaluateFinancialHealth(AMZN_FINANCIALS);
    const fcf = result.metrics.find((m) => m.key === "fcfMargin");
    expect(fcf?.status).toBe("amber");
    expect(fcf?.score).toBeLessThan(20);
  });

  it("flags negative FCF as red", () => {
    const result = evaluateFinancialHealth({
      ...AMZN_FINANCIALS,
      freeCashFlowTTM: -10_000_000_000,
    });
    const fcf = result.metrics.find((m) => m.key === "fcfMargin");
    expect(fcf?.status).toBe("red");
    expect(fcf?.score).toBe(0);
  });

  it("ranks a leverage-heavy company below a deleveraged one", () => {
    const heavy = evaluateFinancialHealth({
      ...AMZN_FINANCIALS,
      debtToEquity: 250,
      currentRatio: 0.6,
      netMargin: 1,
      freeCashFlowTTM: -5_000_000_000,
      returnOnEquity: 2,
    });
    const clean = evaluateFinancialHealth({
      ...AMZN_FINANCIALS,
      debtToEquity: 20,
      currentRatio: 2.5,
      netMargin: 25,
      freeCashFlowTTM: 90_000_000_000,
      returnOnEquity: 35,
    });
    expect(heavy.summary.score).toBeLessThan(clean.summary.score);
    expect(heavy.summary.score).toBeLessThan(20);
    expect(clean.summary.score).toBeGreaterThan(90);
  });

  it("treats null current ratio / ROE as 'unknown' without penalising", () => {
    const result = evaluateFinancialHealth({
      ...AMZN_FINANCIALS,
      currentRatio: null,
      returnOnEquity: null,
    });
    const cr = result.metrics.find((m) => m.key === "currentRatio");
    const roe = result.metrics.find((m) => m.key === "returnOnEquity");
    expect(cr?.status).toBe("unknown");
    expect(roe?.status).toBe("unknown");
    expect(result.summary.note).toMatch(/3\/5/);
  });
});

