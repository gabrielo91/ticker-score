/**
 * HowItWorks — top-of-report explainer card. Documents what the report
 * computes, where the data comes from, and how the bear/base/bull price
 * targets are derived. Pure presentational (C12); the methodology
 * constants below mirror the implementation in
 * `apps/web/lib/report-generator.ts#buildVerdict` — keep them in sync if
 * `buildVerdict` changes.
 *
 * The bear/base/bull multipliers are intentionally exposed here so users
 * can see they are placeholder fixed multipliers (not a model output)
 * until the scoring engine produces real targets.
 */

const BEAR_MULTIPLIER = 0.85;
const BASE_MULTIPLIER = 1.0;
const BULL_MULTIPLIER = 1.2;

function pct(multiplier: number): string {
  const delta = (multiplier - 1) * 100;
  if (delta === 0) return "current price";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}

export function HowItWorks(): JSX.Element {
  return (
    <section
      className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6"
      aria-label="How this report works"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0] mb-3">
        How this report works
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[#94a3b8] leading-relaxed">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] mb-1.5">
            What it shows
          </h3>
          <p>
            A snapshot of the company plus a composite{" "}
            <strong className="text-[#f0f0f0]">risk score (0–100)</strong> from
            the Editorial scoring strategy, blending valuation, financial
            health and growth signals into a single rating.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] mb-1.5">
            Where the data comes from
          </h3>
          <p>
            <strong className="text-[#f0f0f0]">Yahoo Finance</strong> is the
            primary source for quotes, fundamentals and price history.{" "}
            <strong className="text-[#f0f0f0]">Finnhub</strong> is consulted as
            a fallback for fundamentals when Yahoo throttles the request; its
            free tier doesn&apos;t expose historical candles, so the chart may
            be empty when only Finnhub is available.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] mb-1.5">
            Bear / Base / Bull targets
          </h3>
          <p>
            Currently <em className="not-italic text-[#fbbf24]">placeholder</em>{" "}
            fixed multipliers of the current price:{" "}
            <span className="font-mono text-[#ff4757]">
              Bear ×{BEAR_MULTIPLIER.toFixed(2)} ({pct(BEAR_MULTIPLIER)})
            </span>
            ,{" "}
            <span className="font-mono text-[#3b82f6]">
              Base ×{BASE_MULTIPLIER.toFixed(2)} ({pct(BASE_MULTIPLIER)})
            </span>
            ,{" "}
            <span className="font-mono text-[#00dc82]">
              Bull ×{BULL_MULTIPLIER.toFixed(2)} ({pct(BULL_MULTIPLIER)})
            </span>
            . They will be replaced with model-driven targets in a future
            scoring update.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#64748b]">
        Not financial advice. Information is provided for research only and may
        be delayed or incomplete.
      </p>
    </section>
  );
}

