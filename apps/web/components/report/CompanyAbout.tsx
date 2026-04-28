/**
 * CompanyAbout — short business-description block sourced from
 * `TickerInfo.description` (e.g. Twelve Data `/profile.description`).
 * Returns `null` when the provider didn't supply a description, so the
 * report layout collapses cleanly without an empty card. Pure
 * presentational (C12).
 */
import type { TickerInfo } from "@darkscore/types";

interface CompanyAboutProps {
  readonly ticker: TickerInfo;
  /**
   * W6-1: optional narrative-supplied 2-3 sentence overview. When present it
   * supersedes `TickerInfo.description` so the reader sees a strategic
   * snapshot rather than the raw provider profile blurb.
   */
  readonly companyOverview?: string | null;
  /**
   * W6-1: optional 3-5 short bullet points for recent developments
   * (product launches, earnings, regulatory). Rendered as a muted list
   * below the overview.
   */
  readonly recentDevelopments?: ReadonlyArray<string> | null;
}

export function CompanyAbout({
  ticker,
  companyOverview,
  recentDevelopments,
}: CompanyAboutProps): JSX.Element | null {
  const overview =
    companyOverview !== null && companyOverview !== undefined && companyOverview.trim().length > 0
      ? companyOverview
      : ticker.description !== null && ticker.description.trim().length > 0
        ? ticker.description
        : null;
  if (overview === null) return null;
  return (
    <section
      className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6"
      aria-label={`About ${ticker.name}`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0]">
          About {ticker.name}
        </h2>
        {ticker.industry !== null ? (
          <span className="text-[10px] uppercase tracking-widest text-[#64748b]">
            {ticker.industry}
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-[#94a3b8]">{overview}</p>
      {recentDevelopments !== null &&
      recentDevelopments !== undefined &&
      recentDevelopments.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <h3 className="text-xs uppercase tracking-wider text-[#8a8f98] mb-2">
            Recent Developments
          </h3>
          <ul className="space-y-1 text-sm text-[#94a3b8]">
            {recentDevelopments.map((item, i) => (
              <li key={`dev-${i}`}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

