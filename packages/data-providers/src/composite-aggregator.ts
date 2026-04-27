/**
 * `CompositeAggregator` — per-method provider routing with fallback chains
 * (W5-1). Unlike `DataAggregator` which picks one provider for every call,
 * the composite routes each `DataProvider` method to its own ordered list
 * of providers and stops at the first one that returns `ok`. The outcome
 * for every attempt is recorded in a shared `SourceAttribution` map so
 * the rendered report can disclose which provider served each data slice.
 *
 * Constitution alignment:
 *  - C1: only routes through registered `DataProvider` instances.
 *  - C2: cache-first per `(provider, ticker, dataType)` key — the cached
 *    payload is keyed to the actual provider that served it, never to the
 *    composite, so re-ordering the routing chain never silently returns
 *    another provider's cached response.
 *  - C5: every public method returns `Result<T>`; failures never throw.
 *
 * Default routing follows the spec:
 *   tickerInfo|financials|keyMetrics|quarterlyResults: [finnhub, alpha-vantage]
 *   priceHistory: [twelvedata, alpha-vantage]
 */
import type {
  DataProvider,
  Financials,
  KeyMetrics,
  PricePoint,
  QuarterlyResult,
  Result,
  SourceAttribution,
  SourceEntry,
  TickerInfo,
  TickerSymbol,
} from "@darkscore/types";
import { err, isOk, ok } from "@darkscore/types";
import { CacheService, buildCacheKey } from "@darkscore/cache";
import type { ProviderRegistryView } from "./interface.js";

export type CompositeMethod =
  | "tickerInfo"
  | "priceHistory"
  | "financials"
  | "keyMetrics"
  | "quarterlyResults";

export interface CompositeConfig {
  readonly tickerInfo: ReadonlyArray<string>;
  readonly priceHistory: ReadonlyArray<string>;
  readonly financials: ReadonlyArray<string>;
  readonly keyMetrics: ReadonlyArray<string>;
  readonly quarterlyResults: ReadonlyArray<string>;
}

export interface CompositeAggregatorOptions {
  readonly ttlSeconds?: number;
  readonly forceRefresh?: boolean;
  /** Injected clock; tests override to make `durationMs` deterministic. */
  readonly now?: () => number;
}

/**
 * Spec default — Finnhub-first for fundamentals, Twelve Data for prices,
 * Alpha Vantage as the fallback for everything.
 */
export const DEFAULT_COMPOSITE_CONFIG: CompositeConfig = {
  tickerInfo: ["finnhub", "alpha-vantage"],
  financials: ["finnhub", "alpha-vantage"],
  keyMetrics: ["finnhub", "alpha-vantage"],
  quarterlyResults: ["finnhub", "alpha-vantage"],
  priceHistory: ["twelvedata", "alpha-vantage"],
};

const METHOD_DATATYPES: Record<CompositeMethod, string> = {
  tickerInfo: "ticker-info",
  priceHistory: "price-history",
  financials: "financials",
  keyMetrics: "key-metrics",
  quarterlyResults: "quarterly",
};

export class CompositeAggregator {
  private readonly attribution: Record<string, SourceEntry> = {};

  constructor(
    private readonly registry: ProviderRegistryView,
    private readonly cache: CacheService,
    private readonly config: CompositeConfig = DEFAULT_COMPOSITE_CONFIG,
    private readonly options: CompositeAggregatorOptions = {},
  ) {}

  /** Snapshot of the per-method attribution recorded so far. */
  getSourceAttribution(): SourceAttribution {
    return { ...this.attribution };
  }

  /** Reset attribution between independent aggregator runs. */
  resetAttribution(): void {
    for (const k of Object.keys(this.attribution)) delete this.attribution[k];
  }

  getTickerInfo(symbol: TickerSymbol): Promise<Result<TickerInfo>> {
    return this.run<TickerInfo>(
      "tickerInfo",
      symbol,
      this.config.tickerInfo,
      (p) => p.getTickerInfo(symbol),
    );
  }

  getPriceHistory(
    symbol: TickerSymbol,
    months: number,
  ): Promise<Result<PricePoint[]>> {
    return this.run<PricePoint[]>(
      "priceHistory",
      symbol,
      this.config.priceHistory,
      (p) => p.getPriceHistory(symbol, months),
      `${months}m`,
    );
  }

  getFinancials(symbol: TickerSymbol): Promise<Result<Financials>> {
    return this.run<Financials>(
      "financials",
      symbol,
      this.config.financials,
      (p) => p.getFinancials(symbol),
    );
  }

  getKeyMetrics(symbol: TickerSymbol): Promise<Result<KeyMetrics>> {
    return this.run<KeyMetrics>(
      "keyMetrics",
      symbol,
      this.config.keyMetrics,
      (p) => p.getKeyMetrics(symbol),
    );
  }

  getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    return this.run<QuarterlyResult[]>(
      "quarterlyResults",
      symbol,
      this.config.quarterlyResults,
      (p) => p.getQuarterlyResults(symbol, quarters),
      `${quarters}q`,
    );
  }

  private async run<T>(
    method: CompositeMethod,
    symbol: TickerSymbol,
    chain: ReadonlyArray<string>,
    call: (provider: DataProvider) => Promise<Result<T>>,
    suffix?: string,
  ): Promise<Result<T>> {
    const dataType =
      suffix !== undefined
        ? `${METHOD_DATATYPES[method]}:${suffix}`
        : METHOD_DATATYPES[method];
    const force = this.options.forceRefresh ?? false;
    const now = this.options.now ?? Date.now;
    const failures: string[] = [];

    if (chain.length === 0) {
      const e = new Error(
        `CompositeAggregator: no providers configured for ${method}(${symbol})`,
      );
      this.attribution[method] = {
        provider: "(none)",
        status: "error",
        error: e.message,
        durationMs: null,
      };
      return err(e);
    }

    for (const providerName of chain) {
      const provider = this.registry.byName(providerName);
      if (provider === undefined) {
        failures.push(`${providerName}: not registered`);
        continue;
      }
      const key = buildCacheKey({ provider: providerName, ticker: symbol, dataType });
      if (!force) {
        const cached = await this.cache.get<T>(key);
        if (isOk(cached) && cached.data !== null) {
          this.attribution[method] = {
            provider: providerName,
            status: "ok",
            error: null,
            durationMs: 0,
          };
          return ok(cached.data);
        }
      }
      const started = now();
      const result = await call(provider);
      const durationMs = Math.max(0, now() - started);
      if (isOk(result)) {
        await this.cache.set<T>(key, result.data, this.options.ttlSeconds);
        this.attribution[method] = {
          provider: providerName,
          status: "ok",
          error: null,
          durationMs,
        };
        return ok(result.data);
      }
      failures.push(`${providerName}: ${result.error.message}`);
      this.attribution[method] = {
        provider: providerName,
        status: "error",
        error: result.error.message,
        durationMs,
      };
    }
    return err(
      new Error(
        `CompositeAggregator: all providers failed for ${method}(${symbol}) — ${failures.join(" | ")}`,
      ),
    );
  }
}

