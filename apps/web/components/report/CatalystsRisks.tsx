/**
 * Dual-column catalysts vs risks list — matches the "Catalysts vs Risks"
 * grid in `legacy/index.html`. Pure presentational (C12).
 */

interface CatalystsRisksProps {
  readonly catalysts: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
}

export function CatalystsRisks({
  catalysts,
  risks,
}: CatalystsRisksProps): JSX.Element {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0f0f0] mb-4">
        Catalysts vs Risks
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#00dc82]/25 bg-[#11131a] p-6">
          <h3 className="text-sm font-semibold text-[#00dc82] mb-3">
            ⬆ Catalysts
          </h3>
          <ul className="space-y-2 text-sm leading-relaxed">
            {catalysts.map((item, i) => (
              <li
                key={`catalyst-${i}`}
                className="flex gap-2 text-[#f0f0f0]"
              >
                <span aria-hidden className="text-[#00dc82] mt-1">●</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#ff4757]/25 bg-[#11131a] p-6">
          <h3 className="text-sm font-semibold text-[#ff4757] mb-3">
            ⬇ Risks
          </h3>
          <ul className="space-y-2 text-sm leading-relaxed">
            {risks.map((item, i) => (
              <li key={`risk-${i}`} className="flex gap-2 text-[#f0f0f0]">
                <span aria-hidden className="text-[#ff4757] mt-1">●</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

