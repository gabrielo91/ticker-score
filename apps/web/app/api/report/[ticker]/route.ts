/**
 * JSON API endpoint mirroring the SSR page at the same ticker. Calls the
 * orchestrator and returns `ReportData` as JSON. Errors degrade to a
 * structured 500 (or 400 for bad ticker shapes) instead of leaking stack
 * traces — Constitution C5.
 */
import { NextResponse } from "next/server";
import { generateReport } from "@/lib/report-generator";

interface RouteContext {
  readonly params: { readonly ticker: string };
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const result = await generateReport(context.params.ticker);
  if (!result.ok) {
    const message = result.error.message;
    const status = message.startsWith("Invalid ticker symbol") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  return NextResponse.json({ ok: true, data: result.data });
}

