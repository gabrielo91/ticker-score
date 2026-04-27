/**
 * Zod schemas for the Alpha Vantage REST endpoints we adapt. Alpha Vantage
 * returns numbers as strings (e.g. `"PERatio": "28.45"`) so every numeric
 * field is parsed via `numericString()` which coerces to a number and
 * tolerates `"None"` / `"-"` / empty as `null`.
 *
 * Endpoints documented at https://www.alphavantage.co/documentation:
 *  - GET `?function=OVERVIEW&symbol=...`            — company profile + ratios
 *  - GET `?function=TIME_SERIES_DAILY&symbol=...`   — daily OHLCV history
 *  - GET `?function=INCOME_STATEMENT&symbol=...`    — annual + quarterly P&L
 *  - GET `?function=BALANCE_SHEET&symbol=...`       — annual + quarterly BS
 *  - GET `?function=EARNINGS&symbol=...`            — quarterly EPS actual+est
 *
 * Alpha Vantage replies with `200 OK` plus an envelope on error/throttle:
 *  - `{ "Error Message": "..." }`        — bad symbol / function
 *  - `{ "Note": "..." }`                  — per-minute throttle
 *  - `{ "Information": "..." }`           — daily quota exhausted
 * The client recognises these envelopes and surfaces them as `Result.err`
 * before schema parsing runs.
 */
import { z } from "zod";

const numericString = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = v.trim();
    if (s === "" || s === "-" || s.toLowerCase() === "none") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  });

const intString = numericString.transform((v) =>
  v === null ? null : Math.trunc(v),
);

export const AlphaVantageErrorSchema = z
  .object({
    "Error Message": z.string().optional(),
    Note: z.string().optional(),
    Information: z.string().optional(),
  })
  .passthrough();

export const AlphaVantageOverviewSchema = z
  .object({
    Symbol: z.string().optional(),
    AssetType: z.string().optional(),
    Name: z.string().optional(),
    Description: z.string().optional(),
    Exchange: z.string().optional(),
    Currency: z.string().optional(),
    Country: z.string().optional(),
    Sector: z.string().optional(),
    Industry: z.string().optional(),
    MarketCapitalization: numericString.optional(),
    EBITDA: numericString.optional(),
    PERatio: numericString.optional(),
    PEGRatio: numericString.optional(),
    BookValue: numericString.optional(),
    DividendYield: numericString.optional(),
    PayoutRatio: numericString.optional(),
    EPS: numericString.optional(),
    ProfitMargin: numericString.optional(),
    OperatingMarginTTM: numericString.optional(),
    ReturnOnAssetsTTM: numericString.optional(),
    ReturnOnEquityTTM: numericString.optional(),
    RevenueTTM: numericString.optional(),
    GrossProfitTTM: numericString.optional(),
    DilutedEPSTTM: numericString.optional(),
    QuarterlyEarningsGrowthYOY: numericString.optional(),
    QuarterlyRevenueGrowthYOY: numericString.optional(),
    AnalystTargetPrice: numericString.optional(),
    TrailingPE: numericString.optional(),
    ForwardPE: numericString.optional(),
    PriceToSalesRatioTTM: numericString.optional(),
    PriceToBookRatio: numericString.optional(),
    EVToRevenue: numericString.optional(),
    EVToEBITDA: numericString.optional(),
    Beta: numericString.optional(),
    "52WeekHigh": numericString.optional(),
    "52WeekLow": numericString.optional(),
    SharesOutstanding: numericString.optional(),
  })
  .passthrough();

export type AlphaVantageOverview = z.infer<typeof AlphaVantageOverviewSchema>;

const AlphaVantageDailyBarSchema = z
  .object({
    "1. open": numericString,
    "2. high": numericString,
    "3. low": numericString,
    "4. close": numericString,
    "5. volume": intString,
  })
  .passthrough();

export const AlphaVantageTimeSeriesDailySchema = z
  .object({
    "Meta Data": z.record(z.string(), z.string()).optional(),
    "Time Series (Daily)": z.record(z.string(), AlphaVantageDailyBarSchema),
  })
  .passthrough();

export type AlphaVantageTimeSeriesDaily = z.infer<
  typeof AlphaVantageTimeSeriesDailySchema
>;

const AlphaVantageIncomeReportSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedCurrency: z.string().optional(),
    totalRevenue: numericString.optional(),
    grossProfit: numericString.optional(),
    operatingIncome: numericString.optional(),
    netIncome: numericString.optional(),
    ebitda: numericString.optional(),
  })
  .passthrough();

export const AlphaVantageIncomeStatementSchema = z
  .object({
    symbol: z.string().optional(),
    annualReports: z.array(AlphaVantageIncomeReportSchema).default([]),
    quarterlyReports: z.array(AlphaVantageIncomeReportSchema).default([]),
  })
  .passthrough();

export type AlphaVantageIncomeStatement = z.infer<
  typeof AlphaVantageIncomeStatementSchema
>;

const AlphaVantageBalanceReportSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedCurrency: z.string().optional(),
    totalAssets: numericString.optional(),
    totalLiabilities: numericString.optional(),
    totalShareholderEquity: numericString.optional(),
    totalCurrentAssets: numericString.optional(),
    totalCurrentLiabilities: numericString.optional(),
    cashAndCashEquivalentsAtCarryingValue: numericString.optional(),
    cashAndShortTermInvestments: numericString.optional(),
    shortTermDebt: numericString.optional(),
    longTermDebt: numericString.optional(),
    longTermDebtNoncurrent: numericString.optional(),
    currentDebt: numericString.optional(),
  })
  .passthrough();

export const AlphaVantageBalanceSheetSchema = z
  .object({
    symbol: z.string().optional(),
    annualReports: z.array(AlphaVantageBalanceReportSchema).default([]),
    quarterlyReports: z.array(AlphaVantageBalanceReportSchema).default([]),
  })
  .passthrough();

export type AlphaVantageBalanceSheet = z.infer<
  typeof AlphaVantageBalanceSheetSchema
>;

const AlphaVantageQuarterEarningsSchema = z
  .object({
    fiscalDateEnding: z.string(),
    reportedDate: z.string().optional(),
    reportedEPS: numericString.optional(),
    estimatedEPS: numericString.optional(),
    surprise: numericString.optional(),
    surprisePercentage: numericString.optional(),
  })
  .passthrough();

export const AlphaVantageEarningsSchema = z
  .object({
    symbol: z.string().optional(),
    annualEarnings: z.array(z.object({}).passthrough()).optional(),
    quarterlyEarnings: z.array(AlphaVantageQuarterEarningsSchema).default([]),
  })
  .passthrough();

export type AlphaVantageEarnings = z.infer<typeof AlphaVantageEarningsSchema>;
export type AlphaVantageQuarterEarnings = z.infer<
  typeof AlphaVantageQuarterEarningsSchema
>;
export type AlphaVantageIncomeReport = z.infer<
  typeof AlphaVantageIncomeReportSchema
>;
export type AlphaVantageBalanceReport = z.infer<
  typeof AlphaVantageBalanceReportSchema
>;
export type AlphaVantageDailyBar = z.infer<typeof AlphaVantageDailyBarSchema>;

