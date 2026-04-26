import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { RateLimiter, YahooClient } from "./client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("YahooClient", () => {
  it("returns ok with parsed JSON on a 200 response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ quoteSummary: { result: [], error: null } }),
    );
    const client = new YahooClient({ fetchImpl });
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isOk(r)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/v10/finance/quoteSummary/AMZN");
    expect(url).toContain("modules=price");
  });

  it("returns err on a non-2xx response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("nope", {
          status: 503,
          statusText: "Service Unavailable",
        }),
    );
    const client = new YahooClient({ fetchImpl });
    const r = await client.fetchChart("AMZN", "1y", "1d");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/503/u);
  });

  it("returns err when fetch throws (network error)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("ECONNRESET");
    });
    const client = new YahooClient({ fetchImpl });
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/ECONNRESET/u);
  });

  it("URL-encodes the symbol segment", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}));
    const client = new YahooClient({ fetchImpl });
    await client.fetchChart("BRK.B", "1y", "1d");
    const url = String(fetchImpl.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/v8/finance/chart/BRK.B");
  });
});

describe("RateLimiter", () => {
  it("admits requests up to the limit immediately", async () => {
    const limiter = new RateLimiter(5, 1000);
    const now = vi.fn(() => 1_000_000);
    const start = Date.now();
    for (let i = 0; i < 5; i++) await limiter.acquire(now);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("waits when the window is full", async () => {
    const limiter = new RateLimiter(2, 50);
    await limiter.acquire();
    await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it("rejects non-positive limits", () => {
    expect(() => new RateLimiter(0)).toThrow(/limit must be > 0/u);
  });
});

