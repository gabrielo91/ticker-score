/**
 * Stub for W3-2 — replaced by the real implementation in
 * `feat/w3-page1-components`. Renders a grid of `DataCard`s (valuation /
 * health / growth) with label/value rows.
 */
import type { DataCard, DataPoint } from "@darkscore/types";

export interface MetricCardsProps {
  readonly title: string;
  readonly cards: ReadonlyArray<DataCard>;
}

export function MetricCards({ title, cards }: MetricCardsProps): JSX.Element {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.title} className="ds-card">
            <h3 className="text-sm font-bold mb-3">{card.title}</h3>
            {card.subtitle !== null ? (
              <p className="text-text-muted text-xs mb-2">{card.subtitle}</p>
            ) : null}
            <dl>
              {card.items.map((item: DataPoint) => (
                <div
                  key={item.label}
                  className="flex justify-between items-center py-2 border-b border-darkscore-border last:border-b-0 text-sm"
                >
                  <dt className="text-text-muted">{item.label}</dt>
                  <dd className="font-mono font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
