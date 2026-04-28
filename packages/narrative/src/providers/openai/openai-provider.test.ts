/**
 * Unit tests for OpenAINarrativeProvider. The transport is mocked via a
 * `fetch` stub so no network is touched. One scenario replays a recorded
 * model response from `fixtures/aapl-response.json` to lock the contract
 * with the actual API shape.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  NarrativeDataSchema,
  isErr,
  isOk,
} from "@darkscore/types";
import { NarrativeError } from "../../errors.js";
import { buildNarrativeInputFixture } from "../../test-fixtures.js";
import { OpenAIClient } from "./client.js";
import { OpenAINarrativeProvider } from "./index.js";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));
const RECORDED_AAPL_RESPONSE = readFileSync(
  join(FIXTURE_DIR, "fixtures", "aapl-response.json"),
  "utf8",
);

function buildClient(responseBody: string, status = 200): OpenAIClient {
  const fetchImpl = vi.fn<typeof fetch>(
    async () =>
      new Response(responseBody, {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  return new OpenAIClient({
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    fetchImpl,
  });
}

function buildProvider(responseBody: string, status = 200): OpenAINarrativeProvider {
  return new OpenAINarrativeProvider({
    apiKey: "sk-test",
    client: buildClient(responseBody, status),
    now: () => new Date("2026-04-27T12:00:00.000Z"),
  });
}

describe("OpenAINarrativeProvider", () => {
  it("exposes default name and model", () => {
    const p = new OpenAINarrativeProvider({ apiKey: "sk-test" });
    expect(p.name).toBe("openai");
    expect(p.model).toBe("gpt-4o-mini");
  });

  it("rejects construction without an API key", () => {
    expect(
      () =>
        new OpenAINarrativeProvider({ apiKey: "" } as unknown as { apiKey: string }),
    ).toThrow(/apiKey is required/u);
  });

  it("isAvailable returns true once configured", async () => {
    const p = new OpenAINarrativeProvider({ apiKey: "sk-test" });
    expect(await p.isAvailable()).toBe(true);
  });

  it("generate parses a recorded model response into NarrativeData", async () => {
    const p = buildProvider(RECORDED_AAPL_RESPONSE);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(() => NarrativeDataSchema.parse(r.data)).not.toThrow();
    expect(r.data.providerName).toBe("openai");
    expect(r.data.model).toBe("gpt-4o-mini");
    expect(r.data.generatedAt).toBe("2026-04-27T12:00:00.000Z");
    expect(r.data.catalysts.length).toBeGreaterThanOrEqual(3);
    expect(r.data.risks.length).toBeGreaterThanOrEqual(3);
    expect(r.data.priceTargets.bear).toBeLessThanOrEqual(r.data.priceTargets.base);
    expect(r.data.priceTargets.base).toBeLessThanOrEqual(r.data.priceTargets.bull);
    expect(r.data.disclaimer.length).toBeGreaterThan(0);
  });

  it("provider metadata always wins over any model-supplied audit fields", async () => {
    // Same recorded body, but ensure provider stamps its own provider/model/generatedAt.
    const p = new OpenAINarrativeProvider({
      apiKey: "sk-test",
      name: "custom-openai",
      model: "gpt-4o",
      client: buildClient(RECORDED_AAPL_RESPONSE),
      now: () => new Date("2030-01-01T00:00:00.000Z"),
    });
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.providerName).toBe("custom-openai");
    expect(r.data.model).toBe("gpt-4o");
    expect(r.data.generatedAt).toBe("2030-01-01T00:00:00.000Z");
  });

  it("returns NarrativeError(SCHEMA) when the model returns malformed JSON", async () => {
    const malformed = JSON.stringify({
      choices: [{ message: { role: "assistant", content: "not-json {{{" } }],
    });
    const p = buildProvider(malformed);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error).toBeInstanceOf(NarrativeError);
    if (!(r.error instanceof NarrativeError)) return;
    expect(r.error.code).toBe("SCHEMA");
    expect(r.error.providerName).toBe("openai");
  });

  it("returns NarrativeError(SCHEMA) when JSON shape fails NarrativeDataSchema", async () => {
    const wrongShape = JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            // Catalysts < 3 violates the schema's `.min(3)` constraint.
            content: JSON.stringify({ catalysts: ["only one"], risks: [] }),
          },
        },
      ],
    });
    const p = buildProvider(wrongShape);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error).toBeInstanceOf(NarrativeError);
    if (!(r.error instanceof NarrativeError)) return;
    expect(r.error.code).toBe("SCHEMA");
  });

  it("maps HTTP 401 to NarrativeError(NOT_CONFIGURED)", async () => {
    const p = buildProvider(JSON.stringify({ error: { message: "bad key" } }), 401);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    if (!(r.error instanceof NarrativeError)) return;
    expect(r.error.code).toBe("NOT_CONFIGURED");
  });

  it("maps HTTP 429 to NarrativeError(RATE_LIMITED)", async () => {
    const p = buildProvider(JSON.stringify({ error: { message: "slow down" } }), 429);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    if (!(r.error instanceof NarrativeError)) return;
    expect(r.error.code).toBe("RATE_LIMITED");
  });

  it("maps HTTP 500 to NarrativeError(TRANSPORT)", async () => {
    const p = buildProvider(JSON.stringify({ error: { message: "boom" } }), 500);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    if (!(r.error instanceof NarrativeError)) return;
    expect(r.error.code).toBe("TRANSPORT");
  });

  // W5-2: forward-estimate guardrails — temperature pinned, salvage on bad shape.

  it("pins temperature to 0 on the wire when the provider builds its own client (W5-2)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(RECORDED_AAPL_RESPONSE, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    // No `client` injected: the provider must build its own and pin
    // temperature to NARRATIVE_TEMPERATURE (0). This guards the
    // anti-hallucination contract for the production code path.
    const p = new OpenAINarrativeProvider({
      apiKey: "sk-test",
      fetchImpl,
      now: () => new Date("2026-04-27T12:00:00.000Z"),
    });
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1];
    const rawBody = typeof init?.body === "string" ? init.body : "{}";
    const wireBody = JSON.parse(rawBody) as { temperature?: number };
    expect(wireBody.temperature).toBe(0);
  });

  it("parses forwardEstimates from a valid recorded response", async () => {
    const p = buildProvider(RECORDED_AAPL_RESPONSE);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    const fwd = (r.data as { forwardEstimates: unknown }).forwardEstimates;
    expect(fwd).not.toBeNull();
    if (fwd === null || typeof fwd !== "object") return;
    const typed = fwd as { confidenceLevel: string; reasoning: string };
    expect(typed.confidenceLevel).toMatch(/^(high|medium|low)$/u);
    expect(typeof typed.reasoning).toBe("string");
    expect(typed.reasoning.length).toBeGreaterThan(0);
  });

  it("salvages forwardEstimates to null when the model omits the field", async () => {
    const inner = innerContent(RECORDED_AAPL_RESPONSE);
    delete inner.forwardEstimates;
    const p = buildProvider(envelope(inner));
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect((r.data as { forwardEstimates: unknown }).forwardEstimates).toBeNull();
  });

  // W6-1: catalyst/risk + optional-field salvage.

  it("normalizes catalysts returned as {text,basis} objects (W6-1)", async () => {
    const inner = innerContent(RECORDED_AAPL_RESPONSE);
    inner.catalysts = [
      { text: "Cloud +48% — fastest growth among hyperscalers", basis: "Q4 2025 earnings" },
      { text: "Backlog $240B (+55% QoQ)", basis: "Q4 2025 10-K" },
      { text: "Search resilience +14.5% YoY", basis: null },
    ];
    inner.risks = [
      { text: "DOJ antitrust — remedies pending", basis: "DOJ v. Google litigation" },
      { text: "EU $3.5B fine in Q3", basis: "EU Commission Sept 2024 decision" },
      { text: "$175B 2026 capex", basis: "management guidance" },
    ];
    const p = buildProvider(envelope(inner));
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.catalysts).toEqual([
      "Cloud +48% — fastest growth among hyperscalers",
      "Backlog $240B (+55% QoQ)",
      "Search resilience +14.5% YoY",
    ]);
    expect(r.data.catalystsDetailed).toEqual([
      { text: "Cloud +48% — fastest growth among hyperscalers", basis: "Q4 2025 earnings" },
      { text: "Backlog $240B (+55% QoQ)", basis: "Q4 2025 10-K" },
      { text: "Search resilience +14.5% YoY", basis: null },
    ]);
    expect(r.data.risksDetailed?.[0]?.basis).toBe("DOJ v. Google litigation");
  });

  it("leaves catalystsDetailed null when the model returned legacy string[] (W6-1)", async () => {
    const p = buildProvider(RECORDED_AAPL_RESPONSE);
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(Array.isArray(r.data.catalysts)).toBe(true);
    expect(r.data.catalystsDetailed ?? null).toBeNull();
    expect(r.data.risksDetailed ?? null).toBeNull();
  });

  it("salvages optional W6-1 fields to null when malformed", async () => {
    const inner = innerContent(RECORDED_AAPL_RESPONSE);
    inner.earningsContext = { headline: "Q4", beats: "not-an-array" };
    inner.segments = [{ name: "Cloud" }];
    const p = buildProvider(envelope(inner));
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.earningsContext ?? null).toBeNull();
    expect(r.data.segments ?? null).toBeNull();
  });

  it("preserves valid W6-1 optional fields end-to-end", async () => {
    const inner = innerContent(RECORDED_AAPL_RESPONSE);
    inner.companyOverview = "Apple designs and sells consumer electronics, services, and wearables.";
    inner.recentDevelopments = ["WWDC 2025", "Vision Pro launch", "Q1 2026 beat"];
    inner.quarterlyInsight = "Revenue trend stable with margin expansion through services mix.";
    inner.earningsContext = {
      headline: "Q1 2026: Revenue $100B (+5%) — beat",
      beats: ["Services +15%"],
      misses: ["iPhone -2%"],
      guidance: null,
    };
    inner.segments = [
      { name: "Services", insight: "Highest-margin growth driver." },
      { name: "iPhone", insight: "Hardware refresh cycle approaching." },
    ];
    const v = inner.verdict as Record<string, unknown>;
    v.bottomLine = "Buy the services compounder.";
    const p = buildProvider(envelope(inner));
    const r = await p.generate(buildNarrativeInputFixture());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.data.companyOverview).toContain("Apple");
    expect(r.data.recentDevelopments?.length).toBe(3);
    expect(r.data.quarterlyInsight).toBeTruthy();
    expect(r.data.earningsContext?.headline).toContain("Q1 2026");
    expect(r.data.segments?.length).toBe(2);
    expect(r.data.verdict.bottomLine).toBe("Buy the services compounder.");
  });

  it("salvages forwardEstimates to null when the model returns a malformed object", async () => {
    const inner = innerContent(RECORDED_AAPL_RESPONSE);
    // Confidence must be an enum, "definitely" is invalid → ForwardEstimatesSchema rejects.
    inner.forwardEstimates = {
      forwardPE: 30,
      earningsGrowthForward: 0.1,
      revenueGrowthForward: 0.05,
      ebitdaGrowthForward: null,
      analystConsensus: "buy",
      confidenceLevel: "definitely",
      reasoning: "n/a",
    };
    const p = buildProvider(envelope(inner));
    const r = await p.generate(buildNarrativeInputFixture());
    // Whole-document parse must still succeed; forwardEstimates degrades to null.
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect((r.data as { forwardEstimates: unknown }).forwardEstimates).toBeNull();
  });
});

/** Extract the inner narrative JSON from a recorded OpenAI envelope response. */
function innerContent(envelopeJson: string): Record<string, unknown> {
  const env = JSON.parse(envelopeJson) as { choices: { message: { content: string } }[] };
  const first = env.choices[0];
  if (first === undefined) throw new Error("test fixture missing choices[0]");
  return JSON.parse(first.message.content) as Record<string, unknown>;
}

/** Re-pack a mutated narrative JSON into the OpenAI envelope shape. */
function envelope(inner: Record<string, unknown>): string {
  return JSON.stringify({
    choices: [{ message: { role: "assistant", content: JSON.stringify(inner) } }],
  });
}

