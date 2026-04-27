/**
 * @darkscore/data-providers — public surface. Named exports only (per
 * package CONSTITUTION). Importers should depend on this entry point so
 * the boundary checker can verify cross-package usage.
 */
export const PACKAGE_NAME = "@darkscore/data-providers";

export {
  type DataProvider,
  type ProviderConfig,
  type ProviderRegistryView,
  ProviderConfigSchema,
} from "./interface.js";

export { ProviderRegistry } from "./registry.js";

export {
  DataAggregator,
  type DataAggregatorOptions,
} from "./aggregator.js";

export {
  YahooFinanceProvider,
  YAHOO_DEFAULT_PRIORITY,
  YAHOO_PROVIDER_NAME,
  createYahooProvider,
  type YahooFinanceProviderOptions,
} from "./providers/yahoo/index.js";

export {
  YahooClient,
  RateLimiter,
  type YahooClientOptions,
} from "./providers/yahoo/client.js";

export {
  CachedSessionStore,
  InMemorySessionStore,
  DEFAULT_SESSION_TTL_SECONDS,
  type SessionStore,
  type YahooSession,
} from "./providers/yahoo/session-store.js";

export {
  AlphaVantageProvider,
  ALPHA_VANTAGE_DEFAULT_PRIORITY,
  ALPHA_VANTAGE_PROVIDER_NAME,
  createAlphaVantageProvider,
  type AlphaVantageProviderOptions,
} from "./providers/alpha-vantage/index.js";

export {
  FinnhubProvider,
  FINNHUB_DEFAULT_PRIORITY,
  FINNHUB_PROVIDER_NAME,
  createFinnhubProvider,
  type FinnhubProviderOptions,
} from "./providers/finnhub/index.js";

export {
  FinnhubClient,
  type FinnhubClientOptions,
} from "./providers/finnhub/client.js";

