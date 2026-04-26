/**
 * Bottom-line verdict block — rating bar with marker, composite risk score,
 * verdict summary, and bear/base/bull price targets. Mirrors the "Bottom
 * Line — Verdict" card in `legacy/index.html`.
 *
 * Pure presentational (C12). Rating-to-position math lives in the scoring
 * engine; this component reads `riskScore.ratingPosition` directly and
 * never re-derives it from the rating string.
 */
import type { Rating, RiskScore, Verdict as VerdictData } from "@darkscore/types";

interface VerdictProps {
  readonly verdict: VerdictData;
  readonly riskScore: RiskScore;
}

function formatRating(rating: Rating): string {
  return rating.replace(/_/g, " ");
}

export function Verdict({ verdict, riskScore }: VerdictProps): JSX.Element {
  return (
    <section className="rounded-xl border border-zinc-800 bg-[#11131a] p-6 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0] mb-5">
        Bottom Line — Verdict
      </h2>
      <div className="mb-5">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-[#8a8f98] mb-2">
          <span>Strong Sell</span>
          <span>Sell</span>
          <span>Hold</span>
          <span>Buy</span>
          <span>Strong Buy</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#ff4757] via-[#ffc107] to-[#00dc82]">
          <div
            className="absolute -top-1 w-1 rounded-sm bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ left: `${riskScore.ratingPosition}%`, height: "18px" }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[#f0f0f0]">
          Overall Risk Score
        </span>
        <span className="font-mono text-2xl font-bold text-[#00dc82]">
          {riskScore.composite} / 100 — {formatRating(riskScore.rating)}
        </span>
      </div>
      <p className="text-sm text-[#8a8f98] leading-relaxed mb-4">
        {verdict.summary}
      </p>
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-800">
        <PriceTargetCell
          label="Bear"
          value={verdict.priceTargets.bear}
          tone="red"
        />
        <PriceTargetCell
          label="Base"
          value={verdict.priceTargets.base}
          tone="blue"
        />
        <PriceTargetCell
          label="Bull"
          value={verdict.priceTargets.bull}
          tone="green"
        />
      </div>
    </section>
  );
}

const TONE_CLASSES = {
  red: "text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/20",
  blue: "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20",
  green: "text-[#00dc82] bg-[#00dc82]/10 border-[#00dc82]/20",
} as const;

function PriceTargetCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE_CLASSES;
}): JSX.Element {
  return (
    <div
      className={`text-center p-3 rounded-lg border ${TONE_CLASSES[tone]}`}
    >
      <div className="text-[10px] uppercase tracking-widest mb-1">{label}</div>
      <div className="font-mono text-xl font-bold text-[#f0f0f0]">
        ${value.toFixed(0)}
      </div>
    </div>
  );
}

