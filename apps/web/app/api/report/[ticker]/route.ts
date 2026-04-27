/**
 * JSON API endpoint mirroring the SSR page at the same ticker. Calls the
 * orchestrator and returns `ReportData` as JSON. Errors degrade to a
 * structured 500 (or 400 for bad ticker shapes) instead of leaking stack
 * traces — Constitution C5.
 *
 * Accepts an optional `?provider=<id>` query param that selects the data
 * source (Twelve Data, Finnhub, …). Unknown providers and bad ticker
 * shapes return 400; provider runtime failures return 500.
 */
import { NextResponse } from "next/server";
import { generateReport } from "@/lib/report-generator";

interface RouteContext {
  readonly params: { readonly ticker: string };
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const providerParam = url.searchParams.get("provider") ?? undefined;
  const result = await generateReport(context.params.ticker, {
    provider: providerParam,
  });
  if (!result.ok) {
    const message = result.error.message;
    const isClientError =
      message.startsWith("Invalid ticker symbol") ||
      message.startsWith("Unknown data provider");
    const status = isClientError ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  return NextResponse.json({ ok: true, data: result.data });
}

