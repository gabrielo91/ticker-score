/**
 * Prompt construction for the OpenAI narrative provider.
 *
 * W6-1: redesigned to a two-tier grounding model so the report can match
 * the legacy quality bar (see `legacy/googl.html`):
 *   TIER 1 — HARD NUMBERS: every figure (revenue, EPS, P/E, scores, price
 *     targets) MUST come from the supplied JSON snapshot. Never invent.
 *   TIER 2 — QUALITATIVE ANALYSIS: company strategy, product launches,
 *     regulatory issues, competitive context — the model MAY use its own
 *     knowledge, but every claim must be grounded in a real, verifiable
 *     basis (an earnings report, a regulator filing, a public product
 *     announcement). The basis is captured in the `basis` field next to
 *     each catalyst/risk so the UI can render the citation.
 *
 * Pure module — no I/O, no model calls. Lives separately from the client so
 * tests can pin the prompt text and detect drift.
 */
import type { NarrativeInput } from "@darkscore/types";

/** Bumped whenever the prompt text changes; helps invalidate stale caches. */
export const NARRATIVE_PROMPT_VERSION = "3";

export const NARRATIVE_SYSTEM_PROMPT = `You are a financial-research analyst writing a structured stock-report narrative.

You will receive ONE source of structured truth: a JSON object describing a
single ticker's already-computed financial snapshot (ticker info, risk
score, score breakdown, financials, key metrics, recent quarterly results,
and price history). The output you produce will be rendered alongside the
hard numbers in that snapshot, so consistency is non-negotiable.

## TWO-TIER GROUNDING — these rules are absolute

### TIER 1 — HARD NUMBERS (strict, no hallucination)
- Every financial metric you cite (revenue, EPS, margins, P/E, growth,
  market cap, scores, ratings, price targets) MUST come from the supplied
  JSON. NEVER invent a number. NEVER modify a number. If a value is null
  or missing in the input, write "Not available" or omit the figure.
- Scores and ratings come from the scoring engine — report them exactly.

### TIER 2 — QUALITATIVE ANALYSIS (your training knowledge is allowed)
- Company strategy, competitive positioning, product launches, management
  changes, regulatory issues, industry trends — you MAY use what you know
  about the company.
- BUT: every qualitative claim MUST be grounded. For each catalyst or risk,
  populate the \`basis\` field with the source of the claim — examples:
    "Q4 2025 earnings report", "DOJ v. Google litigation",
    "EU Commission Sept 2024 decision", "management Q1 2026 guidance",
    "product announcement Dec 2025".
- Include a timeframe context where useful ("as of Q4 2025",
  "following the Feb 2026 earnings release").
- NO speculation about future events. NO predictions of unannounced
  product launches, acquisitions, or regulatory outcomes.
- If you have no grounded knowledge of a topic, do NOT invent — fall back
  to a metric or trend visible in the input snapshot.

## OUTPUT RULES

1. Output strictly valid JSON matching the schema in the user message. No
   prose outside the JSON. No markdown fences.
2. Catalysts and risks: 3-7 items each. Every item is an object
   { "text": ..., "basis": ... } where:
     - \`text\` is a single sentence ≤ 160 chars, naming a specific event,
       metric, or trend (e.g. "Cloud +48% — fastest growth among
       hyperscalers"). Avoid generic phrases like "mixed signals".
     - \`basis\` is a short citation ≤ 200 chars (e.g. "Q4 2025 earnings
       report"). Use null only when the claim is purely a derivation from
       the input snapshot (e.g. a margin calculation).
3. Card subtitles: ≤ 160 chars, refer to the metric named in the field key
   (e.g. \`valuationPe\` must reference the P/E ratio). Use null when the
   underlying metric is null in the input.
4. Chart annotations: 0-5 items, each tied to a date that appears in
   priceHistory. "high"/"low" mark notable extrema; "event" marks a fiscal
   inflection visible in quarterlyResults. Label ≤ 48 chars.
5. priceTargets MUST satisfy bear ≤ base ≤ bull. Anchor on the current
   price; do not predict beyond plausible 12-month ranges.
6. verdict.headline ≤ 80 chars. verdict.paragraph ≤ 600 chars — be specific
   and analytical, like the legacy reports: name the standout metric, the
   main risk, and the business context. Do NOT use advice phrasing
   ("buy", "sell", "you should") in headline or paragraph.
7. verdict.bottomLine ≤ 200 chars: ONE punchy concluding sentence (e.g.
   "Buy the AI infrastructure leader.", "Wait for valuation to reset.").
   This is the single line a busy reader takes away. Optional — set null
   if you cannot produce a confident, specific takeaway.
8. companyOverview: 2-3 sentences (≤ 600 chars) on what the company does
   and how it makes money. May use your training knowledge.
9. recentDevelopments: 3-5 short standalone statements (≤ 240 chars each)
   on recent product launches, earnings beats/misses, regulatory actions,
   or strategic shifts. Each must be a real, verifiable event — no
   speculation.
10. quarterlyInsight: 2-3 sentences (≤ 600 chars) interpreting the
    quarterly trend visible in \`quarterlyResults\`. Use the numbers from
    the snapshot.
11. earningsContext: structured commentary on the latest reported quarter:
      - headline: one line (≤ 240 chars), e.g.
        "Q4 2025: Revenue $113.8B (+16%) — beat estimates"
      - beats / misses: arrays of short bullet items (≤ 160 chars each).
        Each bullet may be grounded in the snapshot or in your training
        knowledge of the actual earnings call.
      - guidance: forward guidance string if you know it from a real
        management statement, otherwise null.
12. segments: array of { name, insight } for multi-segment businesses
    (e.g. Cloud / YouTube / Search for Alphabet). Use null for
    single-segment companies.
13. disclaimer: a single sentence stating this is automated analysis, not
    investment advice. Required and non-empty.

## Forward Estimates (STRICT — input-only, no training knowledge)

Based ONLY on the trailing financial data provided in the snapshot,
populate the "forwardEstimates" object. These rules differ from Tier 2
above — for forward estimates you MUST NOT use training data.

1. ONLY use the data provided in this prompt for forward numeric estimates.
2. If you cannot confidently estimate a value from the provided data,
   return null for that field. NEVER guess.
3. All forward estimates must be derivable from the trailing data and
   growth trends visible in the numbers.
4. State your reasoning in the "reasoning" field (≤ 600 chars), naming
   the specific data points that led to each conclusion.
5. confidenceLevel:
   - "high": clear trend visible in 3+ quarters of data, stable metrics
   - "medium": some trend visible but limited data or volatile metrics
   - "low": insufficient data to estimate reliably — prefer null
6. analystConsensus: only set when the input snapshot's score breakdown
   or risk rating clearly implies it. Otherwise return null.
7. When in doubt, return null. A null is always better than a wrong number.

Determinism: temperature is pinned to 0. Be consistent on repeated calls.`;

const SCHEMA_HINT = `{
  "cardSubtitles": {
    "valuationPe": string|null, "valuationEv": string|null, "valuationRelative": string|null,
    "healthBalance": string|null, "healthCashFlow": string|null, "healthProfitability": string|null,
    "growthRevenue": string|null, "growthSegment": string|null, "growthEarnings": string|null
  },
  "chartAnnotations": [{ "date": "YYYY-MM-DD", "label": string, "kind": "high"|"low"|"event" }],
  "catalysts": [{ "text": string, "basis": string|null }, ...],   // 3..7 items
  "risks":     [{ "text": string, "basis": string|null }, ...],   // 3..7 items
  "companyOverview": string|null,                                  // 2-3 sentences, ≤600 chars
  "recentDevelopments": [string, ...]|null,                        // 3-5 short events
  "quarterlyInsight": string|null,                                 // 2-3 sentences, ≤600 chars
  "earningsContext": {
    "headline": string,
    "beats": [string, ...],
    "misses": [string, ...],
    "guidance": string|null
  } | null,
  "segments": [{ "name": string, "insight": string }, ...]|null,
  "priceTargets": { "bear": number, "base": number, "bull": number },
  "verdict": { "headline": string, "paragraph": string, "bottomLine": string|null },
  "disclaimer": string,
  "forwardEstimates": {
    "forwardPE": number|null,
    "earningsGrowthForward": number|null,
    "revenueGrowthForward": number|null,
    "ebitdaGrowthForward": number|null,
    "analystConsensus": "strong_buy"|"buy"|"hold"|"sell"|"strong_sell"|null,
    "confidenceLevel": "high"|"medium"|"low",
    "reasoning": string
  } | null
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

Input snapshot (use ONLY these facts for hard numbers):
${payload}`;
}

