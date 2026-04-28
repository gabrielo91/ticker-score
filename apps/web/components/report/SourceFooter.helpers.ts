/**
 * Pure helpers for `SourceFooter`: collapse the per-method
 * `SourceAttribution` map into one rollup per provider so the footer reads
 * "Twelve Data ✅ • Alpha Vantage ❌ (rate limited)" rather than repeating
 * every method line by line. Kept out of the component so JSX stays
 * declarative (C12).
 */
import type { NarrativeData, SourceAttribution } from "@darkscore/types";

export interface ProviderRollup {
  readonly label: string;
  readonly ok: boolean;
  readonly error: string | null;
}

export function narrativeAsRollup(
  narrative: NarrativeData | null,
): ProviderRollup | null {
  if (narrative === null) return null;
  return {
    label: `${narrative.providerName} (${narrative.model})`,
    ok: true,
    error: null,
  };
}

export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function aggregateProviders(
  sources: SourceAttribution | null,
): ReadonlyArray<ProviderRollup> {
  if (sources === null) return [];
  const byProvider = new Map<string, ProviderRollup>();
  for (const entry of Object.values(sources)) {
    const existing = byProvider.get(entry.provider);
    if (existing === undefined) {
      byProvider.set(entry.provider, {
        label: entry.provider,
        ok: entry.status === "ok",
        error: entry.status === "error" ? truncate(entry.error) : null,
      });
      continue;
    }
    if (entry.status === "error" && existing.ok) {
      byProvider.set(entry.provider, {
        label: entry.provider,
        ok: false,
        error: truncate(entry.error),
      });
    }
  }
  return Array.from(byProvider.values());
}

function truncate(error: string | null): string | null {
  if (error === null) return null;
  const trimmed = error.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 64 ? `${trimmed.slice(0, 61)}…` : trimmed;
}

