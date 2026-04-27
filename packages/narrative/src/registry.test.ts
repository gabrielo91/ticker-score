import { describe, expect, it } from "vitest";
import { ok, type NarrativeProvider } from "@darkscore/types";
import { NarrativeRegistry } from "./registry.js";

function stubProvider(name: string, model = "test-1"): NarrativeProvider {
  return {
    name,
    model,
    isAvailable: async () => true,
    generate: async () => ok({} as never),
  };
}

describe("NarrativeRegistry", () => {
  it("looks up providers by name", () => {
    const registry = new NarrativeRegistry();
    const primary = stubProvider("openai");
    registry.register(primary);
    expect(registry.byName("openai")).toBe(primary);
    expect(registry.byName("missing")).toBeUndefined();
  });

  it("rejects duplicate names instead of silently overwriting", () => {
    const registry = new NarrativeRegistry();
    registry.register(stubProvider("openai"));
    expect(() => registry.register(stubProvider("openai"))).toThrow(
      /already registered/u,
    );
  });

  it("reports size and list in insertion order", () => {
    const registry = new NarrativeRegistry();
    registry.register(stubProvider("a"));
    registry.register(stubProvider("b"));
    expect(registry.size()).toBe(2);
    expect(registry.list().map((p) => p.name)).toEqual(["a", "b"]);
  });
});

