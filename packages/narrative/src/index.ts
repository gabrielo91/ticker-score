/**
 * `@darkscore/narrative` — public surface.
 *
 * The narrative layer is the LLM-synthesized peer of the data-providers
 * layer (Spec 002). This entry point exposes only the orchestration types
 * and the in-process `MockNarrativeProvider`; real LLM adapters land in
 * later waves and will be re-exported from this module.
 */
export {
  NARRATIVE_CACHE_NAMESPACE,
  NARRATIVE_CACHE_TTL_SECONDS,
  buildNarrativeCacheKey,
  digestInput,
  type NarrativeCacheKeyParts,
} from "./cache-key.js";
export { NarrativeError, type NarrativeErrorCode } from "./errors.js";
export { NarrativeRegistry } from "./registry.js";
export {
  MockNarrativeProvider,
  type MockNarrativeProviderOptions,
} from "./mock-provider.js";

