import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { FinnhubClient } from "./client.js";
import { FinnhubProvider } from "./index.js";

interface Payloads {
  quote?: unknown;
  profile?: unknown;
  metric?: unknown;
  financials?: unknown;
}

function buildClient(payloads: Payloads): FinnhubClient {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/quote?")) body = payloads.quote ?? { c: 100, d: 0, dp: 0 };
    else if (url.includes("/stock/profile2?")) body = payloads.profile ?? {};
    else if (url.includes("/stock/metric?")) body = payloads.metric ?? {};
    else if (url.includes("/stock/financials-reported?"))
      body = payloads.financials ?? { data: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return new FinnhubClient({
    apiKey: "k",
    fetchImpl,
    rateLimitPerSecond: 1000,
  });
}

describe("FinnhubProvider", () => {
  it("exposes name and default priority", () => {
    const p = new FinnhubProvider({ apiKey: "k" });
    expect(p.name).toBe("finnhub");
    expect(p.priority).toBe(1);
  });

  it("getTickerInfo combines quote + profile + metric in parallel", async () => {
    const client = buildClient({
      quote: { c: 175, d: 1.5, dp: 0.86, h: 176, l: 173 },
      profile: {
        name: "Apple Inc",
        exchange: "NASDAQ",
        currency: "USD",
        finnhubIndustry: "Technology",
        marketCapitalization: 2_500_000,
      },
      metric: { metric: { "52WeekHigh": 200, "52WeekLow": 130 } },
    });
    const p = new FinnhubProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.name).toBe("Apple Inc");
    expect(r.data.currentPrice).toBe(175);
    expect(r.data.week52High).toBe(200);
    expect(r.data.marketCap).toBe(2_500_000_000_000);
  });

  it("getTickerInfo errs on empty quote (unknown symbol)", async () => {
    const client = buildClient({
      quote: { c: 0, d: 0, dp: 0 },
      profile: { name: "" },
      metric: { metric: {} },
    });
    const p = new FinnhubProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("ZZZZ");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("empty quote");
  });

  it("getTickerInfo tolerates a missing metric block", async () => {
    const client = buildClient({
      quote: { c: 50, d: 0, dp: 0, h: 60, l: 40 },
      profile: { name: "X", currency: "USD" },
      // schemas pass; transforms see undefined metric.metric
      metric: {},
    });
    const p = new FinnhubProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("X");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.week52High).toBe(60);
    expect(r.data.week52Low).toBe(40);
  });

  it("getKeyMetrics returns Result<KeyMetrics>", async () => {
    const client = buildClient({
      metric: { metric: { peTTM: 30, dividendYieldIndicatedAnnual: 0.6 } },
    });
    const p = new FinnhubProvider({ apiKey: "k", client });
    const r = await p.getKeyMetrics("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.peRatioTTM).toBe(30);
    expect(r.data.dividendYield).toBe(0.6);
  });

  it("getQuarterlyResults rejects non-positive quarters", async () => {
    const p = new FinnhubProvider({ apiKey: "k", client: buildClient({}) });
    const r = await p.getQuarterlyResults("AAPL", 0);
    expect(isErr(r)).toBe(true);
  });

  it("getPriceHistory always errs (free-tier endpoint unavailable)", async () => {
    const p = new FinnhubProvider({ apiKey: "k", client: buildClient({}) });
    const r = await p.getPriceHistory("AAPL", 12);
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("free tier");
  });

  it("isAvailable returns true on a positive quote", async () => {
    const client = buildClient({ quote: { c: 10, d: 0, dp: 0 } });
    const p = new FinnhubProvider({ apiKey: "k", client });
    expect(await p.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when quote is empty", async () => {
    const client = buildClient({ quote: { c: 0, d: 0, dp: 0 } });
    const p = new FinnhubProvider({ apiKey: "k", client });
    expect(await p.isAvailable()).toBe(false);
  });
});

