/**
 * Drift + behaviour guard for the narrative runtime (Spec 002, W4-4).
 * Covers env-driven provider selection and the cache-first `runNarrative`
 * orchestration helper. No real LLM calls — selection is verified by
 * inspecting the constructed provider's `name` / `model`, and the
 * orchestration paths use the in-process `MockNarrativeProvider` plus a
 * stub provider for the failure case.
 */
import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { CacheService, type CacheBackend } from "@darkscore/cache";
import {
  MockNarrativeProvider,
  OPENAI_DEFAULT_MODEL,
  OPENAI_PROVIDER_NAME,
} from "@darkscore/narrative";
import { createLogger } from "@darkscore/observability";
import {
  Rating,
  err,
  ok,
  type NarrativeData,
  type NarrativeInput,
  type NarrativeProvider,
  type Result,
} from "@darkscore/types";
import { buildNarrativeRuntime, runNarrative } from "./narrative-runtime";

function captureLogger(): {
  logger: ReturnType<typeof createLogger>;
  lines(): Array<Record<string, unknown>>;
} {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString("utf8"));
      cb();
    },
  });
  const logger = createLogger({ level: "trace", destination });
  return {
    logger,
    lines(): Array<Record<string, unknown>> {
      return chunks
        .join("")
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    },
  };
}

class MemoryBackend implements CacheBackend {
  readonly store = new Map<string, string>();
  async get(k: string): Promise<string | null> { return this.store.get(k) ?? null; }
  async set(k: string, v: string): Promise<"OK"> { this.store.set(k, v); return "OK"; }
  async del(...keys: string[]): Promise<number> {
    let n = 0; for (const k of keys) if (this.store.delete(k)) n++; return n;
  }
  async scan(): Promise<[string, string[]]> { return ["0", [...this.store.keys()]]; }
}

const NOW = "2026-04-27T00:00:00Z";
const RISK = {
  composite: 70, rating: Rating.BUY, ratingPosition: 1, riskLabel: "moderate",
  strategy: "editorial", strategyVersion: "1.0", computedAt: NOW,
} as const;

function buildInput(): NarrativeInput {
  return {
    ticker: {
      symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD",
      sector: null, industry: null, description: null,
      currentPrice: 200, priceChange: 1.5, priceChangePercent: 0.0075,
      week52High: 220, week52Low: 150, marketCap: null,
      volume: null, averageVolume: null,
    },
    riskScore: { ...RISK },
    scoreBreakdown: { components: [], composite: { ...RISK } },
    financials: {
      revenueTTM: 0, netIncomeTTM: 0, epsTTM: 0, cash: 0, totalDebt: 0,
      debtToEquity: null, currentRatio: null, operatingCashFlowTTM: 0,
      freeCashFlowTTM: 0, capexTTM: 0, grossMargin: 0, operatingMargin: 0,
      netMargin: 0, returnOnEquity: null, returnOnAssets: null, fiscalYear: 2026,
    },
    keyMetrics: {
      peRatioTTM: null, peRatioForward: null, priceToSales: null,
      priceToBook: null, evToEbitda: null, evToRevenue: null,
      pegRatio: null, dividendYield: null, payoutRatio: null,
    },
    quarterlyResults: [],
    priceHistory: [{ date: "2026-04-27", close: 200, open: null, high: null, low: null, volume: null }],
  };
}

describe("buildNarrativeRuntime — env-driven provider selection", () => {
  it("returns null provider for default and `none` selections", () => {
    expect(buildNarrativeRuntime({}).provider).toBeNull();
    expect(buildNarrativeRuntime({ NARRATIVE_PROVIDER: "none" }).provider).toBeNull();
  });

  it("returns null provider for openai without API key", () => {
    expect(buildNarrativeRuntime({ NARRATIVE_PROVIDER: "openai" }).provider).toBeNull();
    expect(
      buildNarrativeRuntime({ NARRATIVE_PROVIDER: "openai", OPENAI_API_KEY: "" }).provider,
    ).toBeNull();
  });

  it("constructs OpenAI provider with default model when key is set", () => {
    const { provider } = buildNarrativeRuntime({
      NARRATIVE_PROVIDER: "openai", OPENAI_API_KEY: "sk-test",
    });
    expect(provider?.name).toBe(OPENAI_PROVIDER_NAME);
    expect(provider?.model).toBe(OPENAI_DEFAULT_MODEL);
  });

  it("honours NARRATIVE_MODEL override", () => {
    const { provider } = buildNarrativeRuntime({
      NARRATIVE_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", NARRATIVE_MODEL: "gpt-4o",
    });
    expect(provider?.model).toBe("gpt-4o");
  });

  it("constructs the mock provider when selected", () => {
    const { provider } = buildNarrativeRuntime({ NARRATIVE_PROVIDER: "mock" });
    expect(provider).toBeInstanceOf(MockNarrativeProvider);
  });
});

describe("runNarrative — cache-first orchestration", () => {
  it("fails open when no provider is configured", async () => {
    const cache = new CacheService(new MemoryBackend());
    const out = await runNarrative(null, cache, buildInput());
    expect(out).toEqual({ narrative: null, narrativeAvailable: false });
  });

  it("calls provider on miss, writes back, then hits cache on the second call", async () => {
    const backend = new MemoryBackend();
    const cache = new CacheService(backend);
    const inner = new MockNarrativeProvider({ now: () => new Date(NOW) });
    let calls = 0;
    const wrapped: NarrativeProvider = {
      name: inner.name, model: inner.model,
      isAvailable: () => inner.isAvailable(),
      generate: (i) => { calls++; return inner.generate(i); },
    };
    const input = buildInput();

    const first = await runNarrative(wrapped, cache, input);
    expect(first.narrativeAvailable).toBe(true);
    expect(first.narrative?.providerName).toBe("mock");
    expect(calls).toBe(1);
    expect(backend.store.size).toBe(1);

    const second = await runNarrative(wrapped, cache, input);
    expect(second.narrativeAvailable).toBe(true);
    expect(calls).toBe(1);
  });

  it("fails open when the provider returns an error (no throw)", async () => {
    const cache = new CacheService(new MemoryBackend());
    const cap = captureLogger();
    const failing: NarrativeProvider = {
      name: "broken", model: "broken-1",
      isAvailable: async () => true,
      generate: async (): Promise<Result<NarrativeData>> => err(new Error("boom")),
    };
    const out = await runNarrative(failing, cache, buildInput(), cap.logger);
    expect(out).toEqual({ narrative: null, narrativeAvailable: false });
  });

  it("emits a structured warn with provider/ticker/code on fail-open", async () => {
    const cache = new CacheService(new MemoryBackend());
    const cap = captureLogger();
    const errorWithCode = Object.assign(new Error("quota"), { code: "RATE_LIMITED" });
    const failing: NarrativeProvider = {
      name: "openai", model: "gpt-4o",
      isAvailable: async () => true,
      generate: async (): Promise<Result<NarrativeData>> => err(errorWithCode),
    };
    await runNarrative(failing, cache, buildInput(), cap.logger);
    const warns = cap.lines().filter((l) => l["level"] === 40);
    expect(warns).toHaveLength(1);
    const [line] = warns;
    expect(line?.["msg"]).toBe("narrative provider failed open");
    expect(line?.["provider"]).toBe("openai");
    expect(line?.["model"]).toBe("gpt-4o");
    expect(line?.["ticker"]).toBe("AAPL");
    expect(line?.["code"]).toBe("RATE_LIMITED");
    expect(line?.["message"]).toBe("quota");
  });
});

