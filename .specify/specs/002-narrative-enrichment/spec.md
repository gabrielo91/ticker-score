<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->

# Spec 002 — Narrative Enrichment

> Companion documents (read alongside this spec):
> - [Constitution](../../memory/constitution.md) — governing rules C1–C14
> - [Spec 001](../001-darkscore-foundation/spec.md) — foundation this builds on
> - [C4 Diagrams](../001-darkscore-foundation/c4-diagrams.md) — L2/L3 (this spec adds one container)
> - [Plan](./plan.md) — wave breakdown and current state

---

## Goal

Add an **LLM-synthesized narrative layer** so reports reach parity with the legacy HTML quality (catalyst/risk prose, card subtitles, chart annotations, scenario price targets, verdict paragraph). The structured financial layer from Spec 001 stays the source of truth; the narrative is grounded strictly on that snapshot — the model is never allowed to invent numbers.

The layer is a swappable **NarrativeProvider** adapter (peer of `DataProvider`), cached by content-hash, and rendered fail-open: if no provider is configured or a call fails, the UI degrades cleanly to the Spec-001 layout.

---

## Overview

A new `@darkscore/narrative` package, dependency-allowed: `types`, `cache`. Mirrors the data-providers shape:

- **NarrativeProvider** interface — `name`, `model`, `isAvailable()`, `generate(input): Promise<Result<NarrativeData>>`.
- **NarrativeRegistry** — registers one or more providers; `apps/web` selects the active one via env (`NARRATIVE_PROVIDER`, default `none`).
- **Content-hashed cache** — key `narrative:{provider}:{model}:{TICKER}:{sha256-16(input)}`, TTL 24h. Same input ⇒ same cache hit, even after restarts.
- **OpenAI adapter** (W4-2) — `gpt-4o-mini` default, JSON-mode / structured outputs, temperature ≤ 0.2.
- **Optional Anthropic adapter** (W4-3) — `claude-haiku` tier, parallel implementation for failover / A-B comparison.
- **Web orchestration** (W4-4) — `apps/web/lib/report-generator.ts` calls the active provider after scoring; failures set `narrativeAvailable: false`, success populates `report.narrative` and the new UI sections render.

The provider receives a `NarrativeInput` (the structured report state) and must return a Zod-validated `NarrativeData`. Malformed model output ⇒ `Result.err`, never coerced.

---

## Key Interfaces

```typescript
interface NarrativeProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): Promise<boolean>;
  generate(input: NarrativeInput): Promise<Result<NarrativeData>>;
}

// NarrativeInput = { ticker, riskScore, scoreBreakdown, financials,
//                    keyMetrics, quarterlyResults, priceHistory }

// NarrativeData = { cardSubtitles, chartAnnotations, catalysts[3..7],
//                   risks[3..7], priceTargets{bear,base,bull},
//                   verdict{headline,paragraph}, disclaimer,
//                   providerName, model, generatedAt }
```

Full schemas live in `packages/types/src/narrative.ts` (delivered in W4-1).

---

## Prompt Grounding Rules (normative)

1. **Closed input.** The system prompt MUST instruct the model to use *only* the JSON facts supplied; explicit "do not invent numbers / dates / tickers" guard.
2. **Structured output.** Use the provider's JSON-mode / structured-output mode where available. Free-form completions are forbidden.
3. **Temperature ≤ 0.2.** Determinism > creativity for financial content.
4. **Disclaimer mandatory.** Every response MUST carry a non-empty `disclaimer`. The UI MUST display it next to the verdict.
5. **No PII / no advice phrasing.** Verdicts describe the analysis, not "you should buy/sell".
6. **Fail closed on schema violation.** A malformed model response surfaces as `Result.err`; the orchestrator sets `narrativeAvailable: false`.

---

## Acceptance Criteria

- [x] **W4-1**: `@darkscore/narrative` package skeleton lands with types, registry, content-hash cache key, mock provider, error type, tests, and boundary-checker entry.
- [ ] **W4-2**: OpenAI adapter implementation; integration test against a recorded fixture; `NARRATIVE_PROVIDER=openai` selects it.
- [ ] **W4-3** *(optional / stretch)*: Anthropic adapter, parallel shape.
- [ ] **W4-4**: `report-generator.ts` calls the active provider after scoring; cache-first via `@darkscore/cache`; failure ⇒ `narrativeAvailable: false`, no thrown errors reach the page.
- [ ] **W4-5**: UI renders narrative sections (catalysts/risks dual column, verdict prose, card subtitles, chart annotations, scenario targets) gated on `narrativeAvailable`.
- [ ] **W4-6**: One end-to-end smoke test confirms a real ticker produces a narrative when an OpenAI key is present, and degrades cleanly when it is not.
- [ ] All constitutional gates green: `pnpm turbo validate` + `pnpm turbo test`.
- [ ] No new `any` / `@ts-ignore`. No new cross-boundary imports. No raw model output reaching the UI.

---

## Non-Goals

- No streaming responses (request/response only in this spec).
- No fine-tuning, embeddings, or RAG over external corpora.
- No agent loops / tool use — single-shot generation grounded on the supplied input.
- No A-B testing harness, no eval framework (deferred).
- No transcript / 10-Q text ingestion (separate future spec).
- No user-facing prompt customization.

---

## Assumptions

- An OpenAI API key is available via `OPENAI_API_KEY`. Cost target: ≤ $0.005 per uncached report at `gpt-4o-mini` rates.
- The Spec-001 `ReportData` carries enough context for a useful narrative (validated empirically in W4-2 against ≥ 3 tickers across sectors).
- Redis (Spec-001 cache layer) is reachable; cache TTL 24h is acceptable for narrative freshness.

---

## Verification Plan

1. `pnpm turbo validate` — boundaries + no-any + typecheck + lint.
2. `pnpm turbo test` — unit + integration suites.
3. With `OPENAI_API_KEY` set, `pnpm dev` then `/report/AAPL` shows narrative sections; without the key, the page renders the Spec-001 layout (no errors, no missing-data placeholders for narrative blocks).
4. Cache hit confirmed: second request for the same ticker within 24h does NOT incur a model call (logged / observable via cache metrics).
5. Schema-violation simulation (mock provider returning bad JSON) sets `narrativeAvailable: false`, page still renders.

---

## Rollback Plan

- Feature is gated by `NARRATIVE_PROVIDER` env. Setting it to `none` (default) returns the platform to Spec-001 behavior with zero code changes.
- The `@darkscore/narrative` package is a leaf consumer of `types` + `cache`; removing the env var or unregistering the provider has no effect on the data / scoring pipeline.
- Cache entries expire automatically (24h TTL); manual purge via Redis `DEL narrative:*` if needed.

