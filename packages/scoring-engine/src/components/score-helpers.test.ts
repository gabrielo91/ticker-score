import { describe, expect, it } from "vitest";
import {
  averageScores,
  clamp,
  roundToInt,
  scoreDirectional,
  statusFor,
} from "./score-helpers.js";

describe("scoreDirectional", () => {
  it("returns null for missing or non-finite values", () => {
    const t = { good: 10, bad: 50, lowerIsBetter: true };
    expect(scoreDirectional(null, t)).toBeNull();
    expect(scoreDirectional(NaN, t)).toBeNull();
    expect(scoreDirectional(Number.POSITIVE_INFINITY, t)).toBeNull();
  });

  it("clamps below the worst threshold to 0", () => {
    expect(scoreDirectional(60, { good: 10, bad: 50, lowerIsBetter: true })).toBe(0);
    expect(scoreDirectional(-5, { good: 15, bad: 0, lowerIsBetter: false })).toBe(0);
  });

  it("clamps beyond the best threshold to 100", () => {
    expect(scoreDirectional(5, { good: 10, bad: 50, lowerIsBetter: true })).toBe(100);
    expect(scoreDirectional(50, { good: 15, bad: 0, lowerIsBetter: false })).toBe(100);
  });

  it("interpolates linearly between the two anchors (lowerIsBetter)", () => {
    const t = { good: 10, bad: 50, lowerIsBetter: true };
    expect(scoreDirectional(30, t)).toBe(50);
    expect(scoreDirectional(20, t)).toBe(75);
  });

  it("interpolates linearly between the two anchors (higherIsBetter)", () => {
    const t = { good: 20, bad: 0, lowerIsBetter: false };
    expect(scoreDirectional(10, t)).toBe(50);
    expect(scoreDirectional(15, t)).toBe(75);
  });

  it("returns 0 when good === bad (degenerate threshold)", () => {
    expect(scoreDirectional(5, { good: 10, bad: 10, lowerIsBetter: true })).toBe(0);
  });
});

describe("statusFor", () => {
  it("classifies missing values as 'unknown'", () => {
    expect(statusFor(null, { good: 10, bad: 50, lowerIsBetter: true })).toBe("unknown");
  });

  it("returns green/amber/red for lowerIsBetter metrics", () => {
    const t = { good: 10, bad: 50, lowerIsBetter: true, amberAt: 25 };
    expect(statusFor(8, t)).toBe("green");
    expect(statusFor(25, t)).toBe("green");
    expect(statusFor(40, t)).toBe("amber");
    expect(statusFor(60, t)).toBe("red");
  });

  it("returns green/amber/red for higherIsBetter metrics", () => {
    const t = { good: 20, bad: 0, lowerIsBetter: false, amberAt: 8 };
    expect(statusFor(15, t)).toBe("green");
    expect(statusFor(8, t)).toBe("green");
    expect(statusFor(3, t)).toBe("amber");
    expect(statusFor(-1, t)).toBe("red");
  });

  it("falls back to the midpoint when amberAt is missing", () => {
    const t = { good: 10, bad: 50, lowerIsBetter: true };
    expect(statusFor(20, t)).toBe("green");
    expect(statusFor(40, t)).toBe("amber");
  });
});

describe("averageScores", () => {
  it("ignores null entries", () => {
    expect(averageScores([100, null, 50])).toBe(75);
  });
  it("returns 0 when nothing is present", () => {
    expect(averageScores([null, null])).toBe(0);
  });
});

describe("clamp / roundToInt", () => {
  it("clamps within [min, max]", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-1, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it("roundToInt rounds and clamps to 0-100", () => {
    expect(roundToInt(73.4)).toBe(73);
    expect(roundToInt(73.6)).toBe(74);
    expect(roundToInt(150)).toBe(100);
    expect(roundToInt(-3)).toBe(0);
  });
});

