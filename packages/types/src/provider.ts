/**
 * Data provider contract (Constitution C1 — every external data source is
 * accessed through this interface). The interface itself is TS-only; the
 * `ProviderConfig` shape that configures a provider has a Zod schema because
 * it crosses the configuration boundary.
 */
import { z } from "zod";
import type { Result } from "./result.js";
import type { TickerInfo, PricePoint, TickerSymbol } from "./ticker.js";
import type {
  Financials,
  KeyMetrics,
  QuarterlyResult,
} from "./financials.js";

export interface DataProvider {
  readonly name: string;
  readonly priority: number;

  isAvailable(): Promise<boolean>;

  getTickerInfo(symbol: TickerSymbol): Promise<Result<TickerInfo>>;
  getPriceHistory(
    symbol: TickerSymbol,
    months: number,
  ): Promise<Result<PricePoint[]>>;
  getFinancials(symbol: TickerSymbol): Promise<Result<Financials>>;
  getQuarterlyResults(
    symbol: TickerSymbol,
    quarters: number,
  ): Promise<Result<QuarterlyResult[]>>;
  getKeyMetrics(symbol: TickerSymbol): Promise<Result<KeyMetrics>>;
}

export const ProviderConfigSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().nonnegative(),
  baseUrl: z.string().url().nullable(),
  apiKey: z.string().nullable(),
  timeoutMs: z.number().int().positive(),
  enabled: z.boolean(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

