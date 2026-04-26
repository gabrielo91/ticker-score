/**
 * `ProviderRegistry` — holds the set of registered `DataProvider` instances
 * and exposes them in priority order so the aggregator can iterate the
 * fallback chain (Constitution C1 + the L3 data-providers diagram).
 *
 * Lower `priority` numbers win first (priority 0 is tried before priority
 * 10). Names are unique; re-registering an existing name throws
 * synchronously at boot time — this is configuration, not an I/O path,
 * so a thrown error is the appropriate signal (Constitution C5 only
 * requires Result types across runtime boundaries, not constructors).
 */
import type { DataProvider } from "@darkscore/types";
import type { ProviderRegistryView } from "./interface.js";

export class ProviderRegistry implements ProviderRegistryView {
  private readonly providers = new Map<string, DataProvider>();

  /**
   * Register a provider. Throws `RangeError` if a provider with the same
   * `name` is already registered — silent overwrites would mask config
   * mistakes that are hard to diagnose later.
   */
  register(provider: DataProvider): this {
    if (this.providers.has(provider.name)) {
      throw new RangeError(
        `ProviderRegistry: provider "${provider.name}" is already registered`,
      );
    }
    this.providers.set(provider.name, provider);
    return this;
  }

  /** All registered providers in insertion order. */
  list(): ReadonlyArray<DataProvider> {
    return [...this.providers.values()];
  }

  /**
   * Providers sorted by ascending `priority`. Ties are broken by
   * registration order so the configuration is reproducible.
   */
  byPriority(): ReadonlyArray<DataProvider> {
    const indexed = [...this.providers.values()].map((p, i) => ({ p, i }));
    indexed.sort((a, b) => {
      if (a.p.priority !== b.p.priority) return a.p.priority - b.p.priority;
      return a.i - b.i;
    });
    return indexed.map((entry) => entry.p);
  }

  byName(name: string): DataProvider | undefined {
    return this.providers.get(name);
  }

  size(): number {
    return this.providers.size;
  }
}

