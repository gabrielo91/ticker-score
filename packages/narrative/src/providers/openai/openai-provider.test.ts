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
});

