/**
 * Prompt construction for the OpenAI narrative provider. The system prompt
 * encodes Spec 002's grounding rules (closed input, JSON-only output,
 * mandatory disclaimer, no advice phrasing). The user prompt carries the
 * `NarrativeInput` snapshot as a single JSON document so the model has no
 * other source of facts.
 *
 * Pure module — no I/O, no model calls. Lives separately from the client so
 * tests can pin the prompt text and detect drift.
 */
import type { NarrativeInput } from "@darkscore/types";

/** Bumped whenever the prompt text changes; helps invalidate stale caches. */
export const NARRATIVE_PROMPT_VERSION = "1";

export const NARRATIVE_SYSTEM_PROMPT = `You are a financial-research analyst writing a structured stock-report narrative.

You are given ONE source of truth: a JSON object describing a single ticker's
already-computed financial snapshot (ticker info, risk score, score breakdown,
financials, key metrics, recent quarterly results, and price history).

GROUNDING RULES — these are absolute:
1. Use ONLY the facts present in the supplied JSON. Do NOT introduce numbers,
   dates, tickers, products, executives, or events that are not in the input.
2. Output strictly valid JSON matching the schema in the user message. No
   prose outside the JSON. No markdown fences.
3. Every catalyst/risk must be a single sentence (<= 160 chars), grounded in
   a metric or trend visible in the input.
4. Card subtitles must be <= 160 chars and refer to the metric named in the
   field key (e.g. valuationPe must reference the P/E ratio).
5. Chart annotations: 0-5 items, each tied to a date that appears in
   priceHistory; "high"/"low" mark notable extrema, "event" marks a fiscal
   inflection visible in quarterlyResults. Label <= 48 chars.
6. priceTargets MUST satisfy bear <= base <= bull. Anchor on the current
   price; do not predict beyond plausible 12-month ranges.
7. verdict.headline <= 80 chars; verdict.paragraph <= 600 chars; describe
   the analysis. Do NOT use advice phrasing ("buy", "sell", "you should").
8. disclaimer: a single sentence stating this is automated analysis, not
   investment advice. Required and non-empty.
9. If a metric is null/missing in the input, write the corresponding
   subtitle as null rather than inventing a value.

Determinism: temperature is pinned low. Be consistent on repeated calls.`;

const SCHEMA_HINT = `{
  "cardSubtitles": {
    "valuationPe": string|null, "valuationEv": string|null, "valuationRelative": string|null,
    "healthBalance": string|null, "healthCashFlow": string|null, "healthProfitability": string|null,
    "growthRevenue": string|null, "growthSegment": string|null, "growthEarnings": string|null
  },
  "chartAnnotations": [{ "date": "YYYY-MM-DD", "label": string, "kind": "high"|"low"|"event" }],
  "catalysts": [string, string, string, ...],   // 3..7 items
  "risks":     [string, string, string, ...],   // 3..7 items
  "priceTargets": { "bear": number, "base": number, "bull": number },
  "verdict":  { "headline": string, "paragraph": string },
  "disclaimer": string
}`;

/**
 * Build the user prompt: a short instruction followed by the schema hint
 * and the canonical JSON input. Compact JSON keeps token usage minimal;
 * field names alone are enough context for the model.
 */
export function buildUserPrompt(input: NarrativeInput): string {
  const payload = JSON.stringify(input);
  return `Produce the narrative JSON for the supplied snapshot.

Schema (return EXACTLY this shape, no extra keys):
${SCHEMA_HINT}

Input snapshot (use ONLY these facts):
${payload}`;
}

