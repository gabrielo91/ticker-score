import { describe, expect, expectTypeOf, it } from "vitest";
import { err, isErr, isOk, ok, type Result } from "./result.js";

describe("Result<T, E>", () => {
  it("ok() produces a discriminated success value", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.data).toBe(42);
  });

  it("err() produces a discriminated failure value", () => {
    const e = new Error("boom");
    const r = err(e);
    expect(r.ok).toBe(false);
    expect(r.error).toBe(e);
  });

  it("narrows both branches of the discriminated union", () => {
    const inspect = (r: Result<number, string>): string => {
      if (r.ok) {
        expectTypeOf(r.data).toEqualTypeOf<number>();
        return `data=${r.data}`;
      }
      expectTypeOf(r.error).toEqualTypeOf<string>();
      return `error=${r.error}`;
    };
    expect(inspect(ok(7))).toBe("data=7");
    expect(inspect(err("nope"))).toBe("error=nope");
  });

  it("isOk / isErr type guards narrow correctly", () => {
    const success: Result<number, string> = ok(1);
    const failure: Result<number, string> = err("x");
    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
    if (isOk(success)) {
      expectTypeOf(success.data).toEqualTypeOf<number>();
    }
    if (isErr(failure)) {
      expectTypeOf(failure.error).toEqualTypeOf<string>();
    }
  });

  it("defaults the error type to Error when omitted", () => {
    const r = err(new Error("default"));
    expectTypeOf(r).toEqualTypeOf<{ readonly ok: false; readonly error: Error }>();
    expect(r.error).toBeInstanceOf(Error);
  });
});

