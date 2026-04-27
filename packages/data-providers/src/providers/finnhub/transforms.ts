/**
 * Pure transforms from validated Finnhub shapes (`schemas.ts`) to
 * `@darkscore/types` domain shapes. No I/O, no `Date.now()`, no
 * randomness — every output is a deterministic function of its input.
 *
 * Conventions handled here:
 *  - Finnhub returns `marketCapitalization` in **millions** of currency
 *    units; we multiply by 1e6 to match the `TickerInfo.marketCap` contract
 *    (raw currency units).
 *  - Finnhub margins are already **percent values** (e.g. 27.3 means 27.3%);
 *    `Financials` stores fractions, so we divide by 100.
 *  - Finnhub's `dp` (day percent change) is also already a percent; we
 *    convert to the fraction shape `TickerInfo.priceChangePercent` uses.
 *  - Quarter labels follow `Q{n} {year}`; if Finnhub returns `quarter:0`
 *    (annual filing slipping in) we skip it.
 */
import type {
  Financials,
  KeyMetrics,
  QuarterlyResult,
  TickerInfo,
  TickerSymbol,
} from "@darkscore/types";
import type {
  FinnhubFinancialEntry,
  FinnhubFinancialsReported,
  FinnhubLineItem,
  FinnhubMetricBlock,
  FinnhubMetricResponse,
  FinnhubProfile2,
  FinnhubQuote,
} from "./schemas.js";

/**
 * Known XBRL `concept` aliases for revenue across the SEC filing universe.
 * Different filers tag the same line item differently; checking only one or two
 * tags causes silent revenue=0 reads (e.g. Alphabet uses `Revenues`,
 * post-ASC-606 retailers use `RevenueFromContractWithCustomerExcludingAssessedTax`,
 * banks use `RevenuesNetOfInterestExpense`, financial services often use
 * `InterestAndDividendIncomeOperating`). Order is from most→least common.
 */
const REVENUE_CONCEPTS = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenue",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
  "SalesRevenueServicesNet",
  "TotalRevenues",
  "RevenuesNetOfInterestExpense",
  "InterestAndDividendIncomeOperating",
] as const;

const NET_INCOME_CONCEPTS = [
  "NetIncomeLoss",
  "NetIncome",
  "NetIncomeLossAvailableToCommonStockholdersBasic",
] as const;

const EPS_CONCEPTS = [
  "EarningsPerShareDiluted",
  "EarningsPerShareBasicAndDiluted",
  "EarningsPerShareBasic",
] as const;

const OPERATING_INCOME_CONCEPTS = [
  "OperatingIncomeLoss",
  "OperatingIncome",
  "IncomeLossFromContinuingOperationsBeforeIncomeTaxes",
] as const;

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

export function transformTickerInfo(
  symbol: TickerSymbol,
  quote: FinnhubQuote,
  profile: FinnhubProfile2,
  metrics: FinnhubMetricBlock | undefined,
): TickerInfo {
  const marketCapMillions = numOrNull(profile.marketCapitalization);
  return {
    symbol,
    name: profile.name ?? symbol,
    sector: null, // Finnhub free profile2 does not expose GICS sector
    industry: profile.finnhubIndustry ?? null,
    exchange: profile.exchange ?? null,
    description: null, // Finnhub free profile2 does not expose a long business summary
    currency: profile.currency ?? "USD",
    currentPrice: num(quote.c),
    priceChange: num(quote.d),
    // Finnhub `dp` is already a percent; TickerInfo expects a fraction so
    // a cell can render `dp * 100`.
    priceChangePercent: num(quote.dp) / 100,
    week52High: num(metrics?.["52WeekHigh"], num(quote.h)),
    week52Low: num(metrics?.["52WeekLow"], num(quote.l)),
    marketCap: marketCapMillions !== null ? marketCapMillions * 1_000_000 : null,
    volume: null, // not in /quote
    averageVolume: intOrNull(metrics?.["10DayAverageTradingVolume"]),
  };
}

export function transformKeyMetrics(metric: FinnhubMetricBlock | undefined): KeyMetrics {
  const m = metric ?? {};
  return {
    peRatioTTM: numOrNull(m.peTTM),
    peRatioForward: null, // free tier does not expose forward P/E
    priceToSales: numOrNull(m.psTTM),
    priceToBook: numOrNull(m.pbAnnual ?? m.pbQuarterly),
    evToEbitda: numOrNull(m["currentEv/EBITDA"]),
    evToRevenue: null,
    pegRatio: numOrNull(m.pegRatio),
    dividendYield: numOrNull(m.dividendYieldIndicatedAnnual),
    payoutRatio: numOrNull(m.payoutRatioTTM),
  };
}

/** Look up a line item by XBRL `concept` (case-insensitive substring match). */
function findLineItem(
  items: ReadonlyArray<FinnhubLineItem>,
  ...needles: string[]
): number | null {
  for (const needle of needles) {
    const n = needle.toLowerCase();
    for (const item of items) {
      if ((item.concept ?? "").toLowerCase() === n) {
        return numOrNull(item.value);
      }
    }
  }
  return null;
}

export function transformFinancials(
  metricResp: FinnhubMetricResponse,
  reported: FinnhubFinancialsReported,
): Financials {
  const m = metricResp.metric ?? {};
  const latest = reported.data[0];
  const bs = latest?.report.bs ?? [];
  const cf = latest?.report.cf ?? [];
  const cash = findLineItem(bs, "CashAndCashEquivalentsAtCarryingValue", "Cash") ?? 0;
  const totalDebt = findLineItem(bs, "LongTermDebt", "DebtCurrent") ?? 0;
  const operatingCashFlow =
    findLineItem(cf, "NetCashProvidedByUsedInOperatingActivities") ?? 0;
  const capex =
    findLineItem(cf, "PaymentsToAcquirePropertyPlantAndEquipment") ?? 0;
  const revenueTTM =
    numOrNull(m.revenueTTM) ?? sumQuarterlyRevenue(reported, 4);
  return {
    revenueTTM,
    netIncomeTTM: num(m.netIncomeCommonTTM),
    epsTTM: num(m.epsTTM),
    cash,
    totalDebt,
    debtToEquity: numOrNull(m["totalDebt/totalEquityAnnual"]),
    currentRatio: numOrNull(m.currentRatioAnnual),
    operatingCashFlowTTM: operatingCashFlow,
    freeCashFlowTTM: operatingCashFlow - Math.abs(capex),
    capexTTM: -Math.abs(capex),
    grossMargin: num(m.grossMarginTTM) / 100,
    operatingMargin: num(m.operatingMarginTTM) / 100,
    netMargin: num(m.netProfitMarginTTM) / 100,
    returnOnEquity: numOrNull(m.roeTTM),
    returnOnAssets: numOrNull(m.roaTTM),
    fiscalYear: latest?.year ?? new Date().getUTCFullYear(),
  };
}

export function transformQuarterlyResults(
  reported: FinnhubFinancialsReported,
  limit: number,
): QuarterlyResult[] {
  const out: QuarterlyResult[] = [];
  // Index by `Q{q} {year}` so we can look up the prior-year quarter for YoY.
  const byKey = new Map<string, FinnhubFinancialEntry>();
  for (const entry of reported.data) {
    if (entry.quarter < 1 || entry.quarter > 4) continue;
    byKey.set(`Q${entry.quarter} ${entry.year}`, entry);
  }
  for (const entry of reported.data) {
    if (entry.quarter < 1 || entry.quarter > 4) continue;
    const prior = byKey.get(`Q${entry.quarter} ${entry.year - 1}`);
    out.push(transformQuarter(entry, prior));
    if (out.length >= limit) break;
  }
  return out;
}

function transformQuarter(
  entry: FinnhubFinancialEntry,
  prior: FinnhubFinancialEntry | undefined,
): QuarterlyResult {
  const ic = entry.report.ic;
  const revenue = findLineItem(ic, ...REVENUE_CONCEPTS) ?? 0;
  const operatingIncome = findLineItem(ic, ...OPERATING_INCOME_CONCEPTS) ?? 0;
  const netIncome = findLineItem(ic, ...NET_INCOME_CONCEPTS);
  const eps = findLineItem(ic, ...EPS_CONCEPTS) ?? 0;
  const priorRevenue =
    prior !== undefined ? findLineItem(prior.report.ic, ...REVENUE_CONCEPTS) : null;
  if (revenue === 0 && ic.length > 0) {
    // XBRL tag mismatch likely — surface for diagnostics; observability
    // package will replace this with structured logging later.
    // eslint-disable-next-line no-console -- temporary diagnostic until observability pkg lands
    console.warn(
      `[finnhub] revenue=0 for Q${entry.quarter} ${entry.year} — XBRL tag mismatch likely`,
    );
  }
  const growth =
    priorRevenue !== null && priorRevenue !== 0
      ? (revenue - priorRevenue) / priorRevenue
      : 0;
  const operatingMarginPercent = revenue !== 0 ? operatingIncome / revenue : 0;
  return {
    quarter: `Q${entry.quarter} ${entry.year}`,
    fiscalYear: entry.year,
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

/**
 * Fallback for `revenueTTM` when Finnhub's `basicFinancials.metric.revenueTTM`
 * is missing (some non-standard filers, ADRs). Sums revenue from the most
 * recent up-to-`count` quarterly filings using the same alias list as
 * `transformQuarter`. Returns 0 when no quarter resolves a revenue value.
 */
function sumQuarterlyRevenue(
  reported: FinnhubFinancialsReported,
  count: number,
): number {
  let total = 0;
  let used = 0;
  for (const entry of reported.data) {
    if (entry.quarter < 1 || entry.quarter > 4) continue;
    const r = findLineItem(entry.report.ic, ...REVENUE_CONCEPTS);
    if (r === null) continue;
    total += r;
    used += 1;
    if (used >= count) break;
  }
  return total;
}

