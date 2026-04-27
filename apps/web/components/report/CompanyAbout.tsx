/**
 * CompanyAbout — short business-description block sourced from
 * `TickerInfo.description` (Yahoo `assetProfile.longBusinessSummary`).
 * Returns `null` when the provider didn't supply a description, so the
 * report layout collapses cleanly without an empty card. Pure
 * presentational (C12).
 */
import type { TickerInfo } from "@darkscore/types";

interface CompanyAboutProps {
  readonly ticker: TickerInfo;
}

export function CompanyAbout({ ticker }: CompanyAboutProps): JSX.Element | null {
  if (ticker.description === null || ticker.description.trim().length === 0) {
    return null;
  }
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
      <p className="text-sm leading-relaxed text-[#94a3b8]">
        {ticker.description}
      </p>
    </section>
  );
}

