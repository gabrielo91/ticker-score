import { describe, expect, it } from "vitest";
import {
  ONE_HOUR_MS,
  bucketTimestamp,
  buildCacheKey,
} from "./keys.js";

describe("bucketTimestamp", () => {
  it("floors to the start of the hour by default", () => {
    // 2026-04-26T14:37:42.123Z
    const ts = Date.UTC(2026, 3, 26, 14, 37, 42, 123);
    const expected = Date.UTC(2026, 3, 26, 14, 0, 0, 0);
    expect(bucketTimestamp(ts)).toBe(expected);
  });

  it("returns identical buckets for any timestamp inside the same hour", () => {
    const start = Date.UTC(2026, 3, 26, 14, 0, 0, 0);
    const mid = Date.UTC(2026, 3, 26, 14, 30, 0, 0);
    const end = Date.UTC(2026, 3, 26, 14, 59, 59, 999);
    expect(bucketTimestamp(start)).toBe(start);
    expect(bucketTimestamp(mid)).toBe(start);
    expect(bucketTimestamp(end)).toBe(start);
  });

  it("crosses to the next bucket on the hour boundary", () => {
    const justBefore = Date.UTC(2026, 3, 26, 14, 59, 59, 999);
    const onHour = Date.UTC(2026, 3, 26, 15, 0, 0, 0);
    expect(bucketTimestamp(onHour)).toBe(onHour);
    expect(bucketTimestamp(justBefore)).not.toBe(bucketTimestamp(onHour));
  });

  it("supports a custom bucket size", () => {
    const fiveMin = 5 * 60 * 1000;
    const ts = Date.UTC(2026, 3, 26, 14, 37, 42, 0);
    const expected = Date.UTC(2026, 3, 26, 14, 35, 0, 0);
    expect(bucketTimestamp(ts, fiveMin)).toBe(expected);
  });

  it("rejects non-finite or non-positive inputs", () => {
    expect(() => bucketTimestamp(Number.NaN)).toThrow(TypeError);
    expect(() => bucketTimestamp(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => bucketTimestamp(0, 0)).toThrow(TypeError);
    expect(() => bucketTimestamp(0, -1)).toThrow(TypeError);
  });
});

describe("buildCacheKey", () => {
  it("produces the canonical {provider}:{ticker}:{dataType}:{bucket} format", () => {
    const ts = Date.UTC(2026, 3, 26, 14, 30, 0, 0);
    const bucket = Date.UTC(2026, 3, 26, 14, 0, 0, 0);
    expect(
      buildCacheKey({
        provider: "yahoo",
        ticker: "AMZN",
        dataType: "quote",
        timestamp: ts,
      }),
    ).toBe(`yahoo:AMZN:quote:${bucket}`);
  });

  it("uppercases the ticker so case variations collide", () => {
    const ts = Date.UTC(2026, 3, 26, 14, 0, 0, 0);
    const lower = buildCacheKey({
      provider: "yahoo",
      ticker: "aapl",
      dataType: "quote",
      timestamp: ts,
    });
    const upper = buildCacheKey({
      provider: "yahoo",
      ticker: "AAPL",
      dataType: "quote",
      timestamp: ts,
    });
    expect(lower).toBe(upper);
  });

  it("is deterministic for identical inputs", () => {
    const parts = {
      provider: "yahoo",
      ticker: "MSFT",
      dataType: "financials",
      timestamp: Date.UTC(2026, 3, 26, 12, 15, 0, 0),
    } as const;
    expect(buildCacheKey(parts)).toBe(buildCacheKey(parts));
  });

  it("collides for any two timestamps inside the same hour bucket", () => {
    const a = Date.UTC(2026, 3, 26, 14, 1, 0, 0);
    const b = Date.UTC(2026, 3, 26, 14, 58, 0, 0);
    const k = (timestamp: number): string =>
      buildCacheKey({ provider: "yahoo", ticker: "AMZN", dataType: "quote", timestamp });
    expect(k(a)).toBe(k(b));
  });

  it("defaults timestamp to Date.now() when omitted", () => {
    const before = bucketTimestamp(Date.now());
    const key = buildCacheKey({ provider: "yahoo", ticker: "AMZN", dataType: "quote" });
    const after = bucketTimestamp(Date.now());
    // Bucket must equal one of the (at most two) hour buckets straddled by the call.
    const trailing = key.split(":").pop();
    expect(trailing).toBeDefined();
    const bucket = Number(trailing);
    expect([before, after]).toContain(bucket);
  });

  it("uses ONE_HOUR_MS as the default bucket width", () => {
    expect(ONE_HOUR_MS).toBe(60 * 60 * 1000);
  });
});

