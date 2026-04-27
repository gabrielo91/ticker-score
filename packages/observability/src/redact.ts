/**
 * Pino redaction paths — the security contract for the platform's logger.
 * Adding a path here without a corresponding test in `redact.test.ts` is a
 * Constitution C14 violation.
 *
 * Pino's redaction syntax matches a fast-path JSON pointer subset; entries
 * are evaluated against every nested object key. Wildcards (`*`) match a
 * single level. We list both bare and wildcarded forms so a payload like
 * `{ apiKey: "x" }` and `{ headers: { authorization: "Bearer x" } }` are
 * both censored.
 */
export const REDACT_PATHS: readonly string[] = [
  // API keys — bare + nested
  "apiKey",
  "*.apiKey",
  "api_key",
  "*.api_key",
  "OPENAI_API_KEY",
  "*.OPENAI_API_KEY",
  "FINNHUB_API_KEY",
  "*.FINNHUB_API_KEY",
  "TWELVEDATA_API_KEY",
  "*.TWELVEDATA_API_KEY",
  // Bearer tokens / auth headers
  "authorization",
  "*.authorization",
  "headers.authorization",
  "*.headers.authorization",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  // Generic secret fields
  "password",
  "*.password",
  "secret",
  "*.secret",
  "credentials",
  "*.credentials",
];

export const REDACT_CENSOR = "[REDACTED]";

