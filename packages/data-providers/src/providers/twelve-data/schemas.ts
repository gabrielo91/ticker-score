/**
 * Zod schemas for the Twelve Data REST endpoints we adapt. The free tier
 * (`Basic` plan, 800 calls/day, 8 calls/minute) covers every endpoint
 * referenced here — verified against `api.twelvedata.com` on 2026-04-26.
 *
 * Twelve Data returns numeric fields as **strings** (e.g. `"272.72500"`),
 * so each numeric schema accepts both `string` and `number` and the
 * transforms layer narrows to `number` once. Empty/missing values arrive as
 * `null`, omitted keys, or empty strings; the schemas make every
 * non-essential field optional + nullable so a missing data point
 * downgrades to `null` rather than failing validation. `.passthrough()` is
 * applied so future field additions never break the adapter (Constitution
 * C3 + package CONSTITUTION).
 *
 * Endpoints documented at https://twelvedata.com/docs:
 *  - GET `/quote?symbol=...`            — last price + day delta
 *  - GET `/profile?symbol=...`          — company profile
 *  - GET `/time_series?symbol=...&interval=1day&outputsize=...` — OHLCV
 *  - GET `/income_statement?symbol=...` — annual statements
 *  - GET `/balance_sheet?symbol=...`    — annual statements
 *  - GET `/statistics?symbol=...`       — fundamentals (PE, ROE, …)
 *
 * Twelve Data also returns `{ status: "error", code, message }` envelopes
 * with HTTP 200 on bad symbols / quota errors. The client surfaces those
 * as a `Result.err` before parsing, but `TwelveDataErrorSchema` is exported
 * so the client can recognise them without `any`.
 */
import { z } from "zod";

const numeric = z.union([z.string(), z.number()]).nullable().optional();

export const TwelveDataErrorSchema = z
  .object({
    status: z.literal("error"),
    code: z.number().int().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type TwelveDataError = z.infer<typeof TwelveDataErrorSchema>;

export const TwelveDataQuoteSchema = z
  .object({
    symbol: z.string().optional(),
    name: z.string().optional(),
    exchange: z.string().optional(),
    currency: z.string().optional(),
    open: numeric,
    high: numeric,
    low: numeric,
    close: numeric,
    previous_close: numeric,
    change: numeric,
    percent_change: numeric,
    volume: numeric,
    average_volume: numeric,
    fifty_two_week: z
      .object({ high: numeric, low: numeric })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export type TwelveDataQuote = z.infer<typeof TwelveDataQuoteSchema>;

export const TwelveDataProfileSchema = z
  .object({
    symbol: z.string().optional(),
    name: z.string().optional(),
    exchange: z.string().optional(),
    sector: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    employees: z.number().int().nullable().optional(),
    website: z.string().nullable().optional(),
    CEO: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })
  .passthrough();

export type TwelveDataProfile = z.infer<typeof TwelveDataProfileSchema>;

const TwelveDataCandleSchema = z
  .object({
    datetime: z.string(),
    open: numeric,
    high: numeric,
    low: numeric,
    close: numeric,
    volume: numeric,
  })
  .passthrough();

export const TwelveDataTimeSeriesSchema = z
  .object({
    meta: z
      .object({
        symbol: z.string().optional(),
        currency: z.string().optional(),
        interval: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    values: z.array(TwelveDataCandleSchema).default([]),
  })
  .passthrough();

export type TwelveDataTimeSeries = z.infer<typeof TwelveDataTimeSeriesSchema>;
export type TwelveDataCandle = z.infer<typeof TwelveDataCandleSchema>;

const TwelveDataIncomeStatementEntrySchema = z
  .object({
    fiscal_date: z.string(),
    sales: numeric,
    cost_of_goods: numeric,
    gross_profit: numeric,
    operating_expense: z
      .object({
        research_and_development: numeric,
        selling_general_and_administrative: numeric,
      })
      .partial()
      .passthrough()
      .optional(),
    operating_income: numeric,
    net_income: numeric,
    eps_basic: numeric,
    eps_diluted: numeric,
    ebit: numeric,
    ebitda: numeric,
  })
  .passthrough();

export const TwelveDataIncomeStatementSchema = z
  .object({
    income_statement: z.array(TwelveDataIncomeStatementEntrySchema).default([]),
  })
  .passthrough();

export type TwelveDataIncomeStatement = z.infer<
  typeof TwelveDataIncomeStatementSchema
>;
export type TwelveDataIncomeStatementEntry = z.infer<
  typeof TwelveDataIncomeStatementEntrySchema
>;

const TwelveDataBalanceSheetEntrySchema = z
  .object({
    fiscal_date: z.string(),
    assets: z
      .object({
        current_assets: z
          .object({ total_current_assets: numeric, cash_and_cash_equivalents: numeric })
          .partial()
          .passthrough()
          .optional(),
        non_current_assets: z
          .object({ total_non_current_assets: numeric })
          .partial()
          .passthrough()
          .optional(),
        total_assets: numeric,
      })
      .partial()
      .passthrough()
      .optional(),
    liabilities: z
      .object({
        current_liabilities: z
          .object({ total_current_liabilities: numeric, current_debt: numeric })
          .partial()
          .passthrough()
          .optional(),
        non_current_liabilities: z
          .object({ total_non_current_liabilities: numeric, long_term_debt: numeric })
          .partial()
          .passthrough()
          .optional(),
        total_liabilities: numeric,
      })
      .partial()
      .passthrough()
      .optional(),
    shareholders_equity: z
      .object({ total_shareholders_equity: numeric })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export const TwelveDataBalanceSheetSchema = z
  .object({
    balance_sheet: z.array(TwelveDataBalanceSheetEntrySchema).default([]),
  })
  .passthrough();

export type TwelveDataBalanceSheet = z.infer<typeof TwelveDataBalanceSheetSchema>;
export type TwelveDataBalanceSheetEntry = z.infer<
  typeof TwelveDataBalanceSheetEntrySchema
>;

export const TwelveDataStatisticsSchema = z
  .object({
    statistics: z
      .object({
        valuations_metrics: z
          .object({
            market_capitalization: numeric,
            trailing_pe: numeric,
            forward_pe: numeric,
            peg_ratio: numeric,
            price_to_sales_ttm: numeric,
            price_to_book_mrq: numeric,
            enterprise_value: numeric,
            enterprise_to_revenue: numeric,
            enterprise_to_ebitda: numeric,
          })
          .partial()
          .passthrough()
          .optional(),
        financials: z
          .object({
            most_recent_quarter: z.string().nullable().optional(),
            profit_margin: numeric,
            operating_margin: numeric,
            return_on_assets_ttm: numeric,
            return_on_equity_ttm: numeric,
            income_statement: z
              .object({
                revenue_ttm: numeric,
                revenue_per_share_ttm: numeric,
                quarterly_revenue_growth: numeric,
                gross_profit_ttm: numeric,
                ebitda: numeric,
                net_income_to_common_ttm: numeric,
                diluted_eps_ttm: numeric,
                quarterly_earnings_growth_yoy: numeric,
              })
              .partial()
              .passthrough()
              .optional(),
            balance_sheet: z
              .object({
                total_cash_mrq: numeric,
                total_cash_per_share_mrq: numeric,
                total_debt_mrq: numeric,
                total_debt_to_equity_mrq: numeric,
                current_ratio_mrq: numeric,
                book_value_per_share_mrq: numeric,
              })
              .partial()
              .passthrough()
              .optional(),
            cash_flow: z
              .object({
                operating_cash_flow_ttm: numeric,
                levered_free_cash_flow_ttm: numeric,
              })
              .partial()
              .passthrough()
              .optional(),
          })
          .partial()
          .passthrough()
          .optional(),
        dividends_and_splits: z
          .object({
            forward_annual_dividend_yield: numeric,
            trailing_annual_dividend_yield: numeric,
            payout_ratio: numeric,
          })
          .partial()
          .passthrough()
          .optional(),
        stock_price_summary: z
          .object({
            fifty_two_week_high: numeric,
            fifty_two_week_low: numeric,
            day_average_volume_10d: numeric,
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export type TwelveDataStatistics = z.infer<typeof TwelveDataStatisticsSchema>;


