/**
 * `TwelveDataProvider` — implements the `DataProvider` contract by wiring
 * the Twelve Data HTTP client (`client.ts`) → Zod validation (`schemas.ts`)
 * → typed transforms (`transforms.ts`).
 *
 * Constitution alignment:
 *  - C1: implements the cross-provider `DataProvider` interface so the
 *    aggregator can route to it (no fallback in strict mode).
 *  - C3: every raw response is validated through a Zod schema before any
 *    field is read.
 *  - C5: every public method returns `Result<T>` — internal failures
 *    surface as `err`, never thrown.
 *
 * Free-tier coverage (Basic plan, 800 calls/day, 8 calls/minute, verified
 * 2026-04-26):
 *   - `/quote`           — current price + change
 *   - `/profile`         — name, sector, industry, exchange, description
 *   - `/time_series`     — daily OHLCV (history for the chart)
 *   - `/income_statement` — annual + quarterly statements
 *   - `/balance_sheet`   — annual statements
 *   - `/statistics`      — TTM fundamentals, valuation ratios, ROE/ROA
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
import type { z } from "zod";
import {
  TwelveDataApiError,
  TwelveDataClient,
  type TwelveDataClientOptions,
} from "./client.js";
import {
  TwelveDataBalanceSheetSchema,
  TwelveDataIncomeStatementSchema,
  TwelveDataProfileSchema,
  TwelveDataQuoteSchema,
  TwelveDataStatisticsSchema,
  TwelveDataTimeSeriesSchema,
  type TwelveDataBalanceSheet,
  type TwelveDataIncomeStatement,
  type TwelveDataProfile,
  type TwelveDataStatistics,
} from "./schemas.js";
import {
  emptyFinancials,
  emptyKeyMetrics,
  transformFinancials,
  transformKeyMetrics,
  transformPriceHistory,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";

export const TWELVE_DATA_PROVIDER_NAME = "twelvedata";
export const TWELVE_DATA_DEFAULT_PRIORITY = 0;
const TRADING_DAYS_PER_MONTH = 21;
/**
 * Twelve Data returns HTTP 200 with `{status:"error", code:403}` for endpoints
 * gated to paid plans (`/statistics`, `/income_statement`, `/balance_sheet`,
 * and `/profile` for non-trial symbols on the Basic tier). When that happens
 * we degrade gracefully instead of failing the whole report.
 */
const PLAN_GATED_CODE = 403;

function isPlanGated(error: Error): boolean {
  return error instanceof TwelveDataApiError && error.code === PLAN_GATED_CODE;
}

export interface TwelveDataProviderOptions extends TwelveDataClientOptions {
  readonly priority?: number;
  readonly client?: TwelveDataClient;
}

export class TwelveDataProvider implements DataProvider {
  readonly name = TWELVE_DATA_PROVIDER_NAME;
  readonly priority: number;
  private readonly client: TwelveDataClient;

  constructor(options: TwelveDataProviderOptions) {
    this.priority = options.priority ?? TWELVE_DATA_DEFAULT_PRIORITY;
    this.client = options.client ?? new TwelveDataClient(options);
  }

  /** Cheap reachability probe: `/quote` for AAPL costs one rate-limit slot. */
  async isAvailable(): Promise<boolean> {
    const raw = await this.client.fetchQuote("AAPL");
    if (isErr(raw)) return false;
    const parsed = TwelveDataQuoteSchema.safeParse(raw.data);
    return parsed.success && parsed.data.close !== null && parsed.data.close !== undefined;
  }

  async getTickerInfo(symbol: TickerSymbol): Promise<Result<TickerInfo>> {
    const [quoteRaw, profileRaw, statsRaw] = await Promise.all([
      this.client.fetchQuote(symbol),
      this.client.fetchProfile(symbol),
      this.client.fetchStatistics(symbol),
    ]);
    if (isErr(quoteRaw)) return quoteRaw;
    const quote = this.parse(TwelveDataQuoteSchema, quoteRaw.data, "quote");
    if (isErr(quote)) return quote;
    const profile: TwelveDataProfile | undefined = isErr(profileRaw)
      ? undefined
      : (this.safeParse(TwelveDataProfileSchema, profileRaw.data) ?? undefined);
    const stats: TwelveDataStatistics | undefined = isErr(statsRaw)
      ? undefined
      : (this.safeParse(TwelveDataStatisticsSchema, statsRaw.data) ?? undefined);
    return ok(transformTickerInfo(symbol, quote.data, profile, stats));
  }

  async getKeyMetrics(symbol: TickerSymbol): Promise<Result<KeyMetrics>> {
    const stats = await this.fetchStatistics(symbol);
    if (isErr(stats)) {
      if (isPlanGated(stats.error)) return ok(emptyKeyMetrics());
      return stats;
    }
    return ok(transformKeyMetrics(stats.data));
  }

  async getFinancials(symbol: TickerSymbol): Promise<Result<Financials>> {
    const [statsRes, incomeRes, balanceRes] = await Promise.all([
      this.fetchStatistics(symbol),
      this.fetchIncomeStatement(symbol, "annual"),
      this.fetchBalanceSheet(symbol),
    ]);
    // If any gated endpoint refuses on plan grounds, return an empty
    // Financials block so the report still renders. Other failures (network,
    // schema, quota) propagate as errors per C5.
    for (const r of [statsRes, incomeRes, balanceRes]) {
      if (isErr(r) && isPlanGated(r.error)) return ok(emptyFinancials());
    }
    if (isErr(statsRes)) return statsRes;
    if (isErr(incomeRes)) return incomeRes;
    if (isErr(balanceRes)) return balanceRes;
    return ok(transformFinancials(statsRes.data, incomeRes.data, balanceRes.data));
  }

  async getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    if (!Number.isFinite(quarters) || quarters <= 0) {
      return err(
        new Error(`TwelveDataProvider: quarters must be > 0, got ${quarters}`),
      );
    }
    const incomeRes = await this.fetchIncomeStatement(symbol, "quarterly");
    if (isErr(incomeRes)) {
      if (isPlanGated(incomeRes.error)) return ok([]);
      return incomeRes;
    }
    return ok(transformQuarterlyResults(incomeRes.data, Math.trunc(quarters)));
  }

  async getPriceHistory(
    symbol: TickerSymbol,
    months: number,
  ): Promise<Result<PricePoint[]>> {
    if (!Number.isFinite(months) || months <= 0) {
      return err(
        new Error(`TwelveDataProvider: months must be > 0, got ${months}`),
      );
    }
    const outputsize = Math.max(30, Math.trunc(months) * TRADING_DAYS_PER_MONTH);
    const raw = await this.client.fetchTimeSeries(symbol, outputsize);
    if (isErr(raw)) return raw;
    const parsed = this.parse(
      TwelveDataTimeSeriesSchema,
      raw.data,
      "time_series",
    );
    if (isErr(parsed)) return parsed;
    return ok(transformPriceHistory(parsed.data));
  }

  private async fetchStatistics(
    symbol: TickerSymbol,
  ): Promise<Result<TwelveDataStatistics>> {
    const raw = await this.client.fetchStatistics(symbol);
    if (isErr(raw)) return raw;
    return this.parse(TwelveDataStatisticsSchema, raw.data, "statistics");
  }

  private async fetchIncomeStatement(
    symbol: TickerSymbol,
    period: "annual" | "quarterly",
  ): Promise<Result<TwelveDataIncomeStatement>> {
    const raw = await this.client.fetchIncomeStatement(symbol, period);
    if (isErr(raw)) return raw;
    return this.parse(
      TwelveDataIncomeStatementSchema,
      raw.data,
      `income_statement(${period})`,
    );
  }

  private async fetchBalanceSheet(
    symbol: TickerSymbol,
  ): Promise<Result<TwelveDataBalanceSheet>> {
    const raw = await this.client.fetchBalanceSheet(symbol);
    if (isErr(raw)) return raw;
    return this.parse(TwelveDataBalanceSheetSchema, raw.data, "balance_sheet");
  }

  private parse<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
    endpoint: string,
  ): Result<z.infer<T>> {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return err(
        new Error(
          `TwelveDataProvider: ${endpoint} response failed validation: ${parsed.error.message}`,
        ),
      );
    }
    return ok(parsed.data);
  }

  private safeParse<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
  ): z.infer<T> | null {
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }
}

export function createTwelveDataProvider(
  options: TwelveDataProviderOptions,
): TwelveDataProvider {
  return new TwelveDataProvider(options);
}

