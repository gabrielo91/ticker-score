import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { AlphaVantageClient } from "./client.js";
import { AlphaVantageProvider } from "./index.js";

interface Payloads {
  overview?: unknown;
  series?: unknown;
  income?: unknown;
  balance?: unknown;
  earnings?: unknown;
}

function buildClient(payloads: Payloads): AlphaVantageClient {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("function=OVERVIEW")) body = payloads.overview ?? {};
    else if (url.includes("function=TIME_SERIES_DAILY"))
      body = payloads.series ?? { "Time Series (Daily)": {} };
    else if (url.includes("function=INCOME_STATEMENT"))
      body = payloads.income ?? { annualReports: [], quarterlyReports: [] };
    else if (url.includes("function=BALANCE_SHEET"))
      body = payloads.balance ?? { annualReports: [], quarterlyReports: [] };
    else if (url.includes("function=EARNINGS"))
      body = payloads.earnings ?? { quarterlyEarnings: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return new AlphaVantageClient({
    apiKey: "k",
    fetchImpl,
    rateLimitPerMinute: 1000,
  });
}

const SAMPLE_OVERVIEW = {
  Symbol: "AAPL",
  Name: "Apple Inc.",
  Currency: "USD",
  Sector: "Technology",
  Industry: "Consumer Electronics",
  Exchange: "NASDAQ",
  Description: "Apple designs phones.",
  MarketCapitalization: "3000000000000",
  PERatio: "28.45",
  ForwardPE: "27.0",
  PEGRatio: "2.1",
  AnalystTargetPrice: "210.0",
  "52WeekHigh": "260.0",
  "52WeekLow": "150.0",
};

const SAMPLE_SERIES = {
  "Time Series (Daily)": {
    "2026-04-25": { "1. open": "200", "2. high": "205", "3. low": "199", "4. close": "204", "5. volume": "1000" },
    "2026-04-24": { "1. open": "198", "2. high": "201", "3. low": "197", "4. close": "200", "5. volume": "1100" },
  },
};

describe("AlphaVantageProvider", () => {
  it("exposes the canonical name and default priority", () => {
    const p = new AlphaVantageProvider({ apiKey: "k" });
    expect(p.name).toBe("alpha-vantage");
    expect(p.priority).toBe(100);
  });

  it("getTickerInfo merges OVERVIEW + TIME_SERIES_DAILY", async () => {
    const client = buildClient({ overview: SAMPLE_OVERVIEW, series: SAMPLE_SERIES });
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.name).toBe("Apple Inc.");
    expect(r.data.currency).toBe("USD");
    expect(r.data.currentPrice).toBe(204);
    expect(r.data.week52High).toBe(260);
    expect(r.data.marketCap).toBe(3_000_000_000_000);
  });

  it("getTickerInfo errs on empty OVERVIEW (unknown symbol)", async () => {
    const client = buildClient({ overview: {}, series: SAMPLE_SERIES });
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("ZZZZ");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toMatch(/empty OVERVIEW/u);
  });

  it("getKeyMetrics extracts forward P/E + PEG from OVERVIEW", async () => {
    const client = buildClient({ overview: SAMPLE_OVERVIEW });
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getKeyMetrics("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.peRatioForward).toBe(27);
    expect(r.data.pegRatio).toBe(2.1);
    expect(r.data.peRatioTTM).toBe(28.45);
  });

  it("getPriceHistory rejects non-positive months", async () => {
    const client = buildClient({ series: SAMPLE_SERIES });
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getPriceHistory("AAPL", 0);
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toMatch(/months must be > 0/u);
  });

  it("getQuarterlyResults requires quarters > 0", async () => {
    const client = buildClient({});
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getQuarterlyResults("AAPL", 0);
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toMatch(/quarters must be > 0/u);
  });

  it("propagates upstream Error Message envelope as Result.err", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ "Error Message": "Invalid API call" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new AlphaVantageClient({
      apiKey: "k",
      fetchImpl,
      rateLimitPerMinute: 1000,
    });
    const p = new AlphaVantageProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("AAPL");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toMatch(/Invalid API call/u);
  });
});

