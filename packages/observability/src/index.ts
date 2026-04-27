/**
 * @darkscore/observability — public surface. Named exports only (per package
 * CONSTITUTION). Importers should depend on this entry point so the boundary
 * checker can verify cross-package usage.
 */
export const PACKAGE_NAME = "@darkscore/observability";

export {
  createLogger,
  getRootLogger,
  resetRootLoggerForTests,
  type CreateLoggerOptions,
  type LogLevel,
  type Logger,
} from "./logger.js";

export { REDACT_CENSOR, REDACT_PATHS } from "./redact.js";

