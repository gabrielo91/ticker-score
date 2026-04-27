/**
 * `NarrativeRegistry` — holds the set of registered `NarrativeProvider`
 * instances. Mirrors `ProviderRegistry` in `@darkscore/data-providers` so
 * the orchestration shape is identical: register many, ask for the active
 * one by name (env-driven selection lives in `apps/web`).
 *
 * Names are unique; re-registering the same name throws synchronously at
 * boot time — silent overwrites would mask configuration mistakes that are
 * hard to diagnose later (Constitution C5 only requires `Result` across
 * runtime boundaries, not constructors).
 */
import type { NarrativeProvider } from "@darkscore/types";

export class NarrativeRegistry {
  private readonly providers = new Map<string, NarrativeProvider>();

  /**
   * Register a provider. Throws `RangeError` if a provider with the same
   * `name` is already registered.
   */
  register(provider: NarrativeProvider): this {
    if (this.providers.has(provider.name)) {
      throw new RangeError(
        `NarrativeRegistry: provider "${provider.name}" is already registered`,
      );
    }
    this.providers.set(provider.name, provider);
    return this;
  }

  /** All registered providers in insertion order. */
  list(): ReadonlyArray<NarrativeProvider> {
    return [...this.providers.values()];
  }

  byName(name: string): NarrativeProvider | undefined {
    return this.providers.get(name);
  }

  size(): number {
    return this.providers.size;
  }
}

