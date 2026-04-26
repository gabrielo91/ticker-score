/**
 * Public adapter contract for the data-providers package. The
 * `DataProvider` interface itself lives in `@darkscore/types` (Constitution
 * C1 — every external data source is accessed through this single contract).
 * It is re-exported here so consumers of `@darkscore/data-providers` get the
 * full surface from one entry point and don't reach into `@darkscore/types`
 * just for an interface symbol.
 */
export type { DataProvider, ProviderConfig } from "@darkscore/types";
export { ProviderConfigSchema } from "@darkscore/types";

import type { DataProvider } from "@darkscore/types";

/**
 * Read-only view of the provider registry consumed by `DataAggregator`.
 * The mutable surface lives on the concrete `ProviderRegistry` class so
 * registration can't happen behind the aggregator's back at runtime.
 */
export interface ProviderRegistryView {
  list(): ReadonlyArray<DataProvider>;
  byPriority(): ReadonlyArray<DataProvider>;
  byName(name: string): DataProvider | undefined;
  size(): number;
}

