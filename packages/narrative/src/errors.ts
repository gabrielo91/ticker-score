/**
 * Structured errors emitted by narrative providers. Carrying the provider
 * name + a short `code` lets the orchestrator decide what to surface (or
 * suppress) without having to parse error messages.
 */
export type NarrativeErrorCode =
  | "NOT_CONFIGURED" // No API key / unavailable
  | "TRANSPORT" // Network / HTTP failure
  | "RATE_LIMITED" // Provider 429
  | "SCHEMA" // Model output failed Zod validation
  | "TIMEOUT" // Request exceeded budget
  | "REFUSED" // Model refused / safety filter
  | "UNKNOWN";

export class NarrativeError extends Error {
  readonly code: NarrativeErrorCode;
  readonly providerName: string;
  readonly details: string | null;

  constructor(
    providerName: string,
    code: NarrativeErrorCode,
    message: string,
    details: string | null = null,
  ) {
    super(`[${providerName}] ${code}: ${message}`);
    this.name = "NarrativeError";
    this.code = code;
    this.providerName = providerName;
    this.details = details;
  }
}

