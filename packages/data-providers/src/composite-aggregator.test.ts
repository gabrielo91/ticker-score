import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  err,
  isErr,
  isOk,
  ok,
  type DataProvider,
  type Result,
  type TickerInfo,
} from "@darkscore/types";
import { CacheService, type CacheBackend } from "@darkscore/cache";
import { CompositeAggregator } from "./composite-aggregator.js";
import { ProviderRegistry } from "./registry.js";

function inMemoryBackend(): CacheBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => {
      store.set(k, v);
      return "OK";
    },
    del: async (...keys) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    },
    scan: async () => ["0", []],
  };
}

const SAMPLE_TICKER: TickerInfo = {
  symbol: "AAPL",
  name: "Apple Inc.",
  sector: null,
  industry: null,
  exchange: null,
  description: null,
  currency: "USD",
  currentPrice: 200,
  priceChange: 1,
  priceChangePercent: 0.005,
  week52High: 250,
  week52Low: 150,
  marketCap: null,
  volume: null,
  averageVolume: null,
};

function fakeProvider(
  name: string,
  result: Result<TickerInfo>,
): DataProvider & { calls: number } {
  const provider = {
    name,
    priority: 0,
    calls: 0,
    isAvailable: async () => true,
    getTickerInfo: vi.fn(async (): Promise<Result<TickerInfo>> => {
      provider.calls += 1;
      return result;
    }),
    getPriceHistory: async () => err(new Error("nope")) as Result<never>,
    getFinancials: async () => err(new Error("nope")) as Result<never>,
    getQuarterlyResults: async () => err(new Error("nope")) as Result<never>,
    getKeyMetrics: async () => err(new Error("nope")) as Result<never>,
  };
  return provider;
}

describe("CompositeAggregator", () => {
  let cache: CacheService;
  let registry: ProviderRegistry;

  beforeEach(() => {
    cache = new CacheService(inMemoryBackend());
    registry = new ProviderRegistry();
  });

  it("routes to the first provider in the chain on success", async () => {
    const primary = fakeProvider("finnhub", ok(SAMPLE_TICKER));
    const fallback = fakeProvider("alpha-vantage", ok(SAMPLE_TICKER));
    registry.register(primary);
    registry.register(fallback);
    const agg = new CompositeAggregator(registry, cache, {
      tickerInfo: ["finnhub", "alpha-vantage"],
      financials: [],
      keyMetrics: [],
      quarterlyResults: [],
      priceHistory: [],
    });
    const r = await agg.getTickerInfo("AAPL");
    expect(isOk(r)).toBe(true);
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
    expect(agg.getSourceAttribution().tickerInfo?.provider).toBe("finnhub");
    expect(agg.getSourceAttribution().tickerInfo?.status).toBe("ok");
  });

  it("falls back to the next provider when the primary errors", async () => {
    const primary = fakeProvider("finnhub", err(new Error("upstream 500")));
    const fallback = fakeProvider("alpha-vantage", ok(SAMPLE_TICKER));
    registry.register(primary);
    registry.register(fallback);
    const agg = new CompositeAggregator(registry, cache, {
      tickerInfo: ["finnhub", "alpha-vantage"],
      financials: [],
      keyMetrics: [],
      quarterlyResults: [],
      priceHistory: [],
    });
    const r = await agg.getTickerInfo("AAPL");
    expect(isOk(r)).toBe(true);
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
    expect(agg.getSourceAttribution().tickerInfo?.provider).toBe("alpha-vantage");
  });

  it("returns err and records error attribution when every provider fails", async () => {
    registry.register(fakeProvider("finnhub", err(new Error("a"))));
    registry.register(fakeProvider("alpha-vantage", err(new Error("b"))));
    const agg = new CompositeAggregator(registry, cache, {
      tickerInfo: ["finnhub", "alpha-vantage"],
      financials: [], keyMetrics: [], quarterlyResults: [], priceHistory: [],
    });
    const r = await agg.getTickerInfo("AAPL");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/all providers failed/u);
    expect(agg.getSourceAttribution().tickerInfo?.status).toBe("error");
  });

  it("skips providers that are not registered and records (none) on empty chain", async () => {
    const agg = new CompositeAggregator(registry, cache, {
      tickerInfo: [], financials: [], keyMetrics: [], quarterlyResults: [], priceHistory: [],
    });
    const r = await agg.getTickerInfo("AAPL");
    expect(isErr(r)).toBe(true);
    expect(agg.getSourceAttribution().tickerInfo?.provider).toBe("(none)");
  });

  it("serves the second call from cache without re-calling the provider", async () => {
    const primary = fakeProvider("finnhub", ok(SAMPLE_TICKER));
    registry.register(primary);
    const agg = new CompositeAggregator(registry, cache, {
      tickerInfo: ["finnhub"], financials: [], keyMetrics: [],
      quarterlyResults: [], priceHistory: [],
    });
    await agg.getTickerInfo("AAPL");
    await agg.getTickerInfo("AAPL");
    expect(primary.calls).toBe(1);
  });
});

