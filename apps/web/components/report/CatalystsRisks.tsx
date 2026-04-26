/**
 * Stub for W3-3 — replaced by the real implementation in
 * `feat/w3-page2-components`. Renders side-by-side catalyst and risk lists.
 */
export interface CatalystsRisksProps {
  readonly catalysts: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
}

export function CatalystsRisks({
  catalysts,
  risks,
}: CatalystsRisksProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="ds-card">
        <h2 className="section-title status-green">Catalysts</h2>
        {catalysts.length === 0 ? (
          <p className="text-text-muted text-sm">No catalysts recorded.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {catalysts.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="ds-card">
        <h2 className="section-title status-red">Risks</h2>
        {risks.length === 0 ? (
          <p className="text-text-muted text-sm">No risks recorded.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {risks.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
