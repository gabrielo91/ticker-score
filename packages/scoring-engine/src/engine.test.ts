import { describe, expect, it } from "vitest";
import { Rating } from "@darkscore/types";
import { runScoring } from "./engine.js";
import { EditorialStrategy } from "./strategies/editorial.js";
import type {
  ComponentResult,
  CompositeResult,
  ScoringStrategy,
} from "./strategies/interface.js";
import {
  AMZN_FINANCIALS,
  AMZN_GROWTH,
  AMZN_KEY_METRICS,
} from "./test-fixtures.js";

const COMPUTED_AT = "2026-04-26T00:00:00.000Z";

describe("runScoring + EditorialStrategy", () => {
  it("computes a composite ≈ 38 for AMZN-like inputs", () => {
    const result = runScoring(
      {
        metrics: AMZN_KEY_METRICS,
        financials: AMZN_FINANCIALS,
        growth: AMZN_GROWTH,
        computedAt: COMPUTED_AT,
      },
      new EditorialStrategy(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { breakdown, components } = result.data;
    expect(breakdown.composite.composite).toBeGreaterThanOrEqual(25);
    expect(breakdown.composite.composite).toBeLessThanOrEqual(45);
    expect(breakdown.composite.strategy).toBe("editorial");
    expect(breakdown.composite.strategyVersion).toBe("1.0.0");
    expect(breakdown.composite.computedAt).toBe(COMPUTED_AT);
    expect(breakdown.components).toHaveLength(3);
    expect(components.valuation.summary.score).toBeGreaterThan(0);
    expect(components.financialHealth.summary.score).toBeGreaterThan(0);
    expect(components.growth.summary.score).toBeGreaterThan(0);
  });

  it("composite is the inverse of the weighted component average", () => {
    const result = runScoring(
      {
        metrics: AMZN_KEY_METRICS,
        financials: AMZN_FINANCIALS,
        growth: AMZN_GROWTH,
        computedAt: COMPUTED_AT,
      },
      new EditorialStrategy(),
    );
    if (!result.ok) throw new Error("expected ok");
    const components = result.data.breakdown.components;
    const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
    const weightedSum = components.reduce(
      (acc, c) => acc + c.score * c.weight,
      0,
    );
    const expected = Math.round(100 - weightedSum / totalWeight);
    expect(result.data.breakdown.composite.composite).toBe(expected);
  });

  it("attaches a moderate-leaning rating + risk label for AMZN", () => {
    const result = runScoring(
      {
        metrics: AMZN_KEY_METRICS,
        financials: AMZN_FINANCIALS,
        growth: AMZN_GROWTH,
        computedAt: COMPUTED_AT,
      },
      new EditorialStrategy(),
    );
    if (!result.ok) throw new Error("expected ok");
    const composite = result.data.breakdown.composite;
    expect([Rating.BUY, Rating.HOLD]).toContain(composite.rating);
    expect(composite.riskLabel).toMatch(/Moderate/);
    expect(composite.ratingPosition).toBe(composite.composite);
  });

  it("is deterministic — same inputs ⇒ same outputs", () => {
    const strategy = new EditorialStrategy();
    const input = {
      metrics: AMZN_KEY_METRICS,
      financials: AMZN_FINANCIALS,
      growth: AMZN_GROWTH,
      computedAt: COMPUTED_AT,
    };
    const a = runScoring(input, strategy);
    const b = runScoring(input, strategy);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.data.breakdown).toEqual(b.data.breakdown);
  });

  it("supports a swappable mock strategy", () => {
    const mock: ScoringStrategy = {
      name: "mock",
      version: "0.0.1",
      computeValuationScore: (): ComponentResult => ({
        summary: { name: "valuation", score: 50, weight: 0.4, note: null },
        metrics: [],
      }),
      computeHealthScore: (): ComponentResult => ({
        summary: {
          name: "financial_health",
          score: 50,
          weight: 0.3,
          note: null,
        },
        metrics: [],
      }),
      computeGrowthScore: (): ComponentResult => ({
        summary: { name: "growth", score: 50, weight: 0.3, note: null },
        metrics: [],
      }),
      computeComposite: (): CompositeResult => ({
        composite: 99,
        rating: Rating.STRONG_SELL,
        ratingPosition: 99,
        riskLabel: "High Risk",
      }),
      determineRating: () => Rating.STRONG_SELL,
    };
    const result = runScoring(
      {
        metrics: AMZN_KEY_METRICS,
        financials: AMZN_FINANCIALS,
        growth: AMZN_GROWTH,
        computedAt: COMPUTED_AT,
      },
      mock,
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.breakdown.composite.composite).toBe(99);
    expect(result.data.breakdown.composite.strategy).toBe("mock");
    expect(result.data.breakdown.composite.rating).toBe(Rating.STRONG_SELL);
  });

  it("returns a Result.err if the strategy throws", () => {
    const broken: ScoringStrategy = {
      name: "broken",
      version: "0",
      computeValuationScore: () => {
        throw new Error("boom");
      },
      computeHealthScore: () => {
        throw new Error("never");
      },
      computeGrowthScore: () => {
        throw new Error("never");
      },
      computeComposite: () => ({
        composite: 0,
        rating: Rating.HOLD,
        ratingPosition: 0,
        riskLabel: "x",
      }),
      determineRating: () => Rating.HOLD,
    };
    const result = runScoring(
      {
        metrics: AMZN_KEY_METRICS,
        financials: AMZN_FINANCIALS,
        growth: AMZN_GROWTH,
        computedAt: COMPUTED_AT,
      },
      broken,
    );
    expect(result.ok).toBe(false);
  });
});

