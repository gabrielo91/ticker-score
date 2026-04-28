/**
 * SourceFooter — bottom-of-report attribution bar (W5-3). Aggregates the
 * `SourceAttribution` map into per-provider rollups, appends the active
 * narrative provider, and surfaces the generation timestamp + disclaimer.
 * Aggregation logic lives in `SourceFooter.helpers` so JSX stays declarative.
 */
import type { NarrativeData, SourceAttribution } from "@darkscore/types";
import {
  aggregateProviders,
  formatGeneratedAt,
  narrativeAsRollup,
  type ProviderRollup,
} from "./SourceFooter.helpers";

interface SourceFooterProps {
  readonly sources: SourceAttribution | null;
  readonly generatedAt: string;
  readonly narrative: NarrativeData | null;
}

export function SourceFooter({
  sources,
  generatedAt,
  narrative,
}: SourceFooterProps): JSX.Element {
  const providers = aggregateProviders(sources);
  const narrativeRollup = narrativeAsRollup(narrative);
  const all: ReadonlyArray<ProviderRollup> =
    narrativeRollup !== null ? [...providers, narrativeRollup] : providers;
  return (
    <footer className="mt-6 rounded-card border-t border-darkscore-border bg-darkscore-card px-5 py-4 text-xs text-text-muted">
      {all.length === 0 ? (
        <p>Source information unavailable.</p>
      ) : (
        <p className="leading-relaxed">
          <span className="font-semibold text-text-primary">Data sources:</span>{" "}
          {all.map((p, idx) => (
            <ProviderPill key={p.label} rollup={p} first={idx === 0} />
          ))}
        </p>
      )}
      <p className="mt-2">Generated at {formatGeneratedAt(generatedAt)}.</p>
      <p className="mt-2 text-[11px] leading-snug text-text-muted">
        This report is for informational purposes only and does not constitute
        financial advice. AI-estimated values are derived from trailing data
        and may not reflect actual market conditions.
      </p>
    </footer>
  );
}

function ProviderPill({
  rollup,
  first,
}: {
  rollup: ProviderRollup;
  first: boolean;
}): JSX.Element {
  return (
    <span>
      {first ? null : <span className="mx-1">•</span>}
      <span>{rollup.label} </span>
      {rollup.ok ? (
        <span className="text-accent-green" aria-label="ok">✅</span>
      ) : (
        <span className="text-accent-red" aria-label="error">
          ❌
          {rollup.error !== null ? (
            <span className="text-text-muted ml-1">({rollup.error})</span>
          ) : null}
        </span>
      )}
    </span>
  );
}

