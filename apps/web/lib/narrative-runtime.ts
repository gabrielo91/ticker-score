/**
 * Narrative runtime — env-driven `NarrativeProvider` selection for `apps/web`
 * (Spec 002, W4-4). Mirrors `cache-runtime` in spirit: build once per process
 * and memoise on `globalThis` so Next.js HMR / cold-started workers don't
 * recreate the client every request. Server-only — never import from a
 * `"use client"` component (pulls in `@darkscore/narrative`, which uses
 * `node:crypto`).
 *
 * Selection (read at first call, frozen for the process lifetime):
 *   `NARRATIVE_PROVIDER` ∈ `"openai" | "mock" | "none"` (default `"none"`)
 *   `OPENAI_API_KEY`     — required when `NARRATIVE_PROVIDER=openai`
 *   `NARRATIVE_MODEL`    — optional override (default `gpt-4o-mini`)
 *
 * Returns `{ provider: null }` for any miss — the orchestrator surfaces that
 * as `narrativeAvailable: false` and renders the Spec-001 layout.
 */
import type { CacheService } from "@darkscore/cache";
import {
  MockNarrativeProvider,
  NARRATIVE_CACHE_TTL_SECONDS,
  OpenAINarrativeProvider,
  buildNarrativeCacheKey,
} from "@darkscore/narrative";
import { getRootLogger, type Logger } from "@darkscore/observability";
import {
  NarrativeDataSchema,
  isErr,
  type NarrativeData,
  type NarrativeInput,
  type NarrativeProvider,
} from "@darkscore/types";

export type NarrativeProviderId = "openai" | "mock" | "none";

export interface NarrativeRuntimeEnv {
  readonly NARRATIVE_PROVIDER?: string;
  readonly OPENAI_API_KEY?: string;
  readonly NARRATIVE_MODEL?: string;
}

export interface NarrativeRuntime {
  readonly provider: NarrativeProvider | null;
}

const GLOBAL_KEY = "__darkscoreNarrativeRuntime";
type GlobalWithRuntime = typeof globalThis & {
  [GLOBAL_KEY]?: NarrativeRuntime;
};

/**
 * Pure factory — builds a runtime from the supplied env snapshot. Use
 * `getNarrativeRuntime` in production paths; this entry point exists so
 * tests can exercise the selection logic without touching `process.env`.
 */
export function buildNarrativeRuntime(env: NarrativeRuntimeEnv): NarrativeRuntime {
  const id = (env.NARRATIVE_PROVIDER ?? "none").toLowerCase();
  const modelOverride = readNonEmpty(env.NARRATIVE_MODEL);

  if (id === "mock") {
    return {
      provider: new MockNarrativeProvider(
        modelOverride !== null ? { model: modelOverride } : {},
      ),
    };
  }

  if (id === "openai") {
    const apiKey = readNonEmpty(env.OPENAI_API_KEY);
    if (apiKey === null) return { provider: null };
    return {
      provider: new OpenAINarrativeProvider(
        modelOverride !== null
          ? { apiKey, model: modelOverride }
          : { apiKey },
      ),
    };
  }

  return { provider: null };
}

export function getNarrativeRuntime(): NarrativeRuntime {
  const g = globalThis as GlobalWithRuntime;
  const cached = g[GLOBAL_KEY];
  if (cached !== undefined) return cached;
  const runtime = buildNarrativeRuntime({
    NARRATIVE_PROVIDER: process.env.NARRATIVE_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NARRATIVE_MODEL: process.env.NARRATIVE_MODEL,
  });
  // Only cache if provider was successfully built — if env vars weren't
  // available yet (e.g., instrumentation.ts hasn't run), we retry next call.
  if (runtime.provider !== null) {
    g[GLOBAL_KEY] = runtime;
  }
  return runtime;
}

export interface NarrativeCallResult {
  readonly narrative: NarrativeData | null;
  readonly narrativeAvailable: boolean;
}

const FAIL_OPEN: NarrativeCallResult = {
  narrative: null,
  narrativeAvailable: false,
};

/**
 * Cache-first call against the active narrative provider (Constitution C2).
 * Always resolves — any failure (no provider configured, cache miss followed
 * by provider error, schema violation) surfaces as `narrativeAvailable:
 * false`. The page renders the Spec-001 layout in that case (per the spec
 * rollback plan). Cache writes are best-effort and never block the response.
 *
 * Provider errors emit a structured `warn` via `@darkscore/observability`
 * (Spec 003 / C14) so operators can distinguish "feature off" from
 * "provider failed" without losing the fail-open semantics. The optional
 * `logger` parameter lets tests inject a capturing logger; production paths
 * use a process-wide child of the root logger.
 */
export async function runNarrative(
  provider: NarrativeProvider | null,
  cache: CacheService,
  input: NarrativeInput,
  logger: Logger = defaultLogger(),
): Promise<NarrativeCallResult> {
  if (provider === null) return FAIL_OPEN;

  const key = buildNarrativeCacheKey({
    providerName: provider.name,
    model: provider.model,
    input,
  });

  const cached = await cache.get<NarrativeData>(key, (v) =>
    NarrativeDataSchema.parse(v),
  );
  if (cached.ok && cached.data !== null) {
    return { narrative: cached.data, narrativeAvailable: true };
  }

  const generated = await provider.generate(input);
  if (isErr(generated)) {
    logger.warn(
      {
        provider: provider.name,
        model: provider.model,
        ticker: input.ticker.symbol,
        code: extractErrorCode(generated.error),
        message: extractErrorMessage(generated.error),
      },
      "narrative provider failed open",
    );
    return FAIL_OPEN;
  }

  await cache.set(key, generated.data, NARRATIVE_CACHE_TTL_SECONDS);
  return { narrative: generated.data, narrativeAvailable: true };
}

function readNonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

let cachedLogger: Logger | null = null;
function defaultLogger(): Logger {
  if (cachedLogger === null) {
    cachedLogger = getRootLogger().child({ component: "narrative-runtime" });
  }
  return cachedLogger;
}

function extractErrorCode(error: unknown): string {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "UNKNOWN";
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

