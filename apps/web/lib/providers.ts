/**
 * Provider catalog — the single source of truth for which data sources the
 * web app can route a request to.
 *
 * **Important** — this module is imported by a `"use client"` component
 * (`ProviderSelector`), so it must stay browser-safe and CANNOT import
 * `@darkscore/data-providers` (that package pulls in `ioredis`/`dns` via
 * `@darkscore/cache`, which webpack cannot bundle for the client). The
 * provider IDs are intentionally duplicated as string literals here and
 * pinned to the package-side constants by the test in
 * `apps/web/lib/providers.test.ts` — drift will fail CI.
 *
 * Adding a new provider:
 *  1. Register the provider implementation in `report-generator.ts` so the
 *     `ProviderRegistry` knows about it.
 *  2. Append a new `ProviderOption` to `PROVIDER_OPTIONS` below — the
 *     `id` MUST equal the `DataProvider.name` exposed by the package.
 *  3. Add a row to the assertion array in `providers.test.ts`.
 */

export interface ProviderOption {
  /** Stable identifier — matches `DataProvider.name`. Used in the URL. */
  readonly id: string;
  /** Human-readable label rendered in the dropdown. */
  readonly label: string;
  /** When `true`, the provider may be unavailable at runtime (e.g. needs an API key). */
  readonly requiresApiKey: boolean;
}

export const PROVIDER_OPTIONS: ReadonlyArray<ProviderOption> = [
  { id: "twelvedata", label: "Twelve Data", requiresApiKey: true },
  { id: "finnhub", label: "Finnhub", requiresApiKey: true },
];

/** Default source when no `?provider=` query param is supplied. */
export const DEFAULT_PROVIDER_ID = "twelvedata";

export type ProviderId = (typeof PROVIDER_OPTIONS)[number]["id"];

export function isKnownProviderId(value: string): value is ProviderId {
  return PROVIDER_OPTIONS.some((opt) => opt.id === value);
}

/**
 * Coerce an arbitrary string (URL param, localStorage value) to a known
 * provider ID, falling back to the default when unrecognized. Use this on
 * read paths where a silent fallback is preferable to a hard error
 * (e.g. when restoring a persisted preference).
 */
export function resolveProviderId(value: string | null | undefined): ProviderId {
  if (value === null || value === undefined) return DEFAULT_PROVIDER_ID;
  return isKnownProviderId(value) ? value : DEFAULT_PROVIDER_ID;
}

