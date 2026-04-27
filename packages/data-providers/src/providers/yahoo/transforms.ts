/**
 * Pure transforms from validated Yahoo Finance shapes (see `schemas.ts`)
 * to `@darkscore/types` domain shapes. No I/O, no `Date.now()`, no
 * randomness — every output is a deterministic function of its input.
 *
 * Yahoo conventions handled here:
 *  - `RawNumberSchema` already collapses `{raw, fmt}` envelopes and `{}`
 *    placeholders down to `number | null`, so the transforms only deal in
 *    `number | null` from this point on.
 *  - Yahoo encodes margin/growth fields as fractions (0.27 means 27%);
 *    the `KeyMetrics`/`Financials` types in `@darkscore/types` accept
 *    finite numbers without a fixed unit, so we forward the raw fraction
 *    and document this in JSDoc.
 *  - Yahoo timestamps are POSIX seconds; converted to ISO `YYYY-MM-DD`.
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
  ChartResult,
  IncomeStatementRow,
  QuoteSummaryResult,
} from "./schemas.js";

/** Convert a POSIX-seconds timestamp to an ISO `YYYY-MM-DD` string (UTC). */
export function epochSecondsToIsoDate(seconds: number): string {
  const ms = Math.trunc(seconds) * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Pull a finite number out of a `number | null | undefined`, with a fallback. */
function num(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Pull a nullable finite number, normalizing `undefined` and `NaN` to `null`. */
function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Force a non-negative integer (Yahoo volumes occasionally arrive as floats). */
function intOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

export function transformTickerInfo(
  symbol: TickerSymbol,
  result: QuoteSummaryResult,
): TickerInfo {
  const price = result.price ?? {};
  const detail = result.summaryDetail ?? {};
  const profile = result.assetProfile ?? {};
  return {
    symbol,
    name: price.longName ?? price.shortName ?? symbol,
    sector: profile.sector ?? null,
    industry: profile.industry ?? null,
    exchange: price.exchangeName ?? null,
    description: profile.longBusinessSummary ?? null,
    currency: price.currency ?? "USD",
    currentPrice: num(price.regularMarketPrice),
    priceChange: num(price.regularMarketChange),
    priceChangePercent: num(price.regularMarketChangePercent),
    week52High: num(detail.fiftyTwoWeekHigh),
    week52Low: num(detail.fiftyTwoWeekLow),
    marketCap: numOrNull(price.marketCap),
    volume: intOrNull(price.regularMarketVolume),
    averageVolume: intOrNull(price.averageDailyVolume3Month),
  };
}

export function transformFinancials(result: QuoteSummaryResult): Financials {
  const fin = result.financialData ?? {};
  const keyStats = result.defaultKeyStatistics ?? {};
  const lastFiscal = numOrNull(keyStats.lastFiscalYearEnd);
  const fiscalYear =
    lastFiscal !== null
      ? Number(epochSecondsToIsoDate(lastFiscal).slice(0, 4))
      : new Date().getUTCFullYear();
  return {
    revenueTTM: num(fin.totalRevenue),
    netIncomeTTM: num(keyStats.netIncomeToCommon),
    epsTTM: num(keyStats.trailingEps),
    cash: num(fin.totalCash),
    totalDebt: num(fin.totalDebt),
    debtToEquity: numOrNull(fin.debtToEquity),
    currentRatio: numOrNull(fin.currentRatio),
    operatingCashFlowTTM: num(fin.operatingCashflow),
    freeCashFlowTTM: num(fin.freeCashflow),
    capexTTM: num(fin.capitalExpenditures),
    grossMargin: num(fin.grossMargins),
    operatingMargin: num(fin.operatingMargins),
    netMargin: num(fin.profitMargins),
    returnOnEquity: numOrNull(fin.returnOnEquity),
    returnOnAssets: numOrNull(fin.returnOnAssets),
    fiscalYear,
  };
}

export function transformKeyMetrics(result: QuoteSummaryResult): KeyMetrics {
  const detail = result.summaryDetail ?? {};
  const keyStats = result.defaultKeyStatistics ?? {};
  return {
    peRatioTTM: numOrNull(detail.trailingPE),
    peRatioForward: numOrNull(detail.forwardPE),
    priceToSales: numOrNull(detail.priceToSalesTrailing12Months),
    priceToBook: numOrNull(keyStats.priceToBook),
    evToEbitda: numOrNull(keyStats.enterpriseToEbitda),
    evToRevenue: numOrNull(keyStats.enterpriseToRevenue),
    pegRatio: numOrNull(keyStats.pegRatio),
    dividendYield: numOrNull(detail.dividendYield),
    payoutRatio: numOrNull(detail.payoutRatio),
  };
}

export function transformPriceHistory(result: ChartResult): PricePoint[] {
  const quote = result.indicators.quote[0];
  if (quote === undefined) return [];
  const ts = result.timestamp;
  const points: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const epoch = ts[i];
    if (typeof epoch !== "number" || !Number.isFinite(epoch)) continue;
    const close = quote.close[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    points.push({
      date: epochSecondsToIsoDate(epoch),
      close,
      open: numOrNull(quote.open[i]),
      high: numOrNull(quote.high[i]),
      low: numOrNull(quote.low[i]),
      volume: intOrNull(quote.volume[i]),
    });
  }
  return points;
}

/**
 * Build quarterly results from Yahoo's `incomeStatementHistoryQuarterly`.
 * Yahoo orders rows newest-first; we keep that order. YoY growth is filled
 * from the row 4 quarters back when present, otherwise `0`.
 */
export function transformQuarterlyResults(
  result: QuoteSummaryResult,
  quarters: number,
): QuarterlyResult[] {
  const rows = result.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];
  const out: QuarterlyResult[] = [];
  const limit = Math.min(quarters, rows.length);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] as IncomeStatementRow;
    const yoyRow = (rows[i + 4] as IncomeStatementRow | undefined) ?? null;
    const date = endDateIso(row);
    const revenue = num(row.totalRevenue);
    const yoyRevenue = yoyRow !== null ? num(yoyRow.totalRevenue) : 0;
    const operatingIncome = num(row.operatingIncome);
    out.push({
      quarter: quarterLabel(date),
      fiscalYear: Number(date.slice(0, 4)),
      revenue,
      revenueGrowthYoYPercent: yoyRevenue > 0 ? (revenue - yoyRevenue) / yoyRevenue : 0,
      operatingIncome,
      operatingMarginPercent: revenue > 0 ? operatingIncome / revenue : 0,
      netIncome: numOrNull(row.netIncome),
      eps: 0,
      segments: [],
      notes: null,
    });
  }
  return out;
}

function endDateIso(row: IncomeStatementRow): string {
  const ts = numOrNull(row.endDate);
  return ts !== null ? epochSecondsToIsoDate(ts) : "1970-01-01";
}

function quarterLabel(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const q = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  return `Q${q} ${isoDate.slice(0, 4)}`;
}

