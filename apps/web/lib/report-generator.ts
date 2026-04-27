/**
 * Report generator — server-side orchestration that wires every backend
 * package into a single `ReportData` payload. Per `apps/web/CONSTITUTION.md`
 * the web app composes; it does not compute or fetch directly.
 *
 * Flow (Constitution C2 + C5):
 *   1. Build a `CacheService` (Redis if `REDIS_URL` is set, otherwise a no-op
 *      backend so the orchestrator still works without infrastructure).
 *   2. Build a `ProviderRegistry` with the user-selected source (Twelve Data
 *      by default, optionally Finnhub when `FINNHUB_API_KEY` is configured)
 *      and a strict-mode `DataAggregator` over it (no silent fallback).
 *   3. Fetch ticker info, price history, financials, key metrics, quarterly
 *      results in parallel — every call returns `Result`, never throws.
 *   4. Derive `GrowthData` from quarterly results (the underlying providers
 *      do not expose a first-class growth endpoint on their free tiers).
 *   5. Run `EditorialStrategy` via `runScoring`.
 *   6. Cache-first call to the env-selected `NarrativeProvider` (Spec 002,
 *      W4-4). Failure surfaces as `narrativeAvailable: false`; success
 *      populates `report.narrative`.
 *   7. Assemble a typed `ReportData` and return `Result<ReportData, Error>`.
 *
 * DB persistence is intentionally out of scope (W3-5 will add it behind the
 * same orchestrator).
 */
import {
  DataAggregator,
  FINNHUB_PROVIDER_NAME,
  FinnhubProvider,
  ProviderRegistry,
  TWELVE_DATA_PROVIDER_NAME,
  TwelveDataProvider,
} from "@darkscore/data-providers";
import { getCacheRuntime } from "./cache-runtime";
import { mergeNarrativeIntoReport } from "./narrative-merge";
import { getNarrativeRuntime, runNarrative } from "./narrative-runtime";
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
  Rating,
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
  type RiskScore,
  type ScoreBreakdown,
  type TickerInfo,
  type TickerSymbol,
} from "@darkscore/types";
import { NOT_AVAILABLE } from "./format";

const PRICE_HISTORY_MONTHS = 12;
const QUARTERLY_HISTORY_QUARTERS = 8;

export interface GenerateReportOptions {
  /**
   * Data source the user picked from the UI. When omitted, defaults to
   * `DEFAULT_PROVIDER_ID` (Twelve Data). The aggregator routes the read to
   * the named provider only — there is **no silent fallback** (the user
   * asked for a specific source, so a failure must surface as an error).
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

  const { cache } = getCacheRuntime();
  const registry = new ProviderRegistry();

  // Twelve Data is registered when an API key is provided (default source).
  const twelveDataKey = process.env.TWELVEDATA_API_KEY;
  const twelveDataAvailable =
    typeof twelveDataKey === "string" && twelveDataKey.length > 0;
  if (twelveDataAvailable) {
    registry.register(new TwelveDataProvider({ apiKey: twelveDataKey as string }));
  }
  if (providerId === TWELVE_DATA_PROVIDER_NAME && !twelveDataAvailable) {
    return err(
      new Error(
        `Provider "${TWELVE_DATA_PROVIDER_NAME}" is not available (TWELVEDATA_API_KEY is not configured)`,
      ),
    );
  }

  // Finnhub is registered when an API key is provided. With per-request
  // provider selection, it is an opt-in source the user can pick from the
  // dropdown — never a silent fallback.
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
  const tickerInfo = tickerRes.data;
  const priceHistory: PricePoint[] = priceRes.ok ? priceRes.data : [];
  const computedAt = new Date().toISOString();

  // Fundamentals fetches are bundled: if any one fails (e.g. Twelve Data's
  // Basic plan refuses `/statistics`, `/income_statement`, `/balance_sheet`
  // with 403), we cannot honestly compute a score. Render a partial report
  // with `fundamentalsAvailable: false` so the UI suppresses the score
  // gauge, breakdown, and verdict instead of inventing a rating from zeros.
  if (isErr(finRes) || isErr(metricsRes) || isErr(quarterlyRes)) {
    return ok(
      buildPartialReport(tickerInfo, priceHistory, computedAt),
    );
  }

  const financials = finRes.data;
  const keyMetrics = metricsRes.data;
  const quarterly = quarterlyRes.data;

  const growth = deriveGrowthData(quarterly);

  const scoring = runScoring(
    { metrics: keyMetrics, financials, growth, computedAt },
    new EditorialStrategy(),
  );
  if (isErr(scoring)) {
    return err(new Error(`Scoring failed: ${scoring.error.message}`));
  }

  // Narrative enrichment (Spec 002, W4-4). Cache-first against the
  // env-selected provider; any failure (no provider, transport, schema)
  // surfaces as `narrativeAvailable: false` and the page renders the
  // Spec-001 layout — never throws.
  const { provider: narrativeProvider } = getNarrativeRuntime();
  const narrativeOutcome = await runNarrative(narrativeProvider, cache, {
    ticker: tickerInfo,
    riskScore: scoring.data.breakdown.composite,
    scoreBreakdown: scoring.data.breakdown,
    financials,
    keyMetrics,
    quarterlyResults: quarterly,
    priceHistory,
  });

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
    fundamentalsAvailable: true,
    narrative: narrativeOutcome.narrative,
    narrativeAvailable: narrativeOutcome.narrativeAvailable,
  };

  // Narrative UI merge (Spec 002, W4-5). When a narrative is available we
  // overlay its catalysts, risks, chart annotations, verdict prose, scenario
  // price targets, and card subtitles onto the structured report. Headline
  // and disclaimer are surfaced separately by the page (no Spec-001 slot).
  const merged =
    narrativeOutcome.narrativeAvailable && narrativeOutcome.narrative !== null
      ? mergeNarrativeIntoReport(report, narrativeOutcome.narrative)
      : report;

  return ok(merged);
}

/**
 * Assemble a report shell when the provider cannot supply fundamentals. The
 * UI gates the score gauge, score breakdown, and verdict on
 * `fundamentalsAvailable`, so the stub values for those fields are never
 * rendered — they exist only to satisfy the schema.
 */
function buildPartialReport(
  tickerInfo: TickerInfo,
  priceHistory: PricePoint[],
  computedAt: string,
): ReportData {
  const keyMetrics = emptyKeyMetrics();
  const financials = emptyFinancials();
  const growth = emptyGrowth();
  return {
    ticker: tickerInfo,
    priceChart: { points: priceHistory, annotations: [] },
    kpiStrip: buildKpiStrip(tickerInfo, keyMetrics),
    valuationCards: [],
    financialHealthCards: [],
    growthCards: [],
    financials,
    keyMetrics,
    growth,
    quarterlyResults: [],
    scoreBreakdown: emptyScoreBreakdown(computedAt),
    riskScore: emptyRiskScore(computedAt),
    latestEarnings: buildLatestEarnings([]),
    catalysts: [],
    risks: [],
    verdict: buildVerdict(tickerInfo),
    generatedAt: computedAt,
    dataAsOf: computedAt,
    notFinancialAdvice: true,
    fundamentalsAvailable: false,
    narrative: null,
    narrativeAvailable: false,
  };
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
  const peCard: DataCard = {
    title: "P/E Ratio",
    subtitle: null,
    items: [
      point("TTM P/E", metrics.peRatioTTM, (v) => `${v.toFixed(1)}x`),
      point("Forward P/E", metrics.peRatioForward, (v) => `${v.toFixed(1)}x`),
      point("PEG", metrics.pegRatio, (v) => `${v.toFixed(2)}x`),
    ],
  };
  const evCard: DataCard = {
    title: "Enterprise Value",
    subtitle: null,
    items: [
      point("EV/EBITDA", metrics.evToEbitda, (v) => `${v.toFixed(1)}x`),
      point("EV/Revenue", metrics.evToRevenue, (v) => `${v.toFixed(2)}x`),
      point("P/S", metrics.priceToSales, (v) => `${v.toFixed(2)}x`),
    ],
  };
  const otherCard: DataCard = {
    title: "Other Multiples",
    subtitle: null,
    items: [
      point("P/B", metrics.priceToBook, (v) => `${v.toFixed(2)}x`),
      point("Dividend Yield", metrics.dividendYield, (v) => `${(v * 100).toFixed(2)}%`),
      point("Payout Ratio", metrics.payoutRatio, (v) => `${(v * 100).toFixed(1)}%`),
    ],
  };
  return [peCard, evCard, otherCard];
}

function buildFinancialHealthCards(fin: Financials): DataCard[] {
  const balanceCard: DataCard = {
    title: "Balance Sheet",
    subtitle: null,
    items: [
      point("Cash", fin.cash, formatCompact),
      point("Total Debt", fin.totalDebt, formatCompact),
      point("Debt/Equity", fin.debtToEquity, (v) => v.toFixed(2)),
      point("Current Ratio", fin.currentRatio, (v) => v.toFixed(2)),
    ],
  };
  const cashFlowCard: DataCard = {
    title: "Cash Flow",
    subtitle: null,
    items: [
      point("OCF (TTM)", fin.operatingCashFlowTTM, formatCompact),
      point("FCF (TTM)", fin.freeCashFlowTTM, formatCompact),
      point("CapEx (TTM)", fin.capexTTM, formatCompact),
    ],
  };
  const profitabilityCard: DataCard = {
    title: "Profitability",
    subtitle: null,
    items: [
      point("Gross Margin", fin.grossMargin, (v) => `${(v * 100).toFixed(1)}%`),
      point("Operating Margin", fin.operatingMargin, (v) => `${(v * 100).toFixed(1)}%`),
      point("Net Margin", fin.netMargin, (v) => `${(v * 100).toFixed(1)}%`),
      point("ROE", fin.returnOnEquity, (v) => `${(v * 100).toFixed(1)}%`),
    ],
  };
  return [balanceCard, cashFlowCard, profitabilityCard];
}

function buildGrowthCards(growth: GrowthData): DataCard[] {
  const revenueCard: DataCard = {
    title: "Revenue Growth",
    subtitle: null,
    items: [
      point("Revenue YoY", growth.revenueGrowthYoY, (v) => `${v.toFixed(1)}%`),
      point("Revenue Fwd", growth.revenueGrowthForward, (v) => `${v.toFixed(1)}%`),
    ],
  };
  const earningsCard: DataCard = {
    title: "Earnings Growth",
    subtitle: null,
    items: [
      point("Earnings YoY", growth.earningsGrowthYoY, (v) => `${v.toFixed(1)}%`),
      point("Earnings Fwd", growth.earningsGrowthForward, (v) => `${v.toFixed(1)}%`),
      point("EBITDA Fwd", growth.ebitdaGrowthForward, (v) => `${v.toFixed(1)}%`),
    ],
  };
  const segmentsCard: DataCard = {
    title: "Segment Growth",
    subtitle: null,
    items:
      growth.segments.length > 0
        ? growth.segments.slice(0, 4).map((seg) => ({
            label: seg.name,
            value: `${seg.growthYoYPercent >= 0 ? "+" : ""}${seg.growthYoYPercent.toFixed(1)}%`,
            status: null,
            note: null,
          }))
        : [
            {
              label: "Segment data",
              value: NOT_AVAILABLE,
              status: null,
              note: null,
            },
          ],
  };
  return [revenueCard, earningsCard, segmentsCard];
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

function emptyKeyMetrics(): KeyMetrics {
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

function emptyFinancials(): Financials {
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

function emptyGrowth(): GrowthData {
  return {
    revenueGrowthYoY: 0,
    revenueGrowthForward: null,
    earningsGrowthYoY: null,
    earningsGrowthForward: null,
    ebitdaGrowthForward: null,
    segments: [],
  };
}

function emptyRiskScore(computedAt: string): RiskScore {
  return {
    composite: 0,
    rating: Rating.HOLD,
    ratingPosition: 0,
    riskLabel: NOT_AVAILABLE,
    strategy: "n/a",
    strategyVersion: "n/a",
    computedAt,
  };
}

function emptyScoreBreakdown(computedAt: string): ScoreBreakdown {
  return {
    components: [],
    composite: emptyRiskScore(computedAt),
  };
}

