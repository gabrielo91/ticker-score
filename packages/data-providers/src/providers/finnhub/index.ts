/**
 * `FinnhubProvider` — implements the `DataProvider` contract by wiring the
 * Finnhub HTTP client (`client.ts`) → Zod validation (`schemas.ts`) → typed
 * transforms (`transforms.ts`).
 *
 * Constitution alignment:
 *  - C1: implements the cross-provider `DataProvider` interface so the
 *    aggregator can route to it when the user picks Finnhub from the UI.
 *  - C3: every raw response is validated through a Zod schema before any
 *    field is read.
 *  - C5: every public method returns `Result<T>` — internal failures
 *    surface as `err`, never thrown.
 *
 * Free-tier limitations:
 *  - `/stock/candle` (price history) is no longer free, so `getPriceHistory`
 *    returns `err` to let the aggregator try the next provider.
 *  - `/stock/profile2` does not expose GICS sector — `TickerInfo.sector`
 *    is reported as `null`.
 */
import {
  err,
  isErr,
  ok,
  type DataProvider,
  type Financials,
  type KeyMetrics,
  type PricePoint,
  type QuarterlyResult,
  type Result,
  type TickerInfo,
  type TickerSymbol,
} from "@darkscore/types";
import { FinnhubClient, type FinnhubClientOptions } from "./client.js";
import {
  FinnhubFinancialsReportedSchema,
  FinnhubMetricResponseSchema,
  FinnhubProfile2Schema,
  FinnhubQuoteSchema,
  type FinnhubFinancialsReported,
  type FinnhubMetricResponse,
} from "./schemas.js";
import {
  transformFinancials,
  transformKeyMetrics,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";

export const FINNHUB_PROVIDER_NAME = "finnhub";
export const FINNHUB_DEFAULT_PRIORITY = 1;

export interface FinnhubProviderOptions extends FinnhubClientOptions {
  readonly priority?: number;
  readonly client?: FinnhubClient;
}

export class FinnhubProvider implements DataProvider {
  readonly name = FINNHUB_PROVIDER_NAME;
  readonly priority: number;
  private readonly client: FinnhubClient;

  constructor(options: FinnhubProviderOptions) {
    this.priority = options.priority ?? FINNHUB_DEFAULT_PRIORITY;
    this.client = options.client ?? new FinnhubClient(options);
  }

  /** Cheap reachability probe: a `/quote` for AAPL costs one rate-limit slot. */
  async isAvailable(): Promise<boolean> {
    const raw = await this.client.fetchQuote("AAPL");
    if (isErr(raw)) return false;
    const parsed = FinnhubQuoteSchema.safeParse(raw.data);
    return parsed.success && parsed.data.c > 0;
  }

  async getTickerInfo(symbol: TickerSymbol): Promise<Result<TickerInfo>> {
    const [quoteRaw, profileRaw, metricRaw] = await Promise.all([
      this.client.fetchQuote(symbol),
      this.client.fetchProfile(symbol),
      this.client.fetchMetrics(symbol),
    ]);
    if (isErr(quoteRaw)) return quoteRaw;
    if (isErr(profileRaw)) return profileRaw;
    const quote = FinnhubQuoteSchema.safeParse(quoteRaw.data);
    if (!quote.success) {
      return err(this.schemaError("quote", quote.error.message));
    }
    if (quote.data.c === 0) {
      return err(
        new Error(
          `FinnhubProvider: empty quote for ${symbol} (likely unknown symbol)`,
        ),
      );
    }
    const profile = FinnhubProfile2Schema.safeParse(profileRaw.data);
    if (!profile.success) {
      return err(this.schemaError("profile2", profile.error.message));
    }
    // Metrics are best-effort — a failure here shouldn't block ticker info.
    const metric = isErr(metricRaw)
      ? undefined
      : FinnhubMetricResponseSchema.safeParse(metricRaw.data).data?.metric;
    return ok(transformTickerInfo(symbol, quote.data, profile.data, metric));
  }

  async getKeyMetrics(symbol: TickerSymbol): Promise<Result<KeyMetrics>> {
    const metric = await this.fetchMetric(symbol);
    if (isErr(metric)) return metric;
    return ok(transformKeyMetrics(metric.data.metric));
  }

  async getFinancials(symbol: TickerSymbol): Promise<Result<Financials>> {
    const [metric, reported] = await Promise.all([
      this.fetchMetric(symbol),
      this.fetchFinancialsReported(symbol),
    ]);
    if (isErr(metric)) return metric;
    if (isErr(reported)) return reported;
    return ok(transformFinancials(metric.data, reported.data));
  }

  async getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    if (!Number.isFinite(quarters) || quarters <= 0) {
      return err(
        new Error(`FinnhubProvider: quarters must be > 0, got ${quarters}`),
      );
    }
    const reported = await this.fetchFinancialsReported(symbol);
    if (isErr(reported)) return reported;
    return ok(transformQuarterlyResults(reported.data, Math.trunc(quarters)));
  }

  /**
   * Finnhub's `/stock/candle` endpoint is premium-only. Returning `err`
   * surfaces the limitation to the user so they can pick a provider that
   * still serves historical prices on its free tier (e.g. Twelve Data
   * `/time_series`).
   */
  getPriceHistory(
    _symbol: TickerSymbol,
    _months: number,
  ): Promise<Result<PricePoint[]>> {
    return Promise.resolve(
      err(
        new Error(
          "FinnhubProvider: getPriceHistory is unavailable on the free tier",
        ),
      ),
    );
  }

  private async fetchMetric(
    symbol: TickerSymbol,
  ): Promise<Result<FinnhubMetricResponse>> {
    const raw = await this.client.fetchMetrics(symbol);
    if (isErr(raw)) return raw;
    const parsed = FinnhubMetricResponseSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("stock/metric", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private async fetchFinancialsReported(
    symbol: TickerSymbol,
  ): Promise<Result<FinnhubFinancialsReported>> {
    const raw = await this.client.fetchFinancialsReported(symbol);
    if (isErr(raw)) return raw;
    const parsed = FinnhubFinancialsReportedSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("financials-reported", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private schemaError(endpoint: string, message: string): Error {
    return new Error(
      `FinnhubProvider: ${endpoint} response failed validation: ${message}`,
    );
  }
}

export function createFinnhubProvider(
  options: FinnhubProviderOptions,
): FinnhubProvider {
  return new FinnhubProvider(options);
}

