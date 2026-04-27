/**
 * Pure transforms from validated Twelve Data shapes (`schemas.ts`) to
 * `@darkscore/types` domain shapes. No I/O, no `Date.now()`, no
 * randomness — every output is a deterministic function of its input.
 *
 * Conventions handled here:
 *  - Twelve Data returns numeric fields as **strings** (e.g. `"272.72500"`);
 *    `toNum`/`toNumOrNull` coerce once at the boundary.
 *  - Twelve Data margins (`profit_margin`, `operating_margin`, …) are
 *    already **fractions** (e.g. `0.26110` = 26.11%), so they pass through
 *    unmodified — `Financials` stores fractions too.
 *  - `percent_change` from `/quote` is a **percent** (e.g. `0.84` = 0.84%);
 *    `TickerInfo.priceChangePercent` stores a fraction so we divide by 100
 *    (matches the shape `Finnhub` produces too).
 *  - Quarter labels follow `Q{n} {year}` derived from `fiscal_date`'s
 *    calendar month — Twelve Data does not expose fiscal-quarter metadata,
 *    so we use calendar quarters, which is what the QuarterlyTable already
 *    displays for every other provider.
 */
import type {
  Financials,
  KeyMetrics,
  PricePoint,
  QuarterlyResult,
  TickerInfo,
  TickerSymbol,
} from "@darkscore/types";
import type {
  TwelveDataBalanceSheet,
  TwelveDataBalanceSheetEntry,
  TwelveDataIncomeStatement,
  TwelveDataIncomeStatementEntry,
  TwelveDataProfile,
  TwelveDataQuote,
  TwelveDataStatistics,
  TwelveDataTimeSeries,
} from "./schemas.js";

function toNum(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNumOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIntOrNull(value: string | number | null | undefined): number | null {
  const n = toNumOrNull(value);
  if (n === null || n < 0) return null;
  return Math.trunc(n);
}

export function transformTickerInfo(
  symbol: TickerSymbol,
  quote: TwelveDataQuote,
  profile: TwelveDataProfile | undefined,
  stats: TwelveDataStatistics | undefined,
): TickerInfo {
  const valuations = stats?.statistics?.valuations_metrics;
  const priceSummary = stats?.statistics?.stock_price_summary;
  const fiftyTwoHigh =
    toNumOrNull(quote.fifty_two_week?.high) ??
    toNumOrNull(priceSummary?.fifty_two_week_high);
  const fiftyTwoLow =
    toNumOrNull(quote.fifty_two_week?.low) ??
    toNumOrNull(priceSummary?.fifty_two_week_low);
  const close = toNum(quote.close);
  return {
    symbol,
    name: profile?.name ?? quote.name ?? symbol,
    sector: profile?.sector ?? null,
    industry: profile?.industry ?? null,
    exchange: profile?.exchange ?? quote.exchange ?? null,
    description: profile?.description ?? null,
    currency: quote.currency ?? "USD",
    currentPrice: close,
    priceChange: toNum(quote.change),
    priceChangePercent: toNum(quote.percent_change) / 100,
    week52High: fiftyTwoHigh ?? close,
    week52Low: fiftyTwoLow ?? close,
    marketCap: toNumOrNull(valuations?.market_capitalization),
    volume: toIntOrNull(quote.volume),
    averageVolume:
      toIntOrNull(quote.average_volume) ??
      toIntOrNull(priceSummary?.day_average_volume_10d),
  };
}

/**
 * Empty `KeyMetrics` for plan-gated symbols where `/statistics` is forbidden.
 * Every field is `null` so the report renders "Not available" placeholders
 * instead of bogus zeroes.
 */
export function emptyKeyMetrics(): KeyMetrics {
  return {
    peRatioTTM: null,
    peRatioForward: null,
    priceToSales: null,
    priceToBook: null,
    evToEbitda: null,
    evToRevenue: null,
    pegRatio: null,
    dividendYield: null,
    payoutRatio: null,
  };
}

/**
 * Empty `Financials` for plan-gated symbols where `/income_statement`,
 * `/balance_sheet` or `/statistics` are forbidden. Numeric required fields
 * collapse to `0` (the schema disallows `null`); ratios/returns stay `null`.
 */
export function emptyFinancials(): Financials {
  return {
    revenueTTM: 0,
    netIncomeTTM: 0,
    epsTTM: 0,
    cash: 0,
    totalDebt: 0,
    debtToEquity: null,
    currentRatio: null,
    operatingCashFlowTTM: 0,
    freeCashFlowTTM: 0,
    capexTTM: 0,
    grossMargin: 0,
    operatingMargin: 0,
    netMargin: 0,
    returnOnEquity: null,
    returnOnAssets: null,
    fiscalYear: new Date().getUTCFullYear(),
  };
}

export function transformKeyMetrics(
  stats: TwelveDataStatistics | undefined,
): KeyMetrics {
  const v = stats?.statistics?.valuations_metrics;
  const dividends = stats?.statistics?.dividends_and_splits;
  return {
    peRatioTTM: toNumOrNull(v?.trailing_pe),
    peRatioForward: toNumOrNull(v?.forward_pe),
    priceToSales: toNumOrNull(v?.price_to_sales_ttm),
    priceToBook: toNumOrNull(v?.price_to_book_mrq),
    evToEbitda: toNumOrNull(v?.enterprise_to_ebitda),
    evToRevenue: toNumOrNull(v?.enterprise_to_revenue),
    pegRatio: toNumOrNull(v?.peg_ratio),
    dividendYield:
      toNumOrNull(dividends?.forward_annual_dividend_yield) ??
      toNumOrNull(dividends?.trailing_annual_dividend_yield),
    payoutRatio: toNumOrNull(dividends?.payout_ratio),
  };
}

export function transformFinancials(
  stats: TwelveDataStatistics | undefined,
  income: TwelveDataIncomeStatement,
  balance: TwelveDataBalanceSheet,
): Financials {
  const fin = stats?.statistics?.financials;
  const incomeStatementBlock = fin?.income_statement;
  const balanceSheetBlock = fin?.balance_sheet;
  const cashFlowBlock = fin?.cash_flow;
  const latestIncome = income.income_statement[0];
  const latestBalance = balance.balance_sheet[0];
  const operatingCashFlow = toNum(cashFlowBlock?.operating_cash_flow_ttm);
  const fcf = toNum(cashFlowBlock?.levered_free_cash_flow_ttm, operatingCashFlow);
  const fiscalYear = latestIncome !== undefined
    ? Number(latestIncome.fiscal_date.slice(0, 4)) || new Date().getUTCFullYear()
    : new Date().getUTCFullYear();
  return {
    revenueTTM: toNum(incomeStatementBlock?.revenue_ttm, toNum(latestIncome?.sales)),
    netIncomeTTM: toNum(
      incomeStatementBlock?.net_income_to_common_ttm,
      toNum(latestIncome?.net_income),
    ),
    epsTTM: toNum(incomeStatementBlock?.diluted_eps_ttm, toNum(latestIncome?.eps_diluted)),
    cash: toNum(
      balanceSheetBlock?.total_cash_mrq,
      toNum(latestBalance?.assets?.current_assets?.cash_and_cash_equivalents),
    ),
    totalDebt: toNum(
      balanceSheetBlock?.total_debt_mrq,
      toNum(latestBalance?.liabilities?.non_current_liabilities?.long_term_debt),
    ),
    debtToEquity: toNumOrNull(balanceSheetBlock?.total_debt_to_equity_mrq),
    currentRatio: toNumOrNull(balanceSheetBlock?.current_ratio_mrq),
    operatingCashFlowTTM: operatingCashFlow,
    freeCashFlowTTM: fcf,
    capexTTM: fcf - operatingCashFlow,
    grossMargin:
      toNumOrNull(incomeStatementBlock?.gross_profit_ttm) !== null &&
      toNum(incomeStatementBlock?.revenue_ttm) > 0
        ? toNum(incomeStatementBlock?.gross_profit_ttm) /
          toNum(incomeStatementBlock?.revenue_ttm)
        : 0,
    operatingMargin: toNum(fin?.operating_margin),
    netMargin: toNum(fin?.profit_margin),
    returnOnEquity: toNumOrNull(fin?.return_on_equity_ttm),
    returnOnAssets: toNumOrNull(fin?.return_on_assets_ttm),
    fiscalYear,
  };
}



function calendarQuarter(fiscalDate: string): { year: number; quarter: number } | null {
  const year = Number(fiscalDate.slice(0, 4));
  const month = Number(fiscalDate.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, quarter: Math.ceil(month / 3) };
}

export function transformQuarterlyResults(
  income: TwelveDataIncomeStatement,
  limit: number,
): QuarterlyResult[] {
  const entries: Array<{
    raw: TwelveDataIncomeStatementEntry;
    year: number;
    quarter: number;
  }> = [];
  for (const raw of income.income_statement) {
    const period = calendarQuarter(raw.fiscal_date);
    if (period === null) continue;
    entries.push({ raw, year: period.year, quarter: period.quarter });
  }
  const byKey = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    byKey.set(`${entry.year}-Q${entry.quarter}`, entry);
  }
  const out: QuarterlyResult[] = [];
  for (const entry of entries) {
    const prior = byKey.get(`${entry.year - 1}-Q${entry.quarter}`);
    out.push(transformQuarter(entry.raw, entry.year, entry.quarter, prior?.raw));
    if (out.length >= limit) break;
  }
  return out;
}

function transformQuarter(
  raw: TwelveDataIncomeStatementEntry,
  year: number,
  quarter: number,
  prior: TwelveDataIncomeStatementEntry | undefined,
): QuarterlyResult {
  const revenue = toNum(raw.sales);
  const operatingIncome = toNum(raw.operating_income);
  const netIncome = toNumOrNull(raw.net_income);
  const eps = toNum(raw.eps_diluted, toNum(raw.eps_basic));
  const priorRevenue = prior !== undefined ? toNumOrNull(prior.sales) : null;
  const growth =
    priorRevenue !== null && priorRevenue !== 0
      ? (revenue - priorRevenue) / priorRevenue
      : 0;
  const operatingMarginPercent = revenue !== 0 ? operatingIncome / revenue : 0;
  return {
    quarter: `Q${quarter} ${year}`,
    fiscalYear: year,
    revenue,
    revenueGrowthYoYPercent: growth,
    operatingIncome,
    operatingMarginPercent,
    netIncome,
    eps,
    segments: [],
    notes: null,
  };
}

export function transformPriceHistory(series: TwelveDataTimeSeries): PricePoint[] {
  // Twelve Data returns most-recent first; we keep the same ordering as the
  // wire shape so consumers can reverse if they want chronological order.
  const out: PricePoint[] = [];
  for (const candle of series.values) {
    const close = toNumOrNull(candle.close);
    if (close === null) continue;
    out.push({
      date: candle.datetime,
      close,
      open: toNumOrNull(candle.open),
      high: toNumOrNull(candle.high),
      low: toNumOrNull(candle.low),
      volume: toIntOrNull(candle.volume),
    });
  }
  return out;
}
