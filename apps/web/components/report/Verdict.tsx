/**
 * Stub for W3-3 — replaced by the real implementation in
 * `feat/w3-page2-components`. Renders the closing verdict summary plus
 * bear/base/bull price targets.
 */
import type { TickerInfo, Verdict as VerdictData } from "@darkscore/types";

export interface VerdictProps {
  readonly verdict: VerdictData;
  readonly ticker: TickerInfo;
}

export function Verdict({ verdict, ticker }: VerdictProps): JSX.Element {
  const targets = verdict.priceTargets;
  return (
    <div className="ds-card">
      <h2 className="section-title">Verdict</h2>
      <p className="text-sm mb-4 leading-relaxed">{verdict.summary}</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-text-muted text-[10px] uppercase tracking-[0.1em] mb-1">
            Bear
          </div>
          <div className="font-mono font-bold status-red">
            {ticker.currency} {targets.bear.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[10px] uppercase tracking-[0.1em] mb-1">
            Base
          </div>
          <div className="font-mono font-bold">
            {ticker.currency} {targets.base.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-text-muted text-[10px] uppercase tracking-[0.1em] mb-1">
            Bull
          </div>
          <div className="font-mono font-bold status-green">
            {ticker.currency} {targets.bull.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
