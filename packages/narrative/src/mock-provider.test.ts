import { describe, expect, it } from "vitest";
import { NarrativeDataSchema } from "@darkscore/types";
import { MockNarrativeProvider } from "./mock-provider.js";
import { buildNarrativeInputFixture } from "./test-fixtures.js";

describe("MockNarrativeProvider", () => {
  it("reports availability and identity", async () => {
    const p = new MockNarrativeProvider();
    expect(p.name).toBe("mock");
    expect(p.model).toBe("mock-1");
    expect(await p.isAvailable()).toBe(true);
  });

  it("returns Zod-valid NarrativeData with provider metadata", async () => {
    const p = new MockNarrativeProvider({
      now: () => new Date("2026-04-27T12:00:00.000Z"),
    });
    const result = await p.generate(buildNarrativeInputFixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => NarrativeDataSchema.parse(result.data)).not.toThrow();
    expect(result.data.providerName).toBe("mock");
    expect(result.data.model).toBe("mock-1");
    expect(result.data.generatedAt).toBe("2026-04-27T12:00:00.000Z");
    expect(result.data.priceTargets.bear).toBeLessThanOrEqual(
      result.data.priceTargets.base,
    );
    expect(result.data.priceTargets.base).toBeLessThanOrEqual(
      result.data.priceTargets.bull,
    );
  });

  it("respects custom name and model overrides", async () => {
    const p = new MockNarrativeProvider({ name: "custom", model: "v2" });
    const result = await p.generate(buildNarrativeInputFixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.providerName).toBe("custom");
    expect(result.data.model).toBe("v2");
  });
});

