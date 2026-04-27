/**
 * Zod schemas for the Yahoo Finance JSON shapes the adapter consumes.
 * Yahoo's responses are large and unstable — schemas validate the fields
 * we read and pass everything else through untouched (`.passthrough()`),
 * so a benign upstream addition does not break the adapter.
 *
 * Yahoo wraps numeric fields in `{ raw, fmt, longFmt }` envelopes.
 * `RawNumberSchema` accepts that envelope, a bare number, or `{}` (Yahoo's
 * "no value" representation), and resolves to `number | null`.
 *
 * Trust boundary: every Yahoo response MUST be parsed through these
 * schemas before reaching `transforms.ts` (Constitution C3 + the package
 * CONSTITUTION).
 */
import { z } from "zod";

const NumberEnvelopeSchema = z
  .object({
    raw: z.number().finite().optional(),
    fmt: z.string().optional(),
    longFmt: z.string().optional(),
  })
  .passthrough();

export const RawNumberSchema = z
  .union([z.number().finite(), NumberEnvelopeSchema, z.object({}).strict()])
  .transform((value): number | null => {
    if (typeof value === "number") return value;
    if ("raw" in value && typeof value.raw === "number") return value.raw;
    return null;
  });

const QuoteSummaryPriceSchema = z
  .object({
    longName: z.string().nullable().optional(),
    shortName: z.string().nullable().optional(),
    symbol: z.string().optional(),
    exchangeName: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    regularMarketPrice: RawNumberSchema.optional(),
    regularMarketChange: RawNumberSchema.optional(),
    regularMarketChangePercent: RawNumberSchema.optional(),
    marketCap: RawNumberSchema.optional(),
    regularMarketVolume: RawNumberSchema.optional(),
    averageDailyVolume3Month: RawNumberSchema.optional(),
  })
  .passthrough();

const QuoteSummaryDetailSchema = z
  .object({
    fiftyTwoWeekHigh: RawNumberSchema.optional(),
    fiftyTwoWeekLow: RawNumberSchema.optional(),
    trailingPE: RawNumberSchema.optional(),
    forwardPE: RawNumberSchema.optional(),
    priceToSalesTrailing12Months: RawNumberSchema.optional(),
    dividendYield: RawNumberSchema.optional(),
    payoutRatio: RawNumberSchema.optional(),
  })
  .passthrough();

const QuoteSummaryAssetProfileSchema = z
  .object({
    sector: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    longBusinessSummary: z.string().nullable().optional(),
  })
  .passthrough();

const QuoteSummaryFinancialDataSchema = z
  .object({
    totalRevenue: RawNumberSchema.optional(),
    grossMargins: RawNumberSchema.optional(),
    operatingMargins: RawNumberSchema.optional(),
    profitMargins: RawNumberSchema.optional(),
    returnOnEquity: RawNumberSchema.optional(),
    returnOnAssets: RawNumberSchema.optional(),
    debtToEquity: RawNumberSchema.optional(),
    currentRatio: RawNumberSchema.optional(),
    totalCash: RawNumberSchema.optional(),
    totalDebt: RawNumberSchema.optional(),
    operatingCashflow: RawNumberSchema.optional(),
    freeCashflow: RawNumberSchema.optional(),
    capitalExpenditures: RawNumberSchema.optional(),
    revenueGrowth: RawNumberSchema.optional(),
    earningsGrowth: RawNumberSchema.optional(),
  })
  .passthrough();

const QuoteSummaryDefaultKeyStatisticsSchema = z
  .object({
    trailingEps: RawNumberSchema.optional(),
    forwardEps: RawNumberSchema.optional(),
    priceToBook: RawNumberSchema.optional(),
    enterpriseToEbitda: RawNumberSchema.optional(),
    enterpriseToRevenue: RawNumberSchema.optional(),
    pegRatio: RawNumberSchema.optional(),
    netIncomeToCommon: RawNumberSchema.optional(),
    lastFiscalYearEnd: RawNumberSchema.optional(),
  })
  .passthrough();

const IncomeStatementRowSchema = z
  .object({
    endDate: RawNumberSchema.optional(),
    totalRevenue: RawNumberSchema.optional(),
    operatingIncome: RawNumberSchema.optional(),
    netIncome: RawNumberSchema.optional(),
  })
  .passthrough();

const IncomeStatementHistorySchema = z
  .object({
    incomeStatementHistory: z.array(IncomeStatementRowSchema).default([]),
  })
  .passthrough();

const QuoteSummaryResultSchema = z
  .object({
    price: QuoteSummaryPriceSchema.optional(),
    summaryDetail: QuoteSummaryDetailSchema.optional(),
    assetProfile: QuoteSummaryAssetProfileSchema.optional(),
    financialData: QuoteSummaryFinancialDataSchema.optional(),
    defaultKeyStatistics: QuoteSummaryDefaultKeyStatisticsSchema.optional(),
    incomeStatementHistory: IncomeStatementHistorySchema.optional(),
    incomeStatementHistoryQuarterly: IncomeStatementHistorySchema.optional(),
  })
  .passthrough();

export const QuoteSummaryResponseSchema = z
  .object({
    quoteSummary: z
      .object({
        result: z.array(QuoteSummaryResultSchema).nullable(),
        error: z
          .object({
            code: z.string().optional(),
            description: z.string().optional(),
          })
          .nullable()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type QuoteSummaryResponse = z.infer<typeof QuoteSummaryResponseSchema>;
export type QuoteSummaryResult = z.infer<typeof QuoteSummaryResultSchema>;
export type IncomeStatementRow = z.infer<typeof IncomeStatementRowSchema>;

const ChartIndicatorsQuoteSchema = z
  .object({
    open: z.array(z.number().nullable()).default([]),
    high: z.array(z.number().nullable()).default([]),
    low: z.array(z.number().nullable()).default([]),
    close: z.array(z.number().nullable()).default([]),
    volume: z.array(z.number().nullable()).default([]),
  })
  .passthrough();

const ChartResultSchema = z
  .object({
    meta: z
      .object({
        symbol: z.string().optional(),
        currency: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    timestamp: z.array(z.number()).default([]),
    indicators: z
      .object({
        quote: z.array(ChartIndicatorsQuoteSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const ChartResponseSchema = z
  .object({
    chart: z
      .object({
        result: z.array(ChartResultSchema).nullable(),
        error: z
          .object({
            code: z.string().optional(),
            description: z.string().optional(),
          })
          .nullable()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ChartResponse = z.infer<typeof ChartResponseSchema>;
export type ChartResult = z.infer<typeof ChartResultSchema>;

