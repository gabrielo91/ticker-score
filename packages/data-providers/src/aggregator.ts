/**
 * `DataAggregator` — single public entry point that orchestrates the
 * data-providers package per the L3 component diagram.
 *
 * For every read it:
 *  1. consults `@darkscore/cache` (Constitution C2 — cache-first), then
 *  2. iterates `ProviderRegistry.byPriority()` calling each provider until
 *     one returns `ok` (Constitution C5 — Result-based fallback chain),
 *     then
 *  3. writes the successful payload back to the cache.
 *
 * Cache keys follow the canonical `{provider}:{ticker}:{dataType}:{bucket}`
 * format (built by `@darkscore/cache`'s `buildCacheKey`). The aggregator
 * uses the literal string `"aggregator"` as the provider segment so a
 * single cached payload survives a registry reorder — the consumer asked
 * the aggregator, not Yahoo specifically.
 */
import type {
  DataProvider,
  Financials,
  KeyMetrics,
  PricePoint,
  QuarterlyResult,
  Result,
  TickerInfo,
  TickerSymbol,
} from "@darkscore/types";
import { err, isOk, ok } from "@darkscore/types";
import { CacheService, buildCacheKey } from "@darkscore/cache";
import type { ProviderRegistryView } from "./interface.js";

const AGGREGATOR_PROVIDER_TAG = "aggregator";

export interface DataAggregatorOptions {
  /** Override the per-write TTL (seconds). Defaults to the cache service default. */
  readonly ttlSeconds?: number;
  /** When `true`, skip the cache read but still write back. Default `false`. */
  readonly forceRefresh?: boolean;
  /**
   * When set, route the read to the named provider only — no fallback chain.
   * If the named provider is not registered, the call returns `err` (it does
   * NOT silently fall through to other providers). Used by the web app to
   * honor a user-selected data source.
   */
  readonly providerName?: string;
}

export class DataAggregator {
  constructor(
    private readonly registry: ProviderRegistryView,
    private readonly cache: CacheService,
    private readonly defaults: DataAggregatorOptions = {},
  ) {}

  getTickerInfo(
    symbol: TickerSymbol,
    options?: DataAggregatorOptions,
  ): Promise<Result<TickerInfo>> {
    return this.run<TickerInfo>("ticker-info", symbol, options, (p) =>
      p.getTickerInfo(symbol),
    );
  }

  getPriceHistory(
    symbol: TickerSymbol,
    months: number,
    options?: DataAggregatorOptions,
  ): Promise<Result<PricePoint[]>> {
    return this.run<PricePoint[]>(
      `price-history:${months}m`,
      symbol,
      options,
      (p) => p.getPriceHistory(symbol, months),
    );
  }

  getFinancials(
    symbol: TickerSymbol,
    options?: DataAggregatorOptions,
  ): Promise<Result<Financials>> {
    return this.run<Financials>("financials", symbol, options, (p) =>
      p.getFinancials(symbol),
    );
  }

  getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
    options?: DataAggregatorOptions,
  ): Promise<Result<QuarterlyResult[]>> {
    return this.run<QuarterlyResult[]>(
      `quarterly:${quarters}q`,
      symbol,
      options,
      (p) => p.getQuarterlyResults(symbol, quarters),
    );
  }

  getKeyMetrics(
    symbol: TickerSymbol,
    options?: DataAggregatorOptions,
  ): Promise<Result<KeyMetrics>> {
    return this.run<KeyMetrics>("key-metrics", symbol, options, (p) =>
      p.getKeyMetrics(symbol),
    );
  }

  private async run<T>(
    dataType: string,
    symbol: TickerSymbol,
    options: DataAggregatorOptions | undefined,
    call: (provider: DataProvider) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const key = buildCacheKey({
      provider: AGGREGATOR_PROVIDER_TAG,
      ticker: symbol,
      dataType,
    });
    const force = options?.forceRefresh ?? this.defaults.forceRefresh ?? false;

    if (!force) {
      const cached = await this.cache.get<T>(key);
      if (isOk(cached) && cached.data !== null) return ok(cached.data);
    }

    const providerName = options?.providerName ?? this.defaults.providerName;
    const providers =
      providerName !== undefined
        ? this.resolveSingle(providerName)
        : this.registry.byPriority();
    if (providers.length === 0) {
      const detail =
        providerName !== undefined
          ? `provider "${providerName}" is not registered`
          : "no providers registered";
      return err(
        new Error(
          `DataAggregator: ${detail} for ${dataType}(${symbol})`,
        ),
      );
    }

    const failures: string[] = [];
    for (const provider of providers) {
      const result = await call(provider);
      if (isOk(result)) {
        const ttl = options?.ttlSeconds ?? this.defaults.ttlSeconds;
        await this.cache.set<T>(key, result.data, ttl);
        return ok(result.data);
      }
      failures.push(`${provider.name}: ${result.error.message}`);
    }
    const prefix =
      providerName !== undefined
        ? `provider "${providerName}" failed`
        : "all providers failed";
    return err(
      new Error(
        `DataAggregator: ${prefix} for ${dataType}(${symbol}) — ${failures.join(" | ")}`,
      ),
    );
  }

  private resolveSingle(name: string): ReadonlyArray<DataProvider> {
    const found = this.registry.byName(name);
    return found !== undefined ? [found] : [];
  }
}

