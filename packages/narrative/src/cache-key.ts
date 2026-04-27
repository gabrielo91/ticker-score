/**
 * Deterministic cache-key builder for narrative results. The key carries
 * provider + model + ticker + a stable SHA-256 digest of the canonicalized
 * `NarrativeInput`, so identical inputs collide even across processes /
 * deploys (Constitution C2). Pure, no I/O.
 *
 * Format: `narrative:{providerName}:{model}:{ticker}:{digest}`
 * Digest is the first 16 hex chars of SHA-256 — short enough for a key,
 * wide enough for collision resistance in this domain (≈ 2^64 space).
 */
import { createHash } from "node:crypto";
import type { NarrativeInput } from "@darkscore/types";

export const NARRATIVE_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h
export const NARRATIVE_CACHE_NAMESPACE = "narrative";
const DIGEST_LENGTH = 16;

export interface NarrativeCacheKeyParts {
  readonly providerName: string;
  readonly model: string;
  readonly input: NarrativeInput;
}

/**
 * Build the canonical cache key for a narrative call. The ticker symbol is
 * uppercased so `aapl` and `AAPL` collide; the digest hashes the full input
 * so any change in the underlying report state invalidates the cache.
 */
export function buildNarrativeCacheKey(parts: NarrativeCacheKeyParts): string {
  const ticker = parts.input.ticker.symbol.toUpperCase();
  const digest = digestInput(parts.input);
  return `${NARRATIVE_CACHE_NAMESPACE}:${parts.providerName}:${parts.model}:${ticker}:${digest}`;
}

/**
 * Hash a `NarrativeInput` to a stable hex digest. The input is first
 * canonicalized (object keys sorted recursively) so semantically equivalent
 * objects with different key orderings produce the same digest.
 */
export function digestInput(input: NarrativeInput): string {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(canonical).digest("hex").slice(0, DIGEST_LENGTH);
}

/**
 * Recursively sort object keys so that `JSON.stringify` produces a stable
 * representation regardless of source key ordering. Arrays preserve order
 * (semantically meaningful in our domain — e.g. priceHistory).
 */
function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = canonicalize(obj[k]);
    return out;
  }
  return value;
}

