/**
 * Alpha Vantage provider — stub. Listed in the L1 diagram as a future
 * provider; the spec calls for a registry-ready placeholder so the
 * adapter pattern can be exercised before the real client lands.
 *
 * Per the package CONSTITUTION every public method returns `Result.err`
 * with a "not implemented" message — never throws across the boundary.
 */
import {
  err,
  type DataProvider,
  type Financials,
  type KeyMetrics,
  type PricePoint,
  type QuarterlyResult,
  type Result,
  type TickerInfo,
  type TickerSymbol,
} from "@darkscore/types";

export const ALPHA_VANTAGE_PROVIDER_NAME = "alpha-vantage";
export const ALPHA_VANTAGE_DEFAULT_PRIORITY = 100;

export interface AlphaVantageProviderOptions {
  readonly priority?: number;
  readonly apiKey?: string;
}

const NOT_IMPLEMENTED = new Error(
  "AlphaVantageProvider: not implemented (stub)",
);

export class AlphaVantageProvider implements DataProvider {
  readonly name = ALPHA_VANTAGE_PROVIDER_NAME;
  readonly priority: number;

  constructor(options: AlphaVantageProviderOptions = {}) {
    this.priority = options.priority ?? ALPHA_VANTAGE_DEFAULT_PRIORITY;
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  getTickerInfo(_symbol: TickerSymbol): Promise<Result<TickerInfo>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  getPriceHistory(
    _symbol: TickerSymbol,
    _months: number,
  ): Promise<Result<PricePoint[]>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  getFinancials(_symbol: TickerSymbol): Promise<Result<Financials>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  getQuarterlyResults(
    _symbol: TickerSymbol,
    _quarters: number,
  ): Promise<Result<QuarterlyResult[]>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  getKeyMetrics(_symbol: TickerSymbol): Promise<Result<KeyMetrics>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }
}

export function createAlphaVantageProvider(
  options: AlphaVantageProviderOptions = {},
): AlphaVantageProvider {
  return new AlphaVantageProvider(options);
}

