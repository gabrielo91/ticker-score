"use client";

/**
 * ProviderSelector — client component that lets the user pick which data
 * source the report is generated from (Twelve Data, Finnhub, …).
 *
 * Behavior:
 *  - On mount, fetches `/api/providers` to get the live list of
 *    server-available sources (so a missing `FINNHUB_API_KEY` removes
 *    Finnhub from the dropdown).
 *  - Renders a `<select>`. Changing it does a client-side navigation to
 *    the same path with `?provider=<id>` so the SSR page re-runs with the
 *    new source.
 *  - Persists the last choice in `localStorage` under
 *    `darkscore.preferredProvider`. The persisted value only kicks in via
 *    explicit URL navigation; it does not auto-redirect (per C12 — no
 *    side effects in render).
 *
 * Per `apps/web/CONSTITUTION.md` (C12) all formatting/business logic is
 * encapsulated in helpers and the JSX itself stays declarative.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DEFAULT_PROVIDER_ID,
  PROVIDER_OPTIONS,
  resolveProviderId,
  type ProviderOption,
} from "@/lib/providers";

const STORAGE_KEY = "darkscore.preferredProvider";

interface ProviderSelectorProps {
  readonly currentProvider: string;
}

interface ProvidersResponse {
  readonly ok: boolean;
  readonly data?: {
    readonly providers: ReadonlyArray<ProviderOption>;
    readonly default: string;
  };
}

function isProvidersResponse(value: unknown): value is ProvidersResponse {
  return typeof value === "object" && value !== null && "ok" in value;
}

export function ProviderSelector({
  currentProvider,
}: ProviderSelectorProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [available, setAvailable] = useState<ReadonlyArray<ProviderOption>>(
    PROVIDER_OPTIONS,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/providers", { cache: "no-store" });
        const json: unknown = await res.json();
        if (!cancelled && isProvidersResponse(json) && json.ok && json.data) {
          setAvailable(json.data.providers);
        }
      } catch {
        // keep the static fallback list — user can still try every source
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, currentProvider);
  }, [currentProvider]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const next = resolveProviderId(event.target.value);
    if (next === currentProvider) return;
    const params = new URLSearchParams();
    if (next !== DEFAULT_PROVIDER_ID) params.set("provider", next);
    const qs = params.toString();
    router.push(qs.length > 0 ? `${pathname}?${qs}` : pathname);
    router.refresh();
  };

  return (
    <div
      className="flex items-center justify-end gap-2 text-xs text-[#94a3b8]"
      aria-label="Data source selector"
    >
      <label htmlFor="provider-select" className="uppercase tracking-widest">
        Data source
      </label>
      <select
        id="provider-select"
        className="bg-[#11131a] border border-[#1e2130] rounded-md px-2 py-1 text-[#f0f0f0] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
        value={currentProvider}
        onChange={handleChange}
      >
        {available.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

