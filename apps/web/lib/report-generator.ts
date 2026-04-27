/**
 * Report generator — server-side orchestration that wires every backend
 * package into a single `ReportData` payload. Per `apps/web/CONSTITUTION.md`
 * the web app composes; it does not compute or fetch directly.
 *
 * Flow (Constitution C2 + C5):
 *   1. Build a `CacheService` (Redis if `REDIS_URL` is set, otherwise a no-op
 *      backend so the orchestrator still works without infrastructure).
 *   2. Build a `ProviderRegistry` with `YahooFinanceProvider` and a
 *      `DataAggregator` over it.
 *   3. Fetch ticker info, price history, financials, key metrics, quarterly
 *      results in parallel — every call returns `Result`, never throws.
 *   4. Derive `GrowthData` from quarterly results (Yahoo does not expose a
 *      first-class growth endpoint).
 *   5. Run `EditorialStrategy` via `runScoring`.
 *   6. Assemble a typed `ReportData` and return `Result<ReportData, Error>`.
 *
 * DB persistence is intentionally out of scope for W3-1 (no Postgres
 * required for local dev). W3-5 will add it behind the same orchestrator.
 */
import {
  DataAggregator,
  FINNHUB_PROVIDER_NAME,
  FinnhubProvider,
  ProviderRegistry,
  YahooFinanceProvider,
} from "@darkscore/data-providers";
import { getYahooRuntime } from "./yahoo-singleton";
import {
  DEFAULT_PROVIDER_ID,
  isKnownProviderId,
  type ProviderId,
} from "./providers";
import { EditorialStrategy, runScoring } from "@darkscore/scoring-engine";
import {
  err,
  isErr,
  ok,
  TickerSymbolSchema,
  type DataCard,
  type DataPoint,
  type Financials,
  type GrowthData,
  type KeyMetrics,
  type KpiHighlight,
  type PricePoint,
  type QuarterlyResult,
  type ReportData,
  type Result,
  type TickerInfo,
  type TickerSymbol,
} from "@darkscore/types";
import { NOT_AVAILABLE } from "./format";

const PRICE_HISTORY_MONTHS = 12;
const QUARTERLY_HISTORY_QUARTERS = 8;

export interface GenerateReportOptions {
  /**
   * Data source the user picked from the UI. When omitted, defaults to
   * `DEFAULT_PROVIDER_ID` (Yahoo). The aggregator routes the read to the
   * named provider only — there is **no silent fallback** (the user asked
   * for a specific source, so a failure must surface as an error).
   */
  readonly provider?: string;
}

export async function generateReport(
  ticker: string,
  options: GenerateReportOptions = {},
): Promise<Result<ReportData, Error>> {
  const parsed = TickerSymbolSchema.safeParse(ticker.toUpperCase());
  if (!parsed.success) {
    return err(new Error(`Invalid ticker symbol "${ticker}"`));
  }
  const symbol: TickerSymbol = parsed.data;

  const requested = options.provider ?? DEFAULT_PROVIDER_ID;
  if (!isKnownProviderId(requested)) {
    return err(new Error(`Unknown data provider "${requested}"`));
  }
  const providerId: ProviderId = requested;

  // The Yahoo client and its `SessionStore` are kept on a process-wide
  // singleton so the cookie/crumb bootstrap is paid at most once per
  // process (or once globally when Redis is configured) — see
  // `yahoo-singleton.ts` for rationale.
  const { cache, client } = getYahooRuntime();
  const registry = new ProviderRegistry().register(
    new YahooFinanceProvider({ client }),
  );
  // Finnhub is registered when an API key is provided. With per-request
  // provider selection, it is no longer a fallback — it is an opt-in source
  // the user can pick from the dropdown.
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const finnhubAvailable =
    typeof finnhubKey === "string" && finnhubKey.length > 0;
  if (finnhubAvailable) {
    registry.register(new FinnhubProvider({ apiKey: finnhubKey as string }));
  }
  if (providerId === FINNHUB_PROVIDER_NAME && !finnhubAvailable) {
    return err(
      new Error(
        `Provider "${FINNHUB_PROVIDER_NAME}" is not available (FINNHUB_API_KEY is not configured)`,
      ),
    );
  }
  const aggregator = new DataAggregator(registry, cache, {
    providerName: providerId,
  });

  const [tickerRes, priceRes, finRes, metricsRes, quarterlyRes] =
    await Promise.all([
      aggregator.getTickerInfo(symbol),
      aggregator.getPriceHistory(symbol, PRICE_HISTORY_MONTHS),
      aggregator.getFinancials(symbol),
      aggregator.getKeyMetrics(symbol),
      aggregator.getQuarterlyResults(symbol, QUARTERLY_HISTORY_QUARTERS),
    ]);

  if (isErr(tickerRes)) return tickerRes;
  if (isErr(finRes)) return finRes;
  if (isErr(metricsRes)) return metricsRes;
  if (isErr(quarterlyRes)) return quarterlyRes;

  const tickerInfo = tickerRes.data;
  const financials = finRes.data;
  const keyMetrics = metricsRes.data;
  const quarterly = quarterlyRes.data;
  const priceHistory: PricePoint[] = priceRes.ok ? priceRes.data : [];

  const growth = deriveGrowthData(quarterly);
  const computedAt = new Date().toISOString();

  const scoring = runScoring(
    { metrics: keyMetrics, financials, growth, computedAt },
    new EditorialStrategy(),
  );
  if (isErr(scoring)) {
    return err(new Error(`Scoring failed: ${scoring.error.message}`));
  }

  const report: ReportData = {
    ticker: tickerInfo,
    priceChart: { points: priceHistory, annotations: [] },
    kpiStrip: buildKpiStrip(tickerInfo, keyMetrics),
    valuationCards: buildValuationCards(keyMetrics),
    financialHealthCards: buildFinancialHealthCards(financials),
    growthCards: buildGrowthCards(growth),
    financials,
    keyMetrics,
    growth,
    quarterlyResults: quarterly,
    scoreBreakdown: scoring.data.breakdown,
    riskScore: scoring.data.breakdown.composite,
    latestEarnings: buildLatestEarnings(quarterly),
    catalysts: [],
    risks: [],
    verdict: buildVerdict(tickerInfo),
    generatedAt: computedAt,
    dataAsOf: computedAt,
    notFinancialAdvice: true,
  };

  return ok(report);
}

function deriveGrowthData(quarters: ReadonlyArray<QuarterlyResult>): GrowthData {
  const latest = quarters[0];
  const fraction = latest?.revenueGrowthYoYPercent ?? 0;
  return {
    revenueGrowthYoY: fraction * 100,
    revenueGrowthForward: null,
    earningsGrowthYoY: null,
    earningsGrowthForward: null,
    ebitdaGrowthForward: null,
    segments: [],
  };
}

function buildKpiStrip(info: TickerInfo, metrics: KeyMetrics): KpiHighlight[] {
  const items: KpiHighlight[] = [
    {
      label: "Price",
      value: formatCurrency(info.currentPrice, info.currency),
      status: null,
      note: null,
    },
    {
      label: "Day Change",
      value: `${formatSigned(info.priceChangePercent * 100)}%`,
      status: info.priceChange >= 0 ? "green" : "red",
      note: null,
    },
    {
      label: "Market Cap",
      value: info.marketCap !== null ? formatCompact(info.marketCap) : NOT_AVAILABLE,
      status: null,
      note: null,
    },
    {
      label: "P/E (TTM)",
      value: metrics.peRatioTTM !== null ? metrics.peRatioTTM.toFixed(1) : NOT_AVAILABLE,
      status: null,
      note: null,
    },
  ];
  return items;
}

function buildValuationCards(metrics: KeyMetrics): DataCard[] {
  const items: DataPoint[] = [
    point("P/E (TTM)", metrics.peRatioTTM, (v) => v.toFixed(1)),
    point("P/E (Fwd)", metrics.peRatioForward, (v) => v.toFixed(1)),
    point("P/S", metrics.priceToSales, (v) => v.toFixed(2)),
    point("EV/EBITDA", metrics.evToEbitda, (v) => v.toFixed(1)),
    point("PEG", metrics.pegRatio, (v) => v.toFixed(2)),
  ];
  return [{ title: "Valuation", subtitle: null, items }];
}

function buildFinancialHealthCards(fin: Financials): DataCard[] {
  const items: DataPoint[] = [
    point("Debt/Equity", fin.debtToEquity, (v) => v.toFixed(2)),
    point("Current Ratio", fin.currentRatio, (v) => v.toFixed(2)),
    point("Net Margin", fin.netMargin, (v) => `${(v * 100).toFixed(1)}%`),
    point("FCF (TTM)", fin.freeCashFlowTTM, formatCompact),
    point("ROE", fin.returnOnEquity, (v) => `${(v * 100).toFixed(1)}%`),
  ];
  return [{ title: "Financial Health", subtitle: null, items }];
}

function buildGrowthCards(growth: GrowthData): DataCard[] {
  const items: DataPoint[] = [
    point("Revenue YoY", growth.revenueGrowthYoY, (v) => `${v.toFixed(1)}%`),
    point("Revenue Fwd", growth.revenueGrowthForward, (v) => `${v.toFixed(1)}%`),
    point("Earnings YoY", growth.earningsGrowthYoY, (v) => `${v.toFixed(1)}%`),
    point("Earnings Fwd", growth.earningsGrowthForward, (v) => `${v.toFixed(1)}%`),
    point("EBITDA Fwd", growth.ebitdaGrowthForward, (v) => `${v.toFixed(1)}%`),
  ];
  return [{ title: "Growth", subtitle: null, items }];
}

function buildLatestEarnings(quarters: ReadonlyArray<QuarterlyResult>) {
  const latest = quarters[0];
  if (latest === undefined) {
    return {
      quarter: NOT_AVAILABLE,
      reportedAt: NOT_AVAILABLE,
      highlights: [],
      upcoming: null,
    };
  }
  return {
    quarter: latest.quarter,
    reportedAt: latest.quarter,
    highlights: [
      point("Revenue", latest.revenue, formatCompact),
      point("Operating Income", latest.operatingIncome, formatCompact),
      point("EPS", latest.eps, (v) => v.toFixed(2)),
    ],
    upcoming: null,
  };
}

function buildVerdict(info: TickerInfo) {
  const price = info.currentPrice;
  return {
    summary:
      `Generated ${info.symbol} risk report from live market data. ` +
      `Catalysts and risks are populated by editorial review in W3-2.`,
    priceTargets: {
      bear: round2(price * 0.85),
      base: round2(price * 1.0),
      bull: round2(price * 1.2),
    },
  };
}

function point(
  label: string,
  value: number | null,
  format: (v: number) => string,
): DataPoint {
  return {
    label,
    value: value !== null ? format(value) : NOT_AVAILABLE,
    status: null,
    note: null,
  };
}

function formatCurrency(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

