import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { FinnhubClient } from "./client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("FinnhubClient", () => {
  it("rejects construction without an API key", () => {
    expect(() => new FinnhubClient({ apiKey: "" })).toThrow(
      /apiKey is required/u,
    );
  });

  it("attaches the X-Finnhub-Token header on each request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ c: 100 }),
    );
    const client = new FinnhubClient({
      apiKey: "key-123",
      baseUrl: "https://example.test",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    const r = await client.fetchQuote("AAPL");
    expect(isOk(r)).toBe(true);
    const call = fetchImpl.mock.calls[0];
    const url = String(call?.[0] ?? "");
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(url).toBe("https://example.test/quote?symbol=AAPL");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-finnhub-token"]).toBe("key-123");
    expect(headers.accept).toBe("application/json");
  });

  it("encodes symbols safely", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ name: "Berkshire" }),
    );
    const client = new FinnhubClient({
      apiKey: "k",
      baseUrl: "https://example.test",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    await client.fetchProfile("BRK.B");
    expect(String(fetchImpl.mock.calls[0]?.[0] ?? "")).toBe(
      "https://example.test/stock/profile2?symbol=BRK.B",
    );
  });

  it("returns err on non-2xx with status text and body snippet", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response("rate limit reached", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );
    const client = new FinnhubClient({
      apiKey: "k",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    const r = await client.fetchMetrics("AAPL");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("429");
    expect(r.error.message).toContain("Too Many Requests");
    expect(r.error.message).toContain("rate limit reached");
  });

  it("returns err on invalid JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response("not-json{", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new FinnhubClient({
      apiKey: "k",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    const r = await client.fetchQuote("AAPL");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("invalid JSON");
  });

  it("returns err when fetch throws", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("boom");
    });
    const client = new FinnhubClient({
      apiKey: "k",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    const r = await client.fetchFinancialsReported("AAPL");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("fetch failed");
    expect(r.error.message).toContain("boom");
  });

  it("requests quarterly frequency on financials-reported", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ data: [] }));
    const client = new FinnhubClient({
      apiKey: "k",
      baseUrl: "https://example.test",
      fetchImpl,
      rateLimitPerSecond: 1000,
    });
    await client.fetchFinancialsReported("AAPL");
    expect(String(fetchImpl.mock.calls[0]?.[0] ?? "")).toBe(
      "https://example.test/stock/financials-reported?symbol=AAPL&freq=quarterly",
    );
  });
});

