/**
 * Drift guard — pins the inlined provider ID strings in `providers.ts`
 * to the canonical `DataProvider.name` constants exposed by
 * `@darkscore/data-providers`. The web copy is intentionally inlined
 * (must be browser-safe — see the `providers.ts` header), so this is the
 * mechanism that prevents the dropdown drifting away from what the
 * registry will actually accept.
 */
import { describe, expect, it } from "vitest";
import {
  FINNHUB_PROVIDER_NAME,
  TWELVE_DATA_PROVIDER_NAME,
} from "@darkscore/data-providers";
import {
  DEFAULT_PROVIDER_ID,
  PROVIDER_OPTIONS,
  isKnownProviderId,
  resolveProviderId,
} from "./providers";

describe("provider catalog", () => {
  it("default ID matches the canonical Twelve Data provider name", () => {
    expect(DEFAULT_PROVIDER_ID).toBe(TWELVE_DATA_PROVIDER_NAME);
  });

  it("PROVIDER_OPTIONS IDs match the package-side constants", () => {
    const ids = PROVIDER_OPTIONS.map((opt) => opt.id);
    expect(ids).toContain(TWELVE_DATA_PROVIDER_NAME);
    expect(ids).toContain(FINNHUB_PROVIDER_NAME);
  });

  it("isKnownProviderId accepts known and rejects unknown", () => {
    expect(isKnownProviderId(TWELVE_DATA_PROVIDER_NAME)).toBe(true);
    expect(isKnownProviderId(FINNHUB_PROVIDER_NAME)).toBe(true);
    expect(isKnownProviderId("ghost")).toBe(false);
  });

  it("resolveProviderId falls back to the default for unknowns", () => {
    expect(resolveProviderId(undefined)).toBe(DEFAULT_PROVIDER_ID);
    expect(resolveProviderId(null)).toBe(DEFAULT_PROVIDER_ID);
    expect(resolveProviderId("ghost")).toBe(DEFAULT_PROVIDER_ID);
    expect(resolveProviderId(FINNHUB_PROVIDER_NAME)).toBe(FINNHUB_PROVIDER_NAME);
  });
});

