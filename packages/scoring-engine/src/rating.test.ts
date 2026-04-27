import { describe, expect, it } from "vitest";
import { Rating } from "@darkscore/types";
import {
  determineRating,
  determineRiskLabel,
  ratingPosition,
} from "./rating.js";

describe("determineRating", () => {
  it.each([
    [0, Rating.STRONG_BUY],
    [10, Rating.STRONG_BUY],
    [20, Rating.STRONG_BUY],
    [21, Rating.BUY],
    [33, Rating.BUY],
    [40, Rating.BUY],
    [41, Rating.HOLD],
    [55, Rating.HOLD],
    [60, Rating.HOLD],
    [61, Rating.SELL],
    [75, Rating.SELL],
    [76, Rating.STRONG_SELL],
    [99, Rating.STRONG_SELL],
    [100, Rating.STRONG_SELL],
  ])("score %d → %s", (score, expected) => {
    expect(determineRating(score)).toBe(expected);
  });

  it("clamps out-of-range scores", () => {
    expect(determineRating(-50)).toBe(Rating.STRONG_BUY);
    expect(determineRating(150)).toBe(Rating.STRONG_SELL);
  });
});

describe("determineRiskLabel", () => {
  it.each([
    [10, "Low Risk"],
    [33, "Low-Moderate Risk"],
    [50, "Moderate Risk"],
    [70, "Moderate-High Risk"],
    [90, "High Risk"],
  ])("score %d → %s", (score, expected) => {
    expect(determineRiskLabel(score)).toBe(expected);
  });
});

describe("ratingPosition", () => {
  it("returns the rating-axis position (inverse of risk)", () => {
    expect(ratingPosition(0)).toBe(100);
    expect(ratingPosition(100)).toBe(0);
    expect(ratingPosition(42)).toBe(58);
  });

  it("clamps out-of-range risk before inverting", () => {
    expect(ratingPosition(-10)).toBe(100);
    expect(ratingPosition(110)).toBe(0);
  });
});

