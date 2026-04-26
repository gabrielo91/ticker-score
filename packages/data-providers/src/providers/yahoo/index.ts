/**
 * `YahooFinanceProvider` — implements the `DataProvider` contract by
 * wiring the Yahoo HTTP client (`client.ts`) → Zod validation
 * (`schemas.ts`) → typed transforms (`transforms.ts`).
 *
 * Constitution alignment:
 *  - C1: implements the cross-provider `DataProvider` interface.
 *  - C3: every raw response is validated through a Zod schema before any
 *    field is read.
 *  - C5: every public method returns `Result<T>` — internal failures
 *    surface as `err`, never thrown.
 *
 * Cache integration (C2) is not handled here — that's the
 * `DataAggregator`'s responsibility per the L3 diagram.
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
import { YahooClient, type YahooClientOptions } from "./client.js";
import {
  ChartResponseSchema,
  QuoteSummaryResponseSchema,
  type QuoteSummaryResult,
} from "./schemas.js";
import {
  transformFinancials,
  transformKeyMetrics,
  transformPriceHistory,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";

export const YAHOO_PROVIDER_NAME = "yahoo";
export const YAHOO_DEFAULT_PRIORITY = 0;

const TICKER_INFO_MODULES = ["price", "summaryDetail", "assetProfile"] as const;
const FINANCIALS_MODULES = [
  "financialData",
  "defaultKeyStatistics",
  "incomeStatementHistory",
] as const;
const KEY_METRICS_MODULES = [
  "summaryDetail",
  "defaultKeyStatistics",
] as const;
const QUARTERLY_MODULES = ["incomeStatementHistoryQuarterly"] as const;

export interface YahooFinanceProviderOptions extends YahooClientOptions {
  readonly priority?: number;
  readonly client?: YahooClient;
}

export class YahooFinanceProvider implements DataProvider {
  readonly name = YAHOO_PROVIDER_NAME;
  readonly priority: number;
  private readonly client: YahooClient;

  constructor(options: YahooFinanceProviderOptions = {}) {
    this.priority = options.priority ?? YAHOO_DEFAULT_PRIORITY;
    this.client = options.client ?? new YahooClient(options);
  }

  /**
   * Lightweight reachability probe. Tries the cheapest possible call
   * (`price` module for `AAPL`) and returns `true` only on `ok`.
   */
  async isAvailable(): Promise<boolean> {
    const raw = await this.client.fetchQuoteSummary("AAPL", ["price"]);
    if (isErr(raw)) return false;
    const parsed = QuoteSummaryResponseSchema.safeParse(raw.data);
    return parsed.success && (parsed.data.quoteSummary.result?.length ?? 0) > 0;
  }

  async getTickerInfo(
    symbol: TickerSymbol,
  ): Promise<Result<TickerInfo>> {
    const result = await this.fetchSummaryResult(symbol, TICKER_INFO_MODULES);
    if (isErr(result)) return result;
    return ok(transformTickerInfo(symbol, result.data));
  }

  async getFinancials(
    symbol: TickerSymbol,
  ): Promise<Result<Financials>> {
    const result = await this.fetchSummaryResult(symbol, FINANCIALS_MODULES);
    if (isErr(result)) return result;
    return ok(transformFinancials(result.data));
  }

  async getKeyMetrics(
    symbol: TickerSymbol,
  ): Promise<Result<KeyMetrics>> {
    const result = await this.fetchSummaryResult(symbol, KEY_METRICS_MODULES);
    if (isErr(result)) return result;
    return ok(transformKeyMetrics(result.data));
  }

  async getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    if (!Number.isFinite(quarters) || quarters <= 0) {
      return err(
        new Error(
          `YahooFinanceProvider: quarters must be > 0, got ${quarters}`,
        ),
      );
    }
    const result = await this.fetchSummaryResult(symbol, QUARTERLY_MODULES);
    if (isErr(result)) return result;
    return ok(transformQuarterlyResults(result.data, Math.trunc(quarters)));
  }

  async getPriceHistory(
    symbol: TickerSymbol,
    months: number,
  ): Promise<Result<PricePoint[]>> {
    if (!Number.isFinite(months) || months <= 0) {
      return err(
        new Error(`YahooFinanceProvider: months must be > 0, got ${months}`),
      );
    }
    const range = monthsToYahooRange(Math.trunc(months));
    const interval = months > 6 ? "1wk" : "1d";
    const raw = await this.client.fetchChart(symbol, range, interval);
    if (isErr(raw)) return raw;
    const parsed = ChartResponseSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(
        new Error(
          `YahooFinanceProvider: chart response failed validation: ${parsed.error.message}`,
        ),
      );
    }
    const apiError = parsed.data.chart.error;
    if (apiError !== null && apiError !== undefined) {
      return err(
        new Error(
          `YahooFinanceProvider: chart error for ${symbol}: ${apiError.description ?? apiError.code ?? "unknown"}`,
        ),
      );
    }
    const result = parsed.data.chart.result?.[0];
    if (result === undefined) {
      return err(
        new Error(`YahooFinanceProvider: empty chart result for ${symbol}`),
      );
    }
    return ok(transformPriceHistory(result));
  }

  private async fetchSummaryResult(
    symbol: TickerSymbol,
    modules: ReadonlyArray<string>,
  ): Promise<Result<QuoteSummaryResult>> {
    const raw = await this.client.fetchQuoteSummary(symbol, modules);
    if (isErr(raw)) return raw;
    const parsed = QuoteSummaryResponseSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(
        new Error(
          `YahooFinanceProvider: quoteSummary response failed validation: ${parsed.error.message}`,
        ),
      );
    }
    const apiError = parsed.data.quoteSummary.error;
    if (apiError !== null && apiError !== undefined) {
      return err(
        new Error(
          `YahooFinanceProvider: quoteSummary error for ${symbol}: ${apiError.description ?? apiError.code ?? "unknown"}`,
        ),
      );
    }
    const result = parsed.data.quoteSummary.result?.[0];
    if (result === undefined) {
      return err(
        new Error(
          `YahooFinanceProvider: empty quoteSummary result for ${symbol}`,
        ),
      );
    }
    return ok(result);
  }
}

export function createYahooProvider(
  options: YahooFinanceProviderOptions = {},
): YahooFinanceProvider {
  return new YahooFinanceProvider(options);
}

function monthsToYahooRange(months: number): string {
  if (months <= 1) return "1mo";
  if (months <= 3) return "3mo";
  if (months <= 6) return "6mo";
  if (months <= 12) return "1y";
  if (months <= 24) return "2y";
  if (months <= 60) return "5y";
  return "10y";
}

