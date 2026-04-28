/**
 * `AlphaVantageProvider` — implements the `DataProvider` contract by wiring
 * the Alpha Vantage HTTP client (`client.ts`) → Zod validation
 * (`schemas.ts`) → typed transforms (`transforms.ts`).
 *
 * Constitution alignment:
 *  - C1: implements the cross-provider `DataProvider` interface so the
 *    composite aggregator can route to it (often as the fallback chain).
 *  - C3: every raw response is validated through a Zod schema before any
 *    field is read.
 *  - C5: every public method returns `Result<T>` — internal failures
 *    surface as `err`, never thrown.
 *
 * Free-tier coverage (verified 2026-04-27):
 *   - `OVERVIEW`            — company profile, ratios, forward P/E, PEG
 *   - `TIME_SERIES_DAILY`   — daily OHLCV (price history fallback)
 *   - `INCOME_STATEMENT`    — annual + quarterly P&L
 *   - `BALANCE_SHEET`       — annual + quarterly BS (D/E, current ratio)
 *   - `EARNINGS`            — quarterly EPS actual vs estimate
 *
 * The free tier limit is 25 calls/day plus 5 calls/min so this provider is
 * best used as a fallback rather than a primary source.
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
import {
  AlphaVantageClient,
  type AlphaVantageClientOptions,
} from "./client.js";
import {
  AlphaVantageBalanceSheetSchema,
  AlphaVantageEarningsSchema,
  AlphaVantageIncomeStatementSchema,
  AlphaVantageOverviewSchema,
  AlphaVantageTimeSeriesDailySchema,
  type AlphaVantageBalanceSheet,
  type AlphaVantageEarnings,
  type AlphaVantageIncomeStatement,
  type AlphaVantageOverview,
  type AlphaVantageTimeSeriesDaily,
} from "./schemas.js";
import {
  transformFinancials,
  transformKeyMetrics,
  transformPriceHistory,
  transformQuarterlyResults,
  transformTickerInfo,
} from "./transforms.js";

export const ALPHA_VANTAGE_PROVIDER_NAME = "alpha-vantage";
export const ALPHA_VANTAGE_DEFAULT_PRIORITY = 100;

export interface AlphaVantageProviderOptions extends AlphaVantageClientOptions {
  readonly priority?: number;
  readonly client?: AlphaVantageClient;
}

export class AlphaVantageProvider implements DataProvider {
  readonly name = ALPHA_VANTAGE_PROVIDER_NAME;
  readonly priority: number;
  private readonly client: AlphaVantageClient;

  constructor(options: AlphaVantageProviderOptions) {
    this.priority = options.priority ?? ALPHA_VANTAGE_DEFAULT_PRIORITY;
    this.client = options.client ?? new AlphaVantageClient(options);
  }

  /** Cheap reachability probe via OVERVIEW for AAPL. */
  async isAvailable(): Promise<boolean> {
    const raw = await this.client.fetchOverview("AAPL");
    if (isErr(raw)) return false;
    const parsed = AlphaVantageOverviewSchema.safeParse(raw.data);
    return parsed.success && (parsed.data.Symbol ?? "").length > 0;
  }

  async getTickerInfo(symbol: TickerSymbol): Promise<Result<TickerInfo>> {
    const [overviewRes, seriesRes] = await Promise.all([
      this.fetchOverview(symbol),
      this.fetchTimeSeries(symbol, "compact"),
    ]);
    if (isErr(overviewRes)) return overviewRes;
    if ((overviewRes.data.Symbol ?? "").length === 0 && (overviewRes.data.Name ?? "").length === 0) {
      return err(
        new Error(
          `AlphaVantageProvider: empty OVERVIEW for ${symbol} (likely unknown symbol)`,
        ),
      );
    }
    const closes = isErr(seriesRes) ? null : extractLatestCloses(seriesRes.data);
    return ok(
      transformTickerInfo(
        symbol,
        overviewRes.data,
        closes?.latest ?? null,
        closes?.previous ?? null,
      ),
    );
  }

  async getKeyMetrics(symbol: TickerSymbol): Promise<Result<KeyMetrics>> {
    const overviewRes = await this.fetchOverview(symbol);
    if (isErr(overviewRes)) return overviewRes;
    return ok(transformKeyMetrics(overviewRes.data));
  }

  async getFinancials(symbol: TickerSymbol): Promise<Result<Financials>> {
    const [overviewRes, incomeRes, balanceRes] = await Promise.all([
      this.fetchOverview(symbol),
      this.fetchIncome(symbol),
      this.fetchBalance(symbol),
    ]);
    if (isErr(overviewRes)) return overviewRes;
    if (isErr(incomeRes)) return incomeRes;
    if (isErr(balanceRes)) return balanceRes;
    return ok(
      transformFinancials(overviewRes.data, incomeRes.data, balanceRes.data),
    );
  }

  async getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    if (!Number.isFinite(quarters) || quarters <= 0) {
      return err(
        new Error(
          `AlphaVantageProvider: quarters must be > 0, got ${quarters}`,
        ),
      );
    }
    const [incomeRes, earningsRes] = await Promise.all([
      this.fetchIncome(symbol),
      this.fetchEarnings(symbol),
    ]);
    if (isErr(incomeRes)) return incomeRes;
    if (isErr(earningsRes)) return earningsRes;
    return ok(
      transformQuarterlyResults(
        incomeRes.data,
        earningsRes.data,
        Math.trunc(quarters),
      ),
    );
  }

  async getPriceHistory(
    symbol: TickerSymbol,
    months: number,
  ): Promise<Result<PricePoint[]>> {
    if (!Number.isFinite(months) || months <= 0) {
      return err(
        new Error(`AlphaVantageProvider: months must be > 0, got ${months}`),
      );
    }
    const outputsize: "compact" | "full" = months <= 4 ? "compact" : "full";
    const seriesRes = await this.fetchTimeSeries(symbol, outputsize);
    if (isErr(seriesRes)) return seriesRes;
    return ok(transformPriceHistory(seriesRes.data, Math.trunc(months)));
  }

  private async fetchOverview(
    symbol: TickerSymbol,
  ): Promise<Result<AlphaVantageOverview>> {
    const raw = await this.client.fetchOverview(symbol);
    if (isErr(raw)) return raw;
    const parsed = AlphaVantageOverviewSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("OVERVIEW", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private async fetchTimeSeries(
    symbol: TickerSymbol,
    outputsize: "compact" | "full",
  ): Promise<Result<AlphaVantageTimeSeriesDaily>> {
    const raw = await this.client.fetchTimeSeriesDaily(symbol, outputsize);
    if (isErr(raw)) return raw;
    const parsed = AlphaVantageTimeSeriesDailySchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("TIME_SERIES_DAILY", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private async fetchIncome(
    symbol: TickerSymbol,
  ): Promise<Result<AlphaVantageIncomeStatement>> {
    const raw = await this.client.fetchIncomeStatement(symbol);
    if (isErr(raw)) return raw;
    const parsed = AlphaVantageIncomeStatementSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("INCOME_STATEMENT", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private async fetchBalance(
    symbol: TickerSymbol,
  ): Promise<Result<AlphaVantageBalanceSheet>> {
    const raw = await this.client.fetchBalanceSheet(symbol);
    if (isErr(raw)) return raw;
    const parsed = AlphaVantageBalanceSheetSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("BALANCE_SHEET", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private async fetchEarnings(
    symbol: TickerSymbol,
  ): Promise<Result<AlphaVantageEarnings>> {
    const raw = await this.client.fetchEarnings(symbol);
    if (isErr(raw)) return raw;
    const parsed = AlphaVantageEarningsSchema.safeParse(raw.data);
    if (!parsed.success) {
      return err(this.schemaError("EARNINGS", parsed.error.message));
    }
    return ok(parsed.data);
  }

  private schemaError(endpoint: string, message: string): Error {
    return new Error(
      `AlphaVantageProvider: ${endpoint} response failed validation: ${message}`,
    );
  }
}

function extractLatestCloses(
  series: AlphaVantageTimeSeriesDaily,
): { latest: number | null; previous: number | null } {
  const dates = Object.keys(series["Time Series (Daily)"]).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );
  const latestKey = dates[0];
  const previousKey = dates[1];
  const latestBar = latestKey !== undefined ? series["Time Series (Daily)"][latestKey] : undefined;
  const previousBar = previousKey !== undefined ? series["Time Series (Daily)"][previousKey] : undefined;
  return {
    latest: latestBar?.["4. close"] ?? null,
    previous: previousBar?.["4. close"] ?? null,
  };
}

export function createAlphaVantageProvider(
  options: AlphaVantageProviderOptions,
): AlphaVantageProvider {
  return new AlphaVantageProvider(options);
}

