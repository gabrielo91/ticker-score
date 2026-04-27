/**
 * `GET /api/providers` — returns the list of data sources the dropdown
 * should render. Sources whose runtime credentials are not configured
 * (e.g. Twelve Data without `TWELVEDATA_API_KEY`, Finnhub without
 * `FINNHUB_API_KEY`) are filtered out so the user cannot select an option
 * that would always 500.
 *
 * Shape:
 *   { ok: true, data: { providers: ProviderOption[], default: string } }
 *
 * The default provider is always included if available; if not, the first
 * available option becomes the default.
 */
import { NextResponse } from "next/server";
import {
  DEFAULT_PROVIDER_ID,
  PROVIDER_OPTIONS,
  type ProviderOption,
} from "@/lib/providers";
import {
  FINNHUB_PROVIDER_NAME,
  TWELVE_DATA_PROVIDER_NAME,
} from "@darkscore/data-providers";

function isAvailable(option: ProviderOption): boolean {
  if (option.id === TWELVE_DATA_PROVIDER_NAME) {
    const key = process.env.TWELVEDATA_API_KEY;
    return typeof key === "string" && key.length > 0;
  }
  if (option.id === FINNHUB_PROVIDER_NAME) {
    const key = process.env.FINNHUB_API_KEY;
    return typeof key === "string" && key.length > 0;
  }
  return true;
}

export function GET(): NextResponse {
  const available = PROVIDER_OPTIONS.filter(isAvailable);
  const defaultId =
    available.find((opt) => opt.id === DEFAULT_PROVIDER_ID)?.id ??
    available[0]?.id ??
    DEFAULT_PROVIDER_ID;
  return NextResponse.json({
    ok: true,
    data: { providers: available, default: defaultId },
  });
}

