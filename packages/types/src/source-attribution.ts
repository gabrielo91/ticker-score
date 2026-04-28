/**
 * `SourceAttribution` — per-method record of which provider served each
 * `DataProvider` call in the composite aggregator (W5-1). The aggregator
 * tries providers in priority order per method and records the outcome
 * for every attempt; the report can then surface "Twelve Data → price,
 * Finnhub → financials" without the UI having to inspect provider
 * internals.
 *
 * `status: "ok"` records the provider that successfully served the
 * payload; `status: "error"` records a provider that was tried but failed
 * (and the error message that surfaced). When every provider in the chain
 * fails, the aggregator records the final error against the last attempted
 * provider — callers receive `Result.err` and can read the trail from the
 * attribution map alongside.
 */
import { z } from "zod";

export const SourceEntrySchema = z.object({
  provider: z.string().min(1),
  status: z.enum(["ok", "error"]),
  error: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});

export type SourceEntry = z.infer<typeof SourceEntrySchema>;

export const SourceAttributionSchema = z.record(z.string(), SourceEntrySchema);

export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

