/**
 * Server-side report page. Calls the orchestrator and renders a temporary
 * dark-themed layout. Final visuals land in W3-2/3/4 — for W3-1 the goal is
 * just to prove the data flow works end-to-end and surface every
 * `ReportData` field a future component will consume.
 *
 * Per `apps/web/CONSTITUTION.md` (C12) this stays a server component:
 * fetching, scoring, and assembly all run on the server; the file imports
 * only the orchestrator and types.
 */
import type {
  ComponentScore,
  DataCard,
  DataPoint,
  KpiHighlight,
  ReportData,
} from "@darkscore/types";
import { generateReport } from "@/lib/report-generator";

interface PageProps {
  readonly params: { readonly ticker: string };
}

export default async function ReportPage({ params }: PageProps): Promise<JSX.Element> {
  const result = await generateReport(params.ticker);
  if (!result.ok) {
    return <ErrorScreen ticker={params.ticker} message={result.error.message} />;
  }
  return <ReportView report={result.data} />;
}

function ErrorScreen({
  ticker,
  message,
}: {
  ticker: string;
  message: string;
}): JSX.Element {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Report unavailable</h1>
        <p className="text-zinc-400 mb-6">
          Could not generate a report for{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
            {ticker.toUpperCase()}
          </code>
          .
        </p>
        <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-rose-300">
          {message}
        </pre>
      </div>
    </main>
  );
}

function ReportView({ report }: { report: ReportData }): JSX.Element {
  const { ticker, riskScore, scoreBreakdown, kpiStrip, valuationCards } = report;
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-semibold">{ticker.symbol}</h1>
          <p className="text-zinc-400">{ticker.name}</p>
          <p className="ml-auto text-xs text-zinc-500">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Risk Score
              </p>
              <p className="text-5xl font-bold">{riskScore.composite}</p>
              <p className="text-sm text-zinc-400">{riskScore.riskLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Rating
              </p>
              <p className="text-2xl font-semibold text-amber-300">
                {riskScore.rating.replace("_", " ")}
              </p>
              <p className="text-xs text-zinc-500">
                {riskScore.strategy} v{riskScore.strategyVersion}
              </p>
            </div>
          </div>
        </section>

        <KpiStrip items={kpiStrip} />
        <ComponentScores components={scoreBreakdown.components} />
        <CardSection title="Valuation" cards={valuationCards} />
        <CardSection title="Financial Health" cards={report.financialHealthCards} />
        <CardSection title="Growth" cards={report.growthCards} />

        <footer className="pt-6 border-t border-zinc-800 text-xs text-zinc-500">
          Not financial advice. Data as of{" "}
          {new Date(report.dataAsOf).toLocaleString()}.
        </footer>
      </div>
    </main>
  );
}

function KpiStrip({ items }: { items: ReadonlyArray<KpiHighlight> }): JSX.Element {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {item.label}
          </p>
          <p className="text-lg font-semibold">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function ComponentScores({
  components,
}: {
  components: ReadonlyArray<ComponentScore>;
}): JSX.Element {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {components.map((c) => (
        <div
          key={c.name}
          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {c.name.replace("_", " ")}
          </p>
          <p className="text-2xl font-semibold">{c.score}</p>
          <p className="text-xs text-zinc-500">
            weight {Math.round(c.weight * 100)}%
          </p>
          {c.note !== null ? (
            <p className="mt-1 text-xs text-amber-300">{c.note}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function CardSection({
  title,
  cards,
}: {
  title: string;
  cards: ReadonlyArray<DataCard>;
}): JSX.Element {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">
              {card.title}
            </h3>
            <dl className="space-y-2">
              {card.items.map((item: DataPoint) => (
                <div
                  key={item.label}
                  className="flex items-baseline justify-between text-sm"
                >
                  <dt className="text-zinc-500">{item.label}</dt>
                  <dd className="font-medium text-zinc-100">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

