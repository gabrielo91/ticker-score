/**
 * Latest earnings block — renders revenue, EPS, and operating margin from
 * the most recent `QuarterlyResult`, plus optional forward guidance. Mirrors
 * the "Latest Earnings & Delivery Update" card in `legacy/index.html`.
 *
 * Pure presentational (C12); formatting lives in private helpers above JSX.
 */
import type { NarrativeEarningsContext, QuarterlyResult } from "@darkscore/types";

interface EarningsUpdateProps {
  readonly latestQuarter: QuarterlyResult;
  readonly guidance?: string;
  /**
   * W6-1: optional narrative-supplied earnings context (headline,
   * beats/misses bullets, forward guidance). Rendered alongside the
   * structured numbers when present; absent when no narrative is available.
   */
  readonly earningsContext?: NarrativeEarningsContext | null;
}

const REVENUE_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatRevenue(value: number): string {
  return `$${REVENUE_FORMATTER.format(value)}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function EarningsUpdate({
  latestQuarter,
  guidance,
  earningsContext,
}: EarningsUpdateProps): JSX.Element {
  const yoyPositive = latestQuarter.revenueGrowthYoYPercent >= 0;
  const ctxGuidance = earningsContext?.guidance ?? null;
  const effectiveGuidance =
    guidance !== undefined && guidance.length > 0
      ? guidance
      : ctxGuidance ?? undefined;
  return (
    <section className="rounded-xl border border-zinc-800 bg-[#11131a] p-6 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0] mb-4">
        Latest Earnings
      </h2>
      {earningsContext !== undefined && earningsContext !== null ? (
        <p className="text-sm font-semibold text-[#f0f0f0] mb-4 leading-snug">
          {earningsContext.headline}
        </p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#f0f0f0] mb-3">
            {latestQuarter.quarter} {latestQuarter.fiscalYear} Results
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-2">
              <dt className="text-[#8a8f98]">Revenue</dt>
              <dd className="font-mono text-[#f0f0f0]">
                {formatRevenue(latestQuarter.revenue)}{" "}
                <span
                  className={`text-xs ${yoyPositive ? "text-[#00dc82]" : "text-[#ff4757]"}`}
                >
                  ({formatPercent(latestQuarter.revenueGrowthYoYPercent)} YoY)
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-2">
              <dt className="text-[#8a8f98]">EPS</dt>
              <dd className="font-mono text-[#f0f0f0]">
                ${latestQuarter.eps.toFixed(2)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-[#8a8f98]">Operating Margin</dt>
              <dd className="font-mono text-[#f0f0f0]">
                {latestQuarter.operatingMarginPercent.toFixed(1)}%
              </dd>
            </div>
          </dl>
        </div>
        {earningsContext !== undefined && earningsContext !== null ? (
          <BeatsMisses ctx={earningsContext} />
        ) : effectiveGuidance !== undefined && effectiveGuidance.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-[#f0f0f0] mb-3">
              Forward Guidance
            </h3>
            <p className="text-sm leading-relaxed text-[#8a8f98]">{effectiveGuidance}</p>
          </div>
        ) : null}
      </div>
      {latestQuarter.notes !== null && latestQuarter.notes.length > 0 ? (
        <p className="mt-4 pt-4 border-t border-zinc-800 text-xs text-[#8a8f98]">
          {latestQuarter.notes}
        </p>
      ) : null}
    </section>
  );
}

function BeatsMisses({ ctx }: { ctx: NarrativeEarningsContext }): JSX.Element {
  return (
    <div className="space-y-3">
      {ctx.beats.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#00dc82] mb-2">
            Beats
          </h3>
          <ul className="space-y-1 text-sm text-[#f0f0f0]">
            {ctx.beats.map((b, i) => (
              <li key={`beat-${i}`}>• {b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ctx.misses.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#ff4757] mb-2">
            Misses
          </h3>
          <ul className="space-y-1 text-sm text-[#f0f0f0]">
            {ctx.misses.map((m, i) => (
              <li key={`miss-${i}`}>• {m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ctx.guidance !== null && ctx.guidance.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#8a8f98] mb-2">
            Guidance
          </h3>
          <p className="text-sm leading-relaxed text-[#8a8f98]">{ctx.guidance}</p>
        </div>
      ) : null}
    </div>
  );
}

