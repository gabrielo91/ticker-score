/**
 * Server-side report page. Composes the full 2-page DarkScore report from
 * the typed `ReportData` payload returned by the orchestrator. The page
 * itself stays a server component (C12): it does not fetch or compute, only
 * arranges presentational components.
 *
 * Component sources:
 * - W3-2 (Page 1): TickerBar, KPIStrip, RiskGauge, PriceChart, MetricCards,
 *   ScoreBreakdown
 * - W3-3 (Page 2): QuarterlyTable, EarningsUpdate, CatalystsRisks, Verdict,
 *   ClipboardExport (client)
 *
 * Until W3-2/3 PRs merge, the imports point at lightweight stubs in
 * `apps/web/components/report/` so the page builds and types end-to-end.
 */
import type { ReportData } from "@darkscore/types";
import { generateReport } from "@/lib/report-generator";
import { TickerBar } from "@/components/report/TickerBar";
import { CompanyAbout } from "@/components/report/CompanyAbout";
import { HowItWorks } from "@/components/report/HowItWorks";
import { KPIStrip } from "@/components/report/KPIStrip";
import { RiskGauge } from "@/components/report/RiskGauge";
import { PriceChart } from "@/components/report/PriceChart";
import { MetricCards } from "@/components/report/MetricCards";
import { ScoreBreakdown } from "@/components/report/ScoreBreakdown";
import { QuarterlyTable } from "@/components/report/QuarterlyTable";
import { EarningsUpdate } from "@/components/report/EarningsUpdate";
import { CatalystsRisks } from "@/components/report/CatalystsRisks";
import { Verdict } from "@/components/report/Verdict";
import { ClipboardExport } from "@/components/report/ClipboardExport";

interface PageProps {
  readonly params: { readonly ticker: string };
}

export default async function ReportPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const result = await generateReport(params.ticker);
  if (!result.ok) {
    return (
      <ErrorScreen ticker={params.ticker} message={result.error.message} />
    );
  }
  return <ReportView report={result.data} />;
}

function ReportView({ report }: { report: ReportData }): JSX.Element {
  const latestQuarter = report.quarterlyResults[0];
  return (
    <main className="min-h-screen bg-darkscore-bg text-text-primary px-6 py-8">
      <div className="max-w-[1080px] mx-auto space-y-6">
        {/* PAGE 1 — Snapshot & Score */}
        <section className="page space-y-6" aria-label="Snapshot and score">
          <HowItWorks />
          <TickerBar ticker={report.ticker} />
          <CompanyAbout ticker={report.ticker} />
          <KPIStrip
            keyMetrics={report.keyMetrics}
            financials={report.financials}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <RiskGauge
                score={report.riskScore.composite}
                rating={report.riskScore.rating}
              />
            </div>
            <div className="md:col-span-2">
              <PriceChart chart={report.priceChart} />
            </div>
          </div>
          <MetricCards title="Valuation" cards={report.valuationCards} />
          <MetricCards
            title="Financial Health"
            cards={report.financialHealthCards}
          />
          <MetricCards title="Growth" cards={report.growthCards} />
          <ScoreBreakdown breakdown={report.scoreBreakdown} />
        </section>

        {/* PAGE 2 — Deep Dive & Verdict */}
        <section
          className="page page-break space-y-6"
          aria-label="Deep dive and verdict"
        >
          <QuarterlyTable quarters={report.quarterlyResults} />
          {latestQuarter !== undefined ? (
            <EarningsUpdate latestQuarter={latestQuarter} />
          ) : null}
          <CatalystsRisks
            catalysts={report.catalysts}
            risks={report.risks}
          />
          <Verdict
            verdict={report.verdict}
            riskScore={report.riskScore}
          />
        </section>

        <footer className="pt-6 border-t border-darkscore-border text-xs text-text-muted">
          Not financial advice. Generated{" "}
          {new Date(report.generatedAt).toLocaleString()} · Data as of{" "}
          {new Date(report.dataAsOf).toLocaleString()}.
        </footer>
      </div>

      <ClipboardExport reportData={report} />
    </main>
  );
}

function ErrorScreen({
  ticker,
  message,
}: {
  ticker: string;
  message: string;
}): JSX.Element {
  return (
    <main className="min-h-screen bg-darkscore-bg text-text-primary px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Report unavailable</h1>
        <p className="text-text-muted mb-6">
          Could not generate a report for{" "}
          <code className="px-1.5 py-0.5 rounded bg-darkscore-card text-accent-amber font-mono">
            {ticker.toUpperCase()}
          </code>
          .
        </p>
        <pre className="whitespace-pre-wrap rounded-card border border-darkscore-border bg-darkscore-card p-4 text-sm status-red">
          {message}
        </pre>
      </div>
    </main>
  );
}
