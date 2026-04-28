/**
 * AIBadge — small inline marker rendered next to a metric value that was
 * backfilled from the LLM by the report generator (W5-3). Muted amber so it
 * reads as informative, not alarming. The native `title` attribute provides
 * an accessible hover tooltip with the confidence level.
 *
 * Encoding lives in `apps/web/lib/report-generator.ts` as `__ai__:<conf>`
 * embedded in `DataPoint.note`. Use `parseAiNote` to split the marker from
 * any user-visible note text before rendering.
 */
import type { ForwardEstimateConfidence } from "@darkscore/types";

const AI_NOTE_PREFIX = "__ai__:";

export interface ParsedAiNote {
  readonly confidence: ForwardEstimateConfidence | null;
  readonly remaining: string | null;
}

export function parseAiNote(note: string | null): ParsedAiNote {
  if (note === null || !note.startsWith(AI_NOTE_PREFIX)) {
    return { confidence: null, remaining: note };
  }
  const rest = note.slice(AI_NOTE_PREFIX.length);
  const semi = rest.indexOf(";");
  const conf = (semi === -1 ? rest : rest.slice(0, semi)).trim();
  if (conf !== "high" && conf !== "medium" && conf !== "low") {
    return { confidence: null, remaining: note };
  }
  const tail = semi === -1 ? null : rest.slice(semi + 1).trim();
  return {
    confidence: conf,
    remaining: tail !== null && tail.length > 0 ? tail : null,
  };
}

interface AIBadgeProps {
  readonly confidence: ForwardEstimateConfidence;
}

export function AIBadge({ confidence }: AIBadgeProps): JSX.Element {
  return (
    <span
      title={`AI-estimated (${confidence} confidence) — derived from trailing financial data by the configured LLM provider`}
      className="ml-1.5 inline-flex items-center rounded-md border border-accent-amber/40 bg-accent-amber/10 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-accent-amber print-hide"
      aria-label={`AI-estimated, ${confidence} confidence`}
    >
      AI est.
    </span>
  );
}

