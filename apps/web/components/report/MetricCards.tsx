/**
 * MetricCards — section of category cards (Valuation / Financial Health /
 * Growth). Renders a 3-column grid of `DataCard`s, each card holding a
 * label/value list. Card border tint follows the dominant `status` across
 * its items. Palette lookups and `dominantStatus` live in helpers (C12).
 */
import type { DataCard } from "@darkscore/types";
import { STATUS_BORDER, STATUS_VALUE, dominantStatus } from "./MetricCards.helpers";

interface MetricCardsProps {
  readonly title: string;
  readonly cards: ReadonlyArray<DataCard>;
}

export function MetricCards({ title, cards }: MetricCardsProps): JSX.Element {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-[1.5px] text-[#64748b] mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const status = dominantStatus(card.items);
          const borderClass =
            status !== null ? STATUS_BORDER[status] : "border-[#1e2130]";
          return (
            <div
              key={card.title}
              className={`rounded-xl border ${borderClass} bg-[#11131a] p-5`}
            >
              <h3 className="text-[15px] font-bold mb-3 text-[#f0f0f0]">
                {card.title}
              </h3>
              {card.items.map((item) => {
                const valueClass =
                  item.status !== null
                    ? STATUS_VALUE[item.status]
                    : "text-[#f0f0f0]";
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-2 border-b border-[#1e2130] last:border-b-0 text-sm"
                  >
                    <span className="text-[#94a3b8]">{item.label}</span>
                    <span className={`font-mono font-semibold ${valueClass}`}>
                      {item.value}
                    </span>
                  </div>
                );
              })}
              {card.subtitle !== null ? (
                <p className="text-[11px] text-[#64748b] mt-3 leading-snug">
                  {card.subtitle}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

