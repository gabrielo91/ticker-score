> **Parent context**: [`/AGENTS.md`](../../AGENTS.md) · [`/.specify/memory/constitution.md`](../../.specify/memory/constitution.md) · [`Spec 002`](../../.specify/specs/002-narrative-enrichment/spec.md)

# `@darkscore/narrative` — Constitution

**Purpose:** LLM-synthesized narrative layer (catalysts, risks, verdict prose, card subtitles, chart annotations, price targets) for the report. Adapter-pattern peer of `@darkscore/data-providers`.

## Applicable rules
C1 (Adapter Pattern), C2 (Cache-First), C3 (Strict TypeScript), C4 (Package Boundaries), C5 (Result types), C8 (Scope discipline).

## Allowed imports
- `@darkscore/types` — for `NarrativeProvider` interface, `NarrativeData`, `NarrativeInput`, `Result`.
- `@darkscore/cache` — for `CacheService` and key helpers.
- External: `zod` (response validation), Node `crypto` (content hashing). HTTP via native `fetch`.

## Forbidden patterns
- No imports from `@darkscore/db`, `@darkscore/data-providers`, `@darkscore/scoring-engine`, or `apps/web`.
- No `any`, no `@ts-ignore` / `@ts-expect-error`.
- No throwing across the package boundary — every public method returns `Result`.
- No raw model output reaches the consumer: every response MUST be parsed through `NarrativeDataSchema` before being returned `ok`.
- No invention of facts: provider implementations MUST forward only data present in `NarrativeInput` to the model and instruct it via system prompt to use only those facts.
- No hidden cache bypass — calling `generate` MUST consult the cache by content-hashed key and write back on success.

## Reminders
- Cache key format: `narrative:{providerName}:{model}:{ticker}:{dataDigest}` where `dataDigest` is a SHA-256 of canonicalized `NarrativeInput`. TTL 24h.
- Determinism: temperature ≤ 0.2; use JSON-mode / structured-output where the provider supports it.
- Disclaimer: every `NarrativeData` MUST carry a non-empty `disclaimer` string. Do not strip it downstream.
- Failure mode: malformed model output ⇒ `Result.err`, never partial / coerced data. The orchestrator surfaces this as `narrativeAvailable: false`.

