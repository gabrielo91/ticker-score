"use client";
/**
 * Stub for W3-3 — replaced by the real implementation in
 * `feat/w3-page2-components`. Floating "Copy report" button that serialises
 * the current `ReportData` payload into the clipboard for easy sharing.
 */
import { useState } from "react";
import type { ReportData } from "@darkscore/types";

export interface ClipboardExportProps {
  readonly report: ReportData;
}

export function ClipboardExport({ report }: ClipboardExportProps): JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (): Promise<void> => {
    const payload = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-print-hide="true"
      className="print-hide fixed bottom-6 right-6 z-50 rounded-lg bg-accent-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-blue/35 transition-transform hover:-translate-y-0.5"
    >
      {copied ? "Copied!" : `Copy ${report.ticker.symbol} report`}
    </button>
  );
}
