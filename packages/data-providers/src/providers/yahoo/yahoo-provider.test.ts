import { describe, expect, it, vi } from "vitest";
import { isErr, isOk, ok } from "@darkscore/types";
import { YahooClient } from "./client.js";
import { YahooFinanceProvider } from "./index.js";

function buildClient(payloads: { quoteSummary?: unknown; chart?: unknown }) {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes("/v10/finance/quoteSummary/")) {
      return new Response(JSON.stringify(payloads.quoteSummary ?? {}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/v8/finance/chart/")) {
      return new Response(JSON.stringify(payloads.chart ?? {}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
  return new YahooClient({ fetchImpl });
}

const QUOTE_SUMMARY_OK = {
  quoteSummary: {
    result: [
      {
        price: {
          longName: "Amazon.com, Inc.",
          currency: "USD",
          regularMarketPrice: { raw: 175 },
          regularMarketChange: { raw: 1 },
          regularMarketChangePercent: { raw: 0.005 },
          marketCap: { raw: 1_800_000_000_000 },
          regularMarketVolume: { raw: 35_000_000 },
          averageDailyVolume3Month: { raw: 42_000_000 },
        },
        summaryDetail: {
          fiftyTwoWeekHigh: { raw: 200 },
          fiftyTwoWeekLow: { raw: 100 },
        },
        assetProfile: { sector: "Consumer Cyclical", industry: "Internet Retail" },
        financialData: {
          totalRevenue: { raw: 600_000_000_000 },
          grossMargins: { raw: 0.45 },
          operatingMargins: { raw: 0.08 },
          profitMargins: { raw: 0.06 },
          totalCash: { raw: 90_000_000_000 },
          totalDebt: { raw: 150_000_000_000 },
          operatingCashflow: { raw: 80_000_000_000 },
          freeCashflow: { raw: 30_000_000_000 },
          capitalExpenditures: { raw: -50_000_000_000 },
        },
        defaultKeyStatistics: {
          trailingEps: { raw: 4.5 },
          netIncomeToCommon: { raw: 36_000_000_000 },
          lastFiscalYearEnd: { raw: 1_703_980_800 },
        },
        incomeStatementHistoryQuarterly: {
          incomeStatementHistory: [
            { endDate: { raw: 1_703_980_800 }, totalRevenue: { raw: 170 }, operatingIncome: { raw: 13 } },
          ],
        },
      },
    ],
    error: null,
  },
};

const CHART_OK = {
  chart: {
    result: [
      {
        meta: { symbol: "AMZN", currency: "USD" },
        timestamp: [1_700_000_000, 1_700_086_400],
        indicators: {
          quote: [
            {
              open: [100, 101],
              high: [102, 103],
              low: [99, 100],
              close: [101, 102],
              volume: [1_000_000, 1_100_000],
            },
          ],
        },
      },
    ],
    error: null,
  },
};

describe("YahooFinanceProvider", () => {
  it("getTickerInfo returns typed data on a valid response", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({ quoteSummary: QUOTE_SUMMARY_OK }),
    });
    const r = await provider.getTickerInfo("AMZN");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.data.symbol).toBe("AMZN");
      expect(r.data.currentPrice).toBe(175);
    }
  });

  it("getFinancials, getKeyMetrics, getQuarterlyResults all parse a real-shaped payload", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({ quoteSummary: QUOTE_SUMMARY_OK }),
    });
    expect(isOk(await provider.getFinancials("AMZN"))).toBe(true);
    expect(isOk(await provider.getKeyMetrics("AMZN"))).toBe(true);
    expect(isOk(await provider.getQuarterlyResults("AMZN", 4))).toBe(true);
  });

  it("getPriceHistory returns PricePoint[] on a valid chart response", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({ chart: CHART_OK }),
    });
    const r = await provider.getPriceHistory("AMZN", 12);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.data.length).toBe(2);
  });

  it("returns err when Yahoo reports an API error", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({
        quoteSummary: {
          quoteSummary: {
            result: null,
            error: { code: "Not Found", description: "no such ticker" },
          },
        },
      }),
    });
    const r = await provider.getTickerInfo("ZZZ");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/no such ticker/u);
  });

  it("returns err on schema mismatch", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({ quoteSummary: { wrong: "shape" } }),
    });
    const r = await provider.getTickerInfo("AMZN");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/failed validation/u);
  });

  it("rejects non-positive months and quarters", async () => {
    const provider = new YahooFinanceProvider({
      client: buildClient({}),
    });
    expect(isErr(await provider.getPriceHistory("AMZN", 0))).toBe(true);
    expect(isErr(await provider.getQuarterlyResults("AMZN", -1))).toBe(true);
  });

  it("isAvailable returns false when the upstream call fails", async () => {
    const provider = new YahooFinanceProvider({
      client: {
        fetchQuoteSummary: async () => ok({ unexpected: true }),
        fetchChart: async () => ok({}),
      } as unknown as YahooClient,
    });
    expect(await provider.isAvailable()).toBe(false);
  });
});

