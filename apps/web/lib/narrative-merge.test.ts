/**
 * Behaviour guard for the narrative → ReportData merge (Spec 002, W4-5).
 * Covers all five UI surfaces wired by the merge.
 */
import { describe, expect, it } from "vitest";
import { Rating, type NarrativeData, type ReportData } from "@darkscore/types";
import { mergeNarrativeIntoReport } from "./narrative-merge";

const NOW = "2026-04-27T00:00:00Z";

function buildBaseReport(): ReportData {
  const risk = {
    composite: 70,
    rating: Rating.BUY,
    ratingPosition: 1,
    riskLabel: "moderate",
    strategy: "editorial",
    strategyVersion: "1.0",
    computedAt: NOW,
  } as const;
  return {
    ticker: {
      symbol: "AAPL", name: "Apple Inc.", sector: null, industry: null,
      exchange: "NASDAQ", description: null, currency: "USD",
      currentPrice: 200, priceChange: 1.5, priceChangePercent: 0.0075,
      week52High: 220, week52Low: 150, marketCap: null,
      volume: null, averageVolume: null,
    },
    priceChart: {
      points: [{ date: "2026-04-27", close: 200, open: null, high: null, low: null, volume: null }],
      annotations: [],
    },
    kpiStrip: [],
    valuationCards: [{ title: "Valuation", subtitle: null, items: [] }],
    financialHealthCards: [{ title: "Financial Health", subtitle: null, items: [] }],
    growthCards: [{ title: "Growth", subtitle: null, items: [] }],
    financials: {
      revenueTTM: 0, netIncomeTTM: 0, epsTTM: 0, cash: 0, totalDebt: 0,
      debtToEquity: null, currentRatio: null, operatingCashFlowTTM: 0,
      freeCashFlowTTM: 0, capexTTM: 0, grossMargin: 0, operatingMargin: 0,
      netMargin: 0, returnOnEquity: null, returnOnAssets: null, fiscalYear: 2026,
    },
    keyMetrics: {
      peRatioTTM: null, peRatioForward: null, priceToSales: null,
      priceToBook: null, evToEbitda: null, evToRevenue: null,
      pegRatio: null, dividendYield: null, payoutRatio: null,
    },
    growth: {
      revenueGrowthYoY: 0, revenueGrowthForward: null, earningsGrowthYoY: null,
      earningsGrowthForward: null, ebitdaGrowthForward: null, segments: [],
    },
    quarterlyResults: [],
    scoreBreakdown: { components: [], composite: { ...risk } },
    riskScore: { ...risk },
    latestEarnings: { quarter: "n/a", reportedAt: "n/a", highlights: [], upcoming: null },
    catalysts: [],
    risks: [],
    verdict: { summary: "spec-001 summary", priceTargets: { bear: 170, base: 200, bull: 240 } },
    generatedAt: NOW,
    dataAsOf: NOW,
    notFinancialAdvice: true,
    fundamentalsAvailable: true,
    narrative: null,
    narrativeAvailable: false,
  };
}

function buildNarrative(overrides: Partial<NarrativeData> = {}): NarrativeData {
  return {
    cardSubtitles: {
      valuationPe: "PE 28x vs 5y avg 25x",
      valuationEv: "EV/EBITDA stretched", valuationRelative: "above peers",
      healthBalance: "Net cash $50B, low leverage",
      healthCashFlow: "FCF margin 25%", healthProfitability: "ROE 50%",
      growthRevenue: "Services accelerating, +15% YoY",
      growthSegment: "iPhone flat", growthEarnings: "EPS +12%",
    },
    chartAnnotations: [
      { date: "2026-01-15", label: "52w high", kind: "high" },
      { date: "2025-09-10", label: "Q4 earnings", kind: "event" },
      { date: "2025-07-01", label: "52w low", kind: "low" },
    ],
    catalysts: ["AI tailwind", "Services margin expansion", "Buyback authorisation"],
    risks: ["China demand softness", "Regulatory scrutiny", "iPhone refresh cycle"],
    priceTargets: { bear: 180, base: 220, bull: 260 },
    verdict: { headline: "Quality compounder at full valuation", paragraph: "Apple's services growth offsets hardware maturity." },
    disclaimer: "Educational analysis only. Not investment advice.",
    forwardEstimates: null,
    providerName: "openai",
    model: "gpt-4o-mini",
    generatedAt: NOW,
    ...overrides,
  };
}

describe("mergeNarrativeIntoReport", () => {
  it("populates catalysts and risks from the narrative", () => {
    const merged = mergeNarrativeIntoReport(buildBaseReport(), buildNarrative());
    expect(merged.catalysts).toEqual([
      "AI tailwind", "Services margin expansion", "Buyback authorisation",
    ]);
    expect(merged.risks).toEqual([
      "China demand softness", "Regulatory scrutiny", "iPhone refresh cycle",
    ]);
  });

  it("maps chart annotations: high→green, low→red, event→blue (preserving date+label)", () => {
    const merged = mergeNarrativeIntoReport(buildBaseReport(), buildNarrative());
    expect(merged.priceChart.annotations).toEqual([
      { date: "2026-01-15", label: "52w high", status: "green" },
      { date: "2025-09-10", label: "Q4 earnings", status: "blue" },
      { date: "2025-07-01", label: "52w low", status: "red" },
    ]);
    expect(merged.priceChart.points).toEqual(buildBaseReport().priceChart.points);
  });

  it("overrides verdict summary and price targets", () => {
    const merged = mergeNarrativeIntoReport(buildBaseReport(), buildNarrative());
    expect(merged.verdict.summary).toBe(
      "Apple's services growth offsets hardware maturity.",
    );
    expect(merged.verdict.priceTargets).toEqual({ bear: 180, base: 220, bull: 260 });
  });

  it("applies the primary subtitle to each category's first card", () => {
    const merged = mergeNarrativeIntoReport(buildBaseReport(), buildNarrative());
    expect(merged.valuationCards[0]?.subtitle).toBe("PE 28x vs 5y avg 25x");
    expect(merged.financialHealthCards[0]?.subtitle).toBe("Net cash $50B, low leverage");
    expect(merged.growthCards[0]?.subtitle).toBe("Services accelerating, +15% YoY");
  });

  it("leaves card subtitle untouched when narrative supplies null", () => {
    const base = buildBaseReport();
    const narrative = buildNarrative({
      cardSubtitles: { ...buildNarrative().cardSubtitles, valuationPe: null },
    });
    const merged = mergeNarrativeIntoReport(base, narrative);
    expect(merged.valuationCards[0]?.subtitle).toBeNull();
  });

  it("does not mutate the input report or narrative", () => {
    const base = buildBaseReport();
    const narrative = buildNarrative();
    const baseSnapshot = structuredClone(base);
    const narrativeSnapshot = structuredClone(narrative);
    mergeNarrativeIntoReport(base, narrative);
    expect(base).toEqual(baseSnapshot);
    expect(narrative).toEqual(narrativeSnapshot);
  });
});

