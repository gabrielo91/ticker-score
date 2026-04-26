/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders the ticker header (symbol, name,
 * sector, current price, day change, 52-week range bar).
 */
import type { TickerInfo } from "@darkscore/types";

export interface TickerBarProps {
  readonly info: TickerInfo;
}

export function TickerBar({ info }: TickerBarProps): JSX.Element {
  const isUp = info.priceChange >= 0;
  const changeClass = isUp ? "status-green" : "status-red";
  return (
    <div className="ds-card flex flex-wrap items-center gap-5">
      <div>
        <div className="font-mono text-3xl font-bold text-accent-blue">
          {info.symbol}
        </div>
        <div className="text-text-muted text-sm">{info.name}</div>
        {info.sector !== null ? (
          <div className="text-text-muted text-xs">{info.sector}</div>
        ) : null}
      </div>
      <div className="ml-auto text-right">
        <div className="font-mono text-3xl font-bold">
          {info.currency} {info.currentPrice.toFixed(2)}
        </div>
        <div className={`font-mono text-sm ${changeClass}`}>
          {isUp ? "+" : ""}
          {info.priceChange.toFixed(2)} (
          {(info.priceChangePercent * 100).toFixed(2)}%)
        </div>
      </div>
    </div>
  );
}
