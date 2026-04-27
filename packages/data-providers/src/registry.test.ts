import { describe, expect, it } from "vitest";
import { ok, type DataProvider } from "@darkscore/types";
import { ProviderRegistry } from "./registry.js";

function stubProvider(name: string, priority: number): DataProvider {
  const notImpl = ok({} as never);
  return {
    name,
    priority,
    isAvailable: async () => true,
    getTickerInfo: async () => notImpl,
    getPriceHistory: async () => notImpl,
    getFinancials: async () => notImpl,
    getQuarterlyResults: async () => notImpl,
    getKeyMetrics: async () => notImpl,
  };
}

describe("ProviderRegistry", () => {
  it("returns providers sorted by ascending priority", () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider("c", 100));
    registry.register(stubProvider("a", 0));
    registry.register(stubProvider("b", 50));

    const ordered = registry.byPriority().map((p) => p.name);
    expect(ordered).toEqual(["a", "b", "c"]);
  });

  it("breaks priority ties by registration order", () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider("first", 10));
    registry.register(stubProvider("second", 10));
    registry.register(stubProvider("third", 10));

    expect(registry.byPriority().map((p) => p.name)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("looks up providers by name", () => {
    const registry = new ProviderRegistry();
    const primary = stubProvider("primary", 0);
    registry.register(primary);
    expect(registry.byName("primary")).toBe(primary);
    expect(registry.byName("missing")).toBeUndefined();
  });

  it("rejects duplicate names instead of silently overwriting", () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider("primary", 0));
    expect(() => registry.register(stubProvider("primary", 1))).toThrow(
      /already registered/u,
    );
  });

  it("reports size and list in insertion order", () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider("a", 5));
    registry.register(stubProvider("b", 1));
    expect(registry.size()).toBe(2);
    expect(registry.list().map((p) => p.name)).toEqual(["a", "b"]);
  });
});

