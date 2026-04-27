/**
 * Shared display-formatting helpers for the web app. Pure functions only —
 * no I/O, no React. Co-located here so multiple components can format large
 * numbers identically (T/B/M/K compact form) and surface missing values
 * with a uniform caption (`NOT_AVAILABLE`) instead of placeholder glyphs.
 */

/**
 * Caption rendered in place of a value the active provider could not supply.
 * Centralised so every report cell, table cell and clipboard line stays in
 * lockstep — search by symbol if the wording ever needs to change.
 */
export const NOT_AVAILABLE = "Not available";

interface CompactOpts {
  readonly prefix?: string;
}

export function formatCompact(value: number, opts: CompactOpts = {}): string {
  const prefix = opts.prefix ?? "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

