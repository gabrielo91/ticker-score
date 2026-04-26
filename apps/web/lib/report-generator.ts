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
  CacheService,
  createRedisClient,
  type CacheBackend,
  type RedisClient,
} from "@darkscore/cache";
import {
  DataAggregator,
  ProviderRegistry,
  YahooFinanceProvider,
} from "@darkscore/data-providers";
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

const PRICE_HISTORY_MONTHS = 12;
const QUARTERLY_HISTORY_QUARTERS = 8;

/**
 * No-op cache backend used when `REDIS_URL` is unset. `get` always returns
 * `null` (cache miss) and `set`/`del`/`scan` are inert. This lets the
 * orchestrator keep its cache-first contract on a developer laptop without
 * Redis running, without complicating the production code path.
 */
class NullCacheBackend implements CacheBackend {
  async get(): Promise<string | null> {
    return null;
  }
  async set(): Promise<"OK" | null> {
    return "OK";
  }
  async del(): Promise<number> {
    return 0;
  }
  async scan(): Promise<[string, string[]]> {
    return ["0", []];
  }
}

interface CacheBuildOutcome {
  readonly cache: CacheService;
  readonly client: RedisClient | null;
}

function buildCache(): CacheBuildOutcome {
  const url = process.env.REDIS_URL;
  if (typeof url === "string" && url.length > 0) {
    const created = createRedisClient({ url });
    if (created.ok) {
      return { cache: new CacheService(created.data), client: created.data };
    }
  }
  return { cache: new CacheService(new NullCacheBackend()), client: null };
}

export async function generateReport(
  ticker: string,
): Promise<Result<ReportData, Error>> {
  const parsed = TickerSymbolSchema.safeParse(ticker.toUpperCase());
  if (!parsed.success) {
    return err(new Error(`Invalid ticker symbol "${ticker}"`));
  }
  const symbol: TickerSymbol = parsed.data;

  const { cache } = buildCache();
  const registry = new ProviderRegistry().register(new YahooFinanceProvider());
  const aggregator = new DataAggregator(registry, cache);

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
      value: info.marketCap !== null ? formatCompact(info.marketCap) : "—",
      status: null,
      note: null,
    },
    {
      label: "P/E (TTM)",
      value: metrics.peRatioTTM !== null ? metrics.peRatioTTM.toFixed(1) : "—",
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
      quarter: "—",
      reportedAt: "—",
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
    value: value !== null ? format(value) : "—",
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

