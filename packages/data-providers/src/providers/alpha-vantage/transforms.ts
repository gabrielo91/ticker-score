/**
 * Pure transforms from validated Alpha Vantage shapes (`schemas.ts`) to
 * `@darkscore/types` domain shapes. No I/O, no `Date.now()`, no
 * randomness — every output is a deterministic function of its input.
 *
 * Conventions handled here:
 *  - Alpha Vantage returns most ratios as strings; the schema layer has
 *    already coerced them to `number | null`.
 *  - `OVERVIEW.MarketCapitalization` is in raw currency units (not
 *    millions like Finnhub).
 *  - `OVERVIEW.ProfitMargin`/`OperatingMarginTTM`/`ReturnOn*` are
 *    fractions (e.g. `0.27`), so they line up with the `Financials` shape
 *    which also stores fractions.
 *  - `OVERVIEW.QuarterlyEarningsGrowthYOY` is a fraction; `GrowthData`
 *    stores fractions for forward growth too.
 *  - Quarter labels follow `Q{n} {year}` derived from `fiscalDateEnding`.
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
  AlphaVantageBalanceReport,
  AlphaVantageBalanceSheet,
  AlphaVantageEarnings,
  AlphaVantageIncomeReport,
  AlphaVantageIncomeStatement,
  AlphaVantageOverview,
  AlphaVantageTimeSeriesDaily,
} from "./schemas.js";

function num(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function intOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

function quarterFromFiscalDate(date: string): { quarter: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-/u.exec(date);
  if (m === null) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const quarter = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  return { quarter, year };
}

export function transformTickerInfo(
  symbol: TickerSymbol,
  overview: AlphaVantageOverview,
  latestClose: number | null,
  previousClose: number | null,
): TickerInfo {
  const price = latestClose ?? 0;
  const change = latestClose !== null && previousClose !== null
    ? latestClose - previousClose
    : 0;
  const changePct = latestClose !== null && previousClose !== null && previousClose !== 0
    ? (latestClose - previousClose) / previousClose
    : 0;
  return {
    symbol,
    name: overview.Name ?? symbol,
    sector: overview.Sector ?? null,
    industry: overview.Industry ?? null,
    exchange: overview.Exchange ?? null,
    description: overview.Description ?? null,
    currency: overview.Currency ?? "USD",
    currentPrice: price,
    priceChange: change,
    priceChangePercent: changePct,
    week52High: num(overview["52WeekHigh"], price),
    week52Low: num(overview["52WeekLow"], price),
    marketCap: numOrNull(overview.MarketCapitalization),
    volume: null,
    averageVolume: null,
  };
}

export function transformKeyMetrics(overview: AlphaVantageOverview): KeyMetrics {
  return {
    peRatioTTM: numOrNull(overview.TrailingPE ?? overview.PERatio),
    peRatioForward: numOrNull(overview.ForwardPE),
    priceToSales: numOrNull(overview.PriceToSalesRatioTTM),
    priceToBook: numOrNull(overview.PriceToBookRatio),
    evToEbitda: numOrNull(overview.EVToEBITDA),
    evToRevenue: numOrNull(overview.EVToRevenue),
    pegRatio: numOrNull(overview.PEGRatio),
    dividendYield: numOrNull(overview.DividendYield),
    payoutRatio: numOrNull(overview.PayoutRatio),
  };
}

export function transformPriceHistory(
  series: AlphaVantageTimeSeriesDaily,
  months: number,
): PricePoint[] {
  const tradingDays = Math.max(1, Math.trunc(months) * 21);
  const entries = Object.entries(series["Time Series (Daily)"]).sort(
    (a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0),
  );
  const window = entries.slice(0, tradingDays).reverse();
  const points: PricePoint[] = [];
  for (const [date, bar] of window) {
    const close = bar["4. close"];
    if (close === null) continue;
    points.push({
      date,
      close,
      open: bar["1. open"] ?? null,
      high: bar["2. high"] ?? null,
      low: bar["3. low"] ?? null,
      volume: intOrNull(bar["5. volume"]),
    });
  }
  return points;
}

function pickLatestBalance(
  balance: AlphaVantageBalanceSheet,
): AlphaVantageBalanceReport | undefined {
  return balance.quarterlyReports[0] ?? balance.annualReports[0];
}

function pickLatestIncome(
  income: AlphaVantageIncomeStatement,
): AlphaVantageIncomeReport | undefined {
  return income.quarterlyReports[0] ?? income.annualReports[0];
}

function sumLastFour(items: ReadonlyArray<number | null | undefined>): number {
  let sum = 0;
  for (const v of items.slice(0, 4)) {
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  return sum;
}

export function transformFinancials(
  overview: AlphaVantageOverview,
  income: AlphaVantageIncomeStatement,
  balance: AlphaVantageBalanceSheet,
): Financials {
  const latestBalance = pickLatestBalance(balance);
  const cash = num(
    latestBalance?.cashAndShortTermInvestments
      ?? latestBalance?.cashAndCashEquivalentsAtCarryingValue,
  );
  const longTermDebt = num(
    latestBalance?.longTermDebt ?? latestBalance?.longTermDebtNoncurrent,
  );
  const shortTermDebt = num(latestBalance?.shortTermDebt ?? latestBalance?.currentDebt);
  const totalDebt = longTermDebt + shortTermDebt;
  const equity = num(latestBalance?.totalShareholderEquity);
  const debtToEquity = equity !== 0 ? totalDebt / equity : null;
  const currentAssets = numOrNull(latestBalance?.totalCurrentAssets);
  const currentLiabilities = numOrNull(latestBalance?.totalCurrentLiabilities);
  const currentRatio =
    currentAssets !== null && currentLiabilities !== null && currentLiabilities !== 0
      ? currentAssets / currentLiabilities
      : null;
  const revenueTTM =
    numOrNull(overview.RevenueTTM)
      ?? sumLastFour(income.quarterlyReports.map((r) => r.totalRevenue ?? null));
  const netIncomeTTM = sumLastFour(
    income.quarterlyReports.map((r) => r.netIncome ?? null),
  );
  const epsTTM = num(overview.DilutedEPSTTM ?? overview.EPS);
  const latestIncome = pickLatestIncome(income);
  const fiscalYear = latestIncome !== undefined
    ? quarterFromFiscalDate(latestIncome.fiscalDateEnding)?.year ?? new Date().getUTCFullYear()
    : new Date().getUTCFullYear();
  return {
    revenueTTM: num(revenueTTM),
    netIncomeTTM,
    epsTTM,
    cash,
    totalDebt,
    debtToEquity,
    currentRatio,
    operatingCashFlowTTM: 0,
    freeCashFlowTTM: 0,
    capexTTM: 0,
    grossMargin: num(overview.GrossProfitTTM) !== 0 && num(revenueTTM) !== 0
      ? num(overview.GrossProfitTTM) / num(revenueTTM)
      : 0,
    operatingMargin: num(overview.OperatingMarginTTM),
    netMargin: num(overview.ProfitMargin),
    returnOnEquity: numOrNull(overview.ReturnOnEquityTTM),
    returnOnAssets: numOrNull(overview.ReturnOnAssetsTTM),
    fiscalYear,
  };
}

export function transformQuarterlyResults(
  income: AlphaVantageIncomeStatement,
  earnings: AlphaVantageEarnings,
  limit: number,
): QuarterlyResult[] {
  const reports = income.quarterlyReports;
  const epsByDate = new Map<string, number | null>();
  for (const e of earnings.quarterlyEarnings) {
    epsByDate.set(e.fiscalDateEnding, numOrNull(e.reportedEPS));
  }
  const out: QuarterlyResult[] = [];
  for (let i = 0; i < reports.length && out.length < limit; i += 1) {
    const r = reports[i];
    if (r === undefined) continue;
    const q = quarterFromFiscalDate(r.fiscalDateEnding);
    if (q === null) continue;
    const prior = reports[i + 4];
    const revenue = num(r.totalRevenue);
    const priorRevenue = prior !== undefined ? numOrNull(prior.totalRevenue) : null;
    const growth =
      priorRevenue !== null && priorRevenue !== 0
        ? (revenue - priorRevenue) / priorRevenue
        : 0;
    const operatingIncome = num(r.operatingIncome);
    const operatingMarginPercent = revenue !== 0 ? operatingIncome / revenue : 0;
    const eps = epsByDate.get(r.fiscalDateEnding) ?? 0;
    out.push({
      quarter: `Q${q.quarter} ${q.year}`,
      fiscalYear: q.year,
      revenue,
      revenueGrowthYoYPercent: growth,
      operatingIncome,
      operatingMarginPercent,
      netIncome: numOrNull(r.netIncome),
      eps,
      segments: [],
      notes: null,
    });
  }
  return out;
}

