/**
 * TickerBar — top-of-report identity card. Renders the company name, symbol,
 * current price + day change, the 52-week range bar with a position marker,
 * and market cap / volume. Pure presentational (C12); formatting helpers
 * live in TickerBar.helpers and lib/format.
 */
import type { TickerInfo } from "@darkscore/types";
import { NOT_AVAILABLE, formatCompact } from "../../lib/format";
import { formatChange, formatPrice, rangeMarkerPct } from "./TickerBar.helpers";

interface TickerBarProps {
  readonly ticker: TickerInfo;
}

export function TickerBar({ ticker }: TickerBarProps): JSX.Element {
  const isUp = ticker.priceChange >= 0;
  const changeClass = isUp ? "text-[#00dc82]" : "text-[#ff4757]";
  const markerPct = rangeMarkerPct(ticker.currentPrice, ticker.week52Low, ticker.week52High);

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#11131a] p-5 mb-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <div className="font-mono text-3xl font-bold text-[#3b82f6]">{ticker.symbol}</div>
          <div className="text-sm text-[#94a3b8] truncate">{ticker.name}</div>
          {(ticker.sector !== null || ticker.industry !== null || ticker.exchange !== null) ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748b]">
              {ticker.sector !== null ? <span>{ticker.sector}</span> : null}
              {ticker.sector !== null && ticker.industry !== null ? (
                <span aria-hidden="true">·</span>
              ) : null}
              {ticker.industry !== null ? <span>{ticker.industry}</span> : null}
              {ticker.exchange !== null ? (
                <span className="font-mono uppercase text-[10px] tracking-wider text-[#475569]">
                  {ticker.exchange}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-3xl font-bold text-[#f0f0f0]">
            {formatPrice(ticker.currentPrice, ticker.currency)}
          </div>
          <div className={`font-mono text-sm ${changeClass}`}>
            {formatChange(ticker.priceChange, ticker.priceChangePercent, ticker.currency)}
          </div>
        </div>
      </div>

      <div className="mt-3 w-full">
        <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">52-Week Range</div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#64748b]">
          <span>{formatPrice(ticker.week52Low, ticker.currency)}</span>
          <div className="relative flex-1 h-1 rounded-full bg-[#1e2130]">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "linear-gradient(90deg,#ff4757,#ffc107,#00dc82)" }}
            />
            <div
              className="absolute -top-1.5 h-4 w-2 rounded-sm bg-[#06b6d4] -translate-x-1/2"
              style={{ left: `${markerPct}%` }}
            />
          </div>
          <span>{formatPrice(ticker.week52High, ticker.currency)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-6 font-mono text-xs text-[#94a3b8]">
        <span>
          Mkt Cap:{" "}
          <strong className="text-[#f0f0f0]">
            {ticker.marketCap !== null ? formatCompact(ticker.marketCap, { prefix: "$" }) : NOT_AVAILABLE}
          </strong>
        </span>
        {ticker.volume !== null ? (
          <span>
            Volume: <strong className="text-[#f0f0f0]">{formatCompact(ticker.volume)}</strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}

