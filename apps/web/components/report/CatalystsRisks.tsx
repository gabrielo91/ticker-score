/**
 * Dual-column catalysts vs risks list — matches the "Catalysts vs Risks"
 * grid in `legacy/index.html`. Pure presentational (C12).
 *
 * W6-1: when `catalystsDetailed` / `risksDetailed` are supplied (narrative
 * available), each item renders the grounding `basis` as a muted citation
 * underneath. Otherwise the legacy `catalysts: string[]` / `risks: string[]`
 * shape is rendered as before so the report degrades cleanly without a
 * narrative.
 */
import type { CatalystItem } from "@darkscore/types";

interface CatalystsRisksProps {
  readonly catalysts: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
  readonly catalystsDetailed?: ReadonlyArray<CatalystItem> | null;
  readonly risksDetailed?: ReadonlyArray<CatalystItem> | null;
}

interface BulletItem {
  readonly text: string;
  readonly basis: string | null;
}

function asBullets(
  detailed: ReadonlyArray<CatalystItem> | null | undefined,
  fallback: ReadonlyArray<string>,
): ReadonlyArray<BulletItem> {
  if (detailed !== null && detailed !== undefined && detailed.length > 0) {
    return detailed.map((d) => ({ text: d.text, basis: d.basis }));
  }
  return fallback.map((text) => ({ text, basis: null }));
}

export function CatalystsRisks({
  catalysts,
  risks,
  catalystsDetailed,
  risksDetailed,
}: CatalystsRisksProps): JSX.Element {
  const cat = asBullets(catalystsDetailed, catalysts);
  const risk = asBullets(risksDetailed, risks);
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
          <BulletList items={cat} accent="#00dc82" />
        </div>
        <div className="rounded-xl border border-[#ff4757]/25 bg-[#11131a] p-6">
          <h3 className="text-sm font-semibold text-[#ff4757] mb-3">
            ⬇ Risks
          </h3>
          <BulletList items={risk} accent="#ff4757" />
        </div>
      </div>
    </section>
  );
}

function BulletList({
  items,
  accent,
}: {
  readonly items: ReadonlyArray<BulletItem>;
  readonly accent: string;
}): JSX.Element {
  return (
    <ul className="space-y-3 text-sm leading-relaxed">
      {items.map((item, i) => (
        <li key={`${accent}-${i}`} className="flex gap-2 text-[#f0f0f0]">
          <span aria-hidden style={{ color: accent }} className="mt-1">●</span>
          <span className="flex-1">
            <span className="block">{item.text}</span>
            {item.basis !== null && item.basis.length > 0 ? (
              <span className="block text-[11px] text-[#64748b] italic mt-0.5">
                {item.basis}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

