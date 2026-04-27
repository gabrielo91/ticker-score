import { describe, expect, it } from "vitest";
import {
  NARRATIVE_CACHE_NAMESPACE,
  buildNarrativeCacheKey,
  digestInput,
} from "./cache-key.js";
import { buildNarrativeInputFixture } from "./test-fixtures.js";

describe("buildNarrativeCacheKey", () => {
  it("produces a stable key for identical inputs", () => {
    const input = buildNarrativeInputFixture();
    const a = buildNarrativeCacheKey({ providerName: "openai", model: "gpt-x", input });
    const b = buildNarrativeCacheKey({ providerName: "openai", model: "gpt-x", input });
    expect(a).toBe(b);
  });

  it("includes namespace, provider, model, and ticker prefix", () => {
    const input = buildNarrativeInputFixture();
    const key = buildNarrativeCacheKey({
      providerName: "openai",
      model: "gpt-x",
      input,
    });
    expect(
      key.startsWith(`${NARRATIVE_CACHE_NAMESPACE}:openai:gpt-x:AAPL:`),
    ).toBe(true);
  });

  it("changes the digest when any input value changes", () => {
    const a = buildNarrativeCacheKey({
      providerName: "openai",
      model: "gpt-x",
      input: buildNarrativeInputFixture(),
    });
    const mutated = buildNarrativeInputFixture();
    const b = buildNarrativeCacheKey({
      providerName: "openai",
      model: "gpt-x",
      input: { ...mutated, ticker: { ...mutated.ticker, currentPrice: 999 } },
    });
    expect(a).not.toBe(b);
  });

  it("differs across providers and models for the same input", () => {
    const input = buildNarrativeInputFixture();
    const k1 = buildNarrativeCacheKey({ providerName: "openai", model: "gpt-x", input });
    const k2 = buildNarrativeCacheKey({ providerName: "anthropic", model: "gpt-x", input });
    const k3 = buildNarrativeCacheKey({ providerName: "openai", model: "gpt-y", input });
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });
});

describe("digestInput", () => {
  it("returns a 16-char lowercase hex digest", () => {
    const digest = digestInput(buildNarrativeInputFixture());
    expect(digest).toMatch(/^[0-9a-f]{16}$/u);
  });
});

