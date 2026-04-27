/**
 * Narrative → ReportData merge (Spec 002, W4-5). Pure transformation: takes
 * the structured `ReportData` produced by `generateReport` plus the
 * Zod-validated `NarrativeData` from the active provider and returns a new
 * report whose existing slots (catalysts, risks, chart annotations, verdict
 * summary + price targets, valuation/health/growth card subtitles) are
 * populated from the narrative.
 *
 * The component layer stays purely presentational (C12) — it keeps reading
 * the same `ReportData` fields it has read since Spec 001. Headline and
 * disclaimer have no Spec-001 slot and are surfaced separately by the page.
 *
 * No I/O, no globals — every input is a parameter and every output is a new
 * object (deep-enough copies of the touched branches, shared references for
 * the rest). Safe to call from tests and from `report-generator`.
 */
import type {
  DataCard,
  NarrativeAnnotationKind,
  NarrativeData,
  PriceChartAnnotation,
  ReportData,
  StatusColor,
} from "@darkscore/types";

/**
 * Map a narrative annotation kind to the legacy chart palette so the
 * existing `PriceChart` component renders without changes. `high` peaks
 * read as positive (green), `low` troughs as negative (red), neutral
 * `event` markers as informational (blue).
 */
const ANNOTATION_KIND_TO_STATUS: Record<NarrativeAnnotationKind, StatusColor> =
  {
    high: "green",
    low: "red",
    event: "blue",
  };

export function mergeNarrativeIntoReport(
  base: ReportData,
  narrative: NarrativeData,
): ReportData {
  return {
    ...base,
    priceChart: {
      ...base.priceChart,
      annotations: narrative.chartAnnotations.map(toChartAnnotation),
    },
    valuationCards: applySubtitle(
      base.valuationCards,
      narrative.cardSubtitles.valuationPe,
    ),
    financialHealthCards: applySubtitle(
      base.financialHealthCards,
      narrative.cardSubtitles.healthBalance,
    ),
    growthCards: applySubtitle(
      base.growthCards,
      narrative.cardSubtitles.growthRevenue,
    ),
    catalysts: [...narrative.catalysts],
    risks: [...narrative.risks],
    verdict: {
      summary: narrative.verdict.paragraph,
      priceTargets: { ...narrative.priceTargets },
    },
  };
}

function toChartAnnotation(
  ann: NarrativeData["chartAnnotations"][number],
): PriceChartAnnotation {
  return {
    date: ann.date,
    label: ann.label,
    status: ANNOTATION_KIND_TO_STATUS[ann.kind],
  };
}

/**
 * The current `MetricCards` component renders one card per category with a
 * single optional `subtitle`. The narrative ships three subtitles per
 * category (e.g. PE / EV / relative for Valuation); until `MetricCards`
 * grows multi-card support we surface the most representative one — the
 * primary metric for that section. The other subtitles are intentionally
 * left unused here rather than concatenated into a wall of text; surfacing
 * them is a follow-up UI task, not part of W4-5 scope.
 *
 * `subtitle` is left untouched when the narrative supplies `null`, so a
 * partial narrative degrades to "no subtitle" rather than overwriting any
 * card-builder default.
 */
function applySubtitle(
  cards: ReadonlyArray<DataCard>,
  subtitle: string | null,
): DataCard[] {
  if (subtitle === null) return cards.map((c) => ({ ...c }));
  return cards.map((card, i) =>
    i === 0 ? { ...card, subtitle } : { ...card },
  );
}

