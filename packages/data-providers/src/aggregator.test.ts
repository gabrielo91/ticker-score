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
import { CacheService } from "@darkscore/cache";
import type { CacheBackend } from "@darkscore/cache";
import { DataAggregator } from "./aggregator.js";
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
  symbol: "AMZN",
  name: "Amazon.com, Inc.",
  sector: null,
  industry: null,
  exchange: null,
  description: null,
  currency: "USD",
  currentPrice: 100,
  priceChange: 1,
  priceChangePercent: 0.01,
  week52High: 150,
  week52Low: 80,
  marketCap: null,
  volume: null,
  averageVolume: null,
};

function fakeProvider(
  name: string,
  priority: number,
  result: Result<TickerInfo>,
): DataProvider & { calls: number } {
  const provider = {
    name,
    priority,
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

describe("DataAggregator", () => {
  let cache: CacheService;
  let registry: ProviderRegistry;
  let backend: ReturnType<typeof inMemoryBackend>;

  beforeEach(() => {
    backend = inMemoryBackend();
    cache = new CacheService(backend);
    registry = new ProviderRegistry();
  });

  it("returns the cached value without calling any provider on a hit", async () => {
    const provider = fakeProvider("yahoo", 0, ok(SAMPLE_TICKER));
    registry.register(provider);
    const aggregator = new DataAggregator(registry, cache);
    await aggregator.getTickerInfo("AMZN");
    expect(provider.calls).toBe(1);

    const second = await aggregator.getTickerInfo("AMZN");
    expect(provider.calls).toBe(1);
    expect(isOk(second)).toBe(true);
    if (isOk(second)) expect(second.data.symbol).toBe("AMZN");
  });

  it("falls back to the next provider when the higher-priority one errors", async () => {
    const primary = fakeProvider("yahoo", 0, err(new Error("upstream 500")));
    const fallback = fakeProvider("alpha", 10, ok(SAMPLE_TICKER));
    registry.register(primary);
    registry.register(fallback);

    const aggregator = new DataAggregator(registry, cache);
    const r = await aggregator.getTickerInfo("AMZN");
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
    expect(isOk(r)).toBe(true);
  });

  it("returns err when every provider fails", async () => {
    registry.register(fakeProvider("yahoo", 0, err(new Error("a"))));
    registry.register(fakeProvider("alpha", 10, err(new Error("b"))));
    const aggregator = new DataAggregator(registry, cache);
    const r = await aggregator.getTickerInfo("AMZN");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.message).toMatch(/all providers failed/u);
      expect(r.error.message).toMatch(/yahoo: a/u);
      expect(r.error.message).toMatch(/alpha: b/u);
    }
  });

  it("returns err when no providers are registered", async () => {
    const aggregator = new DataAggregator(registry, cache);
    const r = await aggregator.getTickerInfo("AMZN");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/no providers registered/u);
  });

  it("respects forceRefresh and skips the cache read", async () => {
    const provider = fakeProvider("yahoo", 0, ok(SAMPLE_TICKER));
    registry.register(provider);
    const aggregator = new DataAggregator(registry, cache);
    await aggregator.getTickerInfo("AMZN");
    expect(provider.calls).toBe(1);

    await aggregator.getTickerInfo("AMZN", { forceRefresh: true });
    expect(provider.calls).toBe(2);
  });

  it("writes the successful payload back to the cache", async () => {
    registry.register(fakeProvider("yahoo", 0, ok(SAMPLE_TICKER)));
    const aggregator = new DataAggregator(registry, cache);
    await aggregator.getTickerInfo("AMZN");
    const keys = [...backend.store.keys()];
    expect(keys.length).toBe(1);
    const onlyKey = keys[0] ?? "";
    expect(onlyKey.startsWith("aggregator:AMZN:ticker-info:")).toBe(true);
  });
});

