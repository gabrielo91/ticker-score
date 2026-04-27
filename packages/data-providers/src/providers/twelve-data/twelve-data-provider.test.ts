import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { TwelveDataClient } from "./client.js";
import { TwelveDataProvider } from "./index.js";

interface Payloads {
  quote?: unknown;
  profile?: unknown;
  statistics?: unknown;
  timeSeries?: unknown;
  incomeAnnual?: unknown;
  incomeQuarter?: unknown;
  balance?: unknown;
}

function buildClient(payloads: Payloads): TwelveDataClient {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/quote?")) {
      body = payloads.quote ?? { close: "100", change: "0", percent_change: "0" };
    } else if (url.includes("/profile?")) {
      body = payloads.profile ?? {};
    } else if (url.includes("/statistics?")) {
      body = payloads.statistics ?? { statistics: {} };
    } else if (url.includes("/time_series?")) {
      body = payloads.timeSeries ?? { values: [] };
    } else if (url.includes("/income_statement?")) {
      body = url.includes("period=quarter")
        ? payloads.incomeQuarter ?? { income_statement: [] }
        : payloads.incomeAnnual ?? { income_statement: [] };
    } else if (url.includes("/balance_sheet?")) {
      body = payloads.balance ?? { balance_sheet: [] };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return new TwelveDataClient({
    apiKey: "k",
    fetchImpl,
    rateLimitPerMinute: 10_000,
  });
}

describe("TwelveDataProvider", () => {
  it("exposes name and default priority", () => {
    const p = new TwelveDataProvider({ apiKey: "k" });
    expect(p.name).toBe("twelvedata");
    expect(p.priority).toBe(0);
  });

  it("getTickerInfo combines quote + profile + statistics in parallel", async () => {
    const client = buildClient({
      quote: {
        symbol: "AAPL",
        name: "Apple Inc",
        currency: "USD",
        close: "175.12",
        change: "1.23",
        percent_change: "0.71",
        volume: "12345678",
        fifty_two_week: { high: "200", low: "130" },
      },
      profile: {
        name: "Apple Inc",
        exchange: "NASDAQ",
        sector: "Technology",
        industry: "Consumer Electronics",
        description: "Apple designs, manufactures and markets smartphones.",
      },
      statistics: {
        statistics: {
          valuations_metrics: { market_capitalization: "2500000000000" },
        },
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.symbol).toBe("AAPL");
    expect(r.data.name).toBe("Apple Inc");
    expect(r.data.sector).toBe("Technology");
    expect(r.data.industry).toBe("Consumer Electronics");
    expect(r.data.currentPrice).toBeCloseTo(175.12, 5);
    expect(r.data.priceChangePercent).toBeCloseTo(0.0071, 5);
    expect(r.data.week52High).toBe(200);
    expect(r.data.marketCap).toBe(2_500_000_000_000);
  });

  it("getTickerInfo errs when quote validation fails", async () => {
    const client = buildClient({ quote: { close: ["not-a-number"] } });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("XYZ");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("quote response failed validation");
  });

  it("getTickerInfo tolerates missing profile + statistics", async () => {
    const client = buildClient({
      quote: { close: "50", change: "0", percent_change: "0", currency: "USD" },
      profile: { weird: "shape" },
      statistics: { statistics: { valuations_metrics: {} } },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("XYZ");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.name).toBe("XYZ");
    expect(r.data.sector).toBeNull();
    expect(r.data.marketCap).toBeNull();
  });

  it("getKeyMetrics maps PE / PEG / dividend yield from /statistics", async () => {
    const client = buildClient({
      statistics: {
        statistics: {
          valuations_metrics: {
            trailing_pe: "32.1",
            forward_pe: "28.5",
            peg_ratio: "1.8",
            price_to_sales_ttm: "8.2",
            price_to_book_mrq: "55.3",
            enterprise_to_ebitda: "24.4",
          },
          dividends_and_splits: {
            forward_annual_dividend_yield: "0.0049",
            payout_ratio: "0.16",
          },
        },
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getKeyMetrics("AAPL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.peRatioTTM).toBe(32.1);
    expect(r.data.peRatioForward).toBe(28.5);
    expect(r.data.pegRatio).toBe(1.8);
    expect(r.data.dividendYield).toBe(0.0049);
    expect(r.data.payoutRatio).toBe(0.16);
  });

  it("getQuarterlyResults parses YoY growth across quarters", async () => {
    const client = buildClient({
      incomeQuarter: {
        income_statement: [
          { fiscal_date: "2024-09-28", sales: "94930000000", operating_income: "29900000000", net_income: "23000000000", eps_diluted: "1.50" },
          { fiscal_date: "2024-06-29", sales: "85777000000", operating_income: "25400000000", net_income: "21400000000", eps_diluted: "1.40" },
          { fiscal_date: "2023-09-30", sales: "89498000000", operating_income: "26900000000", net_income: "22900000000", eps_diluted: "1.46" },
        ],
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getQuarterlyResults("AAPL", 8);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data).toHaveLength(3);
    expect(r.data[0]?.quarter).toBe("Q3 2024");
    expect(r.data[0]?.revenue).toBe(94_930_000_000);
    expect(r.data[0]?.revenueGrowthYoYPercent).toBeCloseTo(
      (94_930_000_000 - 89_498_000_000) / 89_498_000_000,
      5,
    );
  });

  it("getPriceHistory rejects non-positive months", async () => {
    const p = new TwelveDataProvider({ apiKey: "k", client: buildClient({}) });
    const r = await p.getPriceHistory("AAPL", 0);
    expect(isErr(r)).toBe(true);
  });

  it("getPriceHistory transforms time_series into PricePoints", async () => {
    const client = buildClient({
      timeSeries: {
        meta: { symbol: "AAPL", currency: "USD", interval: "1day" },
        values: [
          { datetime: "2026-04-25", open: "270", high: "272", low: "269", close: "271.5", volume: "30000000" },
          { datetime: "2026-04-24", open: "268", high: "270", low: "267", close: "269.0", volume: "28000000" },
        ],
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getPriceHistory("AAPL", 1);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data).toHaveLength(2);
    expect(r.data[0]?.close).toBe(271.5);
    expect(r.data[0]?.volume).toBe(30_000_000);
  });

  it("surfaces a Twelve Data error envelope as Result.err", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ status: "error", code: 404, message: "symbol not found" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new TwelveDataClient({ apiKey: "k", fetchImpl, rateLimitPerMinute: 10_000 });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getTickerInfo("ZZZ");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("API error 404");
    expect(r.error.message).toContain("symbol not found");
  });

  it("getKeyMetrics returns null-filled metrics when /statistics is plan-gated (403)", async () => {
    const client = buildClient({
      statistics: {
        status: "error",
        code: 403,
        message: "/statistics is available exclusively with pro or ultra…",
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getKeyMetrics("GOOGL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.peRatioTTM).toBeNull();
    expect(r.data.peRatioForward).toBeNull();
    expect(r.data.priceToSales).toBeNull();
    expect(r.data.dividendYield).toBeNull();
  });

  it("getFinancials returns empty financials when any gated endpoint is 403", async () => {
    const gated = {
      status: "error",
      code: 403,
      message: "/income_statement is available exclusively with pro or ultra…",
    };
    const client = buildClient({
      statistics: { statistics: {} },
      incomeAnnual: gated,
      balance: { balance_sheet: [] },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getFinancials("GOOGL");
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.revenueTTM).toBe(0);
    expect(r.data.netIncomeTTM).toBe(0);
    expect(r.data.debtToEquity).toBeNull();
    expect(r.data.returnOnEquity).toBeNull();
    expect(r.data.fiscalYear).toBeGreaterThan(0);
  });

  it("getQuarterlyResults returns [] when /income_statement is plan-gated (403)", async () => {
    const client = buildClient({
      incomeQuarter: {
        status: "error",
        code: 403,
        message: "/income_statement is available exclusively with pro or ultra…",
      },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getQuarterlyResults("GOOGL", 8);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data).toEqual([]);
  });

  it("non-403 envelope errors still propagate as Result.err on gated endpoints", async () => {
    const client = buildClient({
      statistics: { status: "error", code: 429, message: "API credits exceeded" },
    });
    const p = new TwelveDataProvider({ apiKey: "k", client });
    const r = await p.getKeyMetrics("GOOGL");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.message).toContain("API error 429");
  });
});

