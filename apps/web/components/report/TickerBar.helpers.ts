/**
 * Pure helpers for `TickerBar`: price/change formatting and 52-week range
 * marker positioning. Compact number formatting uses the shared helper from
 * `lib/format` (C12: no business logic in JSX).
 */

export function formatPrice(value: number, currency: string): string {
  const sym = currency === "USD" ? "$" : `${currency} `;
  return `${sym}${value.toFixed(2)}`;
}

export function formatChange(abs: number, pct: number, currency: string): string {
  const sym = currency === "USD" ? "$" : `${currency} `;
  const signedAbs =
    abs >= 0 ? `+${sym}${abs.toFixed(2)}` : `-${sym}${Math.abs(abs).toFixed(2)}`;
  const pctValue = pct * 100;
  const signedPct =
    pctValue >= 0 ? `+${pctValue.toFixed(2)}%` : `${pctValue.toFixed(2)}%`;
  return `${signedAbs} (${signedPct})`;
}

export function rangeMarkerPct(
  current: number,
  low: number,
  high: number,
): number {
  const range = high - low;
  const rawPos = range > 0 ? (current - low) / range : 0;
  return Math.max(0, Math.min(1, rawPos)) * 100;
}

