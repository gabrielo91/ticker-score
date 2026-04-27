/**
 * Zod schemas for the Finnhub free-tier endpoints we adapt. Finnhub returns
 * tight, well-typed JSON, so the schemas mostly mirror the wire shape
 * directly. Optional fields stay
 * optional rather than nullable — Finnhub omits keys instead of nulling
 * them — and `.passthrough()` is applied so future field additions do not
 * break the adapter (Constitution C3 + package CONSTITUTION).
 *
 * Endpoints documented at https://finnhub.io/docs/api:
 *  - GET `/quote?symbol=...`                   — last price + day change
 *  - GET `/stock/profile2?symbol=...`          — company profile (free)
 *  - GET `/stock/metric?symbol=...&metric=all` — fundamentals + 52w range
 *  - GET `/stock/financials-reported?symbol=...&freq=quarterly`
 *                                              — SEC filings, by quarter
 */
import { z } from "zod";

export const FinnhubQuoteSchema = z
  .object({
    c: z.number(), // current price
    d: z.number().nullable().optional(), // change vs previous close
    dp: z.number().nullable().optional(), // change percent (already in %)
    h: z.number().optional(), // day high
    l: z.number().optional(), // day low
    o: z.number().optional(), // day open
    pc: z.number().optional(), // previous close
    t: z.number().optional(), // POSIX seconds timestamp
  })
  .passthrough();

export type FinnhubQuote = z.infer<typeof FinnhubQuoteSchema>;

export const FinnhubProfile2Schema = z
  .object({
    name: z.string().optional(),
    ticker: z.string().optional(),
    exchange: z.string().optional(),
    finnhubIndustry: z.string().optional(),
    currency: z.string().optional(),
    country: z.string().optional(),
    // Finnhub returns market cap in **millions** of `currency` units.
    marketCapitalization: z.number().nullable().optional(),
    shareOutstanding: z.number().nullable().optional(),
    weburl: z.string().optional(),
    logo: z.string().optional(),
    ipo: z.string().optional(),
  })
  .passthrough();

export type FinnhubProfile2 = z.infer<typeof FinnhubProfile2Schema>;

/**
 * `/stock/metric` returns a sprawling `metric` object whose key set varies
 * by ticker and Finnhub plan. We declare every field we read; everything
 * else is preserved by `.passthrough()` for forward-compat.
 */
const FinnhubMetricBlockSchema = z
  .object({
    peTTM: z.number().nullable().optional(),
    peNormalizedAnnual: z.number().nullable().optional(),
    psTTM: z.number().nullable().optional(),
    pbAnnual: z.number().nullable().optional(),
    pbQuarterly: z.number().nullable().optional(),
    pegRatio: z.number().nullable().optional(),
    "currentEv/freeCashFlowTTM": z.number().nullable().optional(),
    enterpriseValue: z.number().nullable().optional(),
    dividendYieldIndicatedAnnual: z.number().nullable().optional(),
    payoutRatioTTM: z.number().nullable().optional(),
    currentRatioAnnual: z.number().nullable().optional(),
    "totalDebt/totalEquityAnnual": z.number().nullable().optional(),
    roeTTM: z.number().nullable().optional(),
    roaTTM: z.number().nullable().optional(),
    grossMarginTTM: z.number().nullable().optional(),
    operatingMarginTTM: z.number().nullable().optional(),
    netProfitMarginTTM: z.number().nullable().optional(),
    epsTTM: z.number().nullable().optional(),
    revenueTTM: z.number().nullable().optional(),
    netIncomeCommonTTM: z.number().nullable().optional(),
    cashFlowPerShareTTM: z.number().nullable().optional(),
    "52WeekHigh": z.number().nullable().optional(),
    "52WeekLow": z.number().nullable().optional(),
    "10DayAverageTradingVolume": z.number().nullable().optional(),
    "3MonthAverageTradingVolume": z.number().nullable().optional(),
    ebitdaCagr5Y: z.number().nullable().optional(),
    "currentEv/EBITDA": z.number().nullable().optional(),
  })
  .passthrough();

export const FinnhubMetricResponseSchema = z
  .object({
    symbol: z.string().optional(),
    metricType: z.string().optional(),
    metric: FinnhubMetricBlockSchema.optional(),
  })
  .passthrough();

export type FinnhubMetricResponse = z.infer<typeof FinnhubMetricResponseSchema>;
export type FinnhubMetricBlock = z.infer<typeof FinnhubMetricBlockSchema>;

/**
 * `/stock/financials-reported` returns SEC filing line-items grouped into
 * `bs` (balance sheet), `cf` (cash flow), `ic` (income statement). Each
 * line carries `concept` (XBRL tag), `label`, `unit`, `value`. We keep the
 * shape generic and resolve concepts in `transforms.ts`.
 */
const FinnhubLineItemSchema = z
  .object({
    concept: z.string().optional(),
    label: z.string().optional(),
    unit: z.string().optional(),
    value: z.number().nullable().optional(),
  })
  .passthrough();

const FinnhubReportSchema = z
  .object({
    bs: z.array(FinnhubLineItemSchema).default([]),
    cf: z.array(FinnhubLineItemSchema).default([]),
    ic: z.array(FinnhubLineItemSchema).default([]),
  })
  .passthrough();

const FinnhubFinancialEntrySchema = z
  .object({
    symbol: z.string().optional(),
    year: z.number().int(),
    quarter: z.number().int().min(0).max(4),
    form: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    filedDate: z.string().optional(),
    acceptedDate: z.string().optional(),
    cik: z.string().optional(),
    report: FinnhubReportSchema,
  })
  .passthrough();

export const FinnhubFinancialsReportedSchema = z
  .object({
    symbol: z.string().optional(),
    cik: z.string().optional(),
    data: z.array(FinnhubFinancialEntrySchema).default([]),
  })
  .passthrough();

export type FinnhubFinancialsReported = z.infer<
  typeof FinnhubFinancialsReportedSchema
>;
export type FinnhubFinancialEntry = z.infer<typeof FinnhubFinancialEntrySchema>;
export type FinnhubLineItem = z.infer<typeof FinnhubLineItemSchema>;

