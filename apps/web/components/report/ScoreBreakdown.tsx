/**
 * ScoreBreakdown — horizontal bars for each component score with weight
 * label and the composite footer. Bars are filled inline via `width`; bar
 * color is selected from the score band so the visual reinforces the
 * rating. Pure presentational (C12).
 */
import type {
  ComponentScore,
  ScoreBreakdown as ScoreBreakdownData,
} from "@darkscore/types";

interface ScoreBreakdownProps {
  readonly breakdown: ScoreBreakdownData;
}

const COMPONENT_LABELS: Record<ComponentScore["name"], string> = {
  valuation: "Valuation Score",
  financial_health: "Financial Health Score",
  growth: "Growth Score",
};

function barColor(score: number): string {
  if (score >= 70) return "linear-gradient(90deg,#00dc82,#06b6d4)";
  if (score >= 40) return "linear-gradient(90deg,#ffc107,#00dc82)";
  return "linear-gradient(90deg,#ff4757,#ffc107)";
}

function compositeColor(score: number): string {
  if (score <= 40) return "#00dc82";
  if (score <= 70) return "#ffc107";
  return "#ff4757";
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps): JSX.Element {
  const { components, composite } = breakdown;
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6">
      <div className="text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-4">
        Score Breakdown
      </div>
      {components.map((c) => (
        <div key={c.name} className="mb-4 last:mb-0">
          <div className="flex justify-between items-baseline text-sm mb-1.5">
            <span className="font-semibold text-[#f0f0f0]">
              {COMPONENT_LABELS[c.name]}
            </span>
            <span className="font-mono font-semibold text-[#f0f0f0]">
              {c.score} / 100{" "}
              <span className="text-[#64748b] text-[11px] font-normal">
                ({Math.round(c.weight * 100)}% weight)
              </span>
            </span>
          </div>
          <div className="h-2 bg-[#1e2130] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${c.score}%`, background: barColor(c.score) }}
            />
          </div>
          {c.note !== null ? (
            <div className="text-[11px] text-[#64748b] mt-1">{c.note}</div>
          ) : null}
        </div>
      ))}
      <div className="mt-4 pt-4 border-t border-[#1e2130] flex justify-between items-center">
        <span className="text-[13px] font-semibold text-[#f0f0f0]">
          Composite Risk Score
        </span>
        <span
          className="font-mono text-2xl font-bold"
          style={{ color: compositeColor(composite.composite) }}
        >
          {composite.composite} / 100
        </span>
      </div>
      <div className="text-[11px] text-[#64748b] mt-1">
        Higher component scores → lower risk. Inverted composite.
      </div>
    </div>
  );
}

