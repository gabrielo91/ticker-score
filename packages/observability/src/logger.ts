/**
 * Process-wide logger factory + singleton (Spec 003 / Constitution C14).
 *
 * - `createLogger(opts?)`  — pure factory, used by tests with an injected
 *   destination so log lines can be asserted on without touching stdout.
 * - `getRootLogger()`      — memoised singleton on `globalThis`, mirrors the
 *   pattern used by `cache-runtime` and `narrative-runtime` so Next.js HMR
 *   does not recreate the logger on every request.
 * - `resetRootLoggerForTests()` — clears the singleton so test suites can
 *   exercise env-driven branches deterministically.
 *
 * Output: structured JSON to stdout. Pretty-printing is the dev shell's job
 * (`pnpm dev | pino-pretty`); this package never ships pino-pretty as a
 * runtime dependency to keep the bundle / boundary surface minimal.
 */
import pino, {
  type DestinationStream,
  type Level,
  type Logger as PinoLogger,
  type LoggerOptions,
} from "pino";

import { REDACT_CENSOR, REDACT_PATHS } from "./redact.js";

export type Logger = PinoLogger;
export type LogLevel = Level;

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  readonly base?: Record<string, unknown>;
  readonly destination?: DestinationStream;
}

const DEFAULT_LEVEL: LogLevel = "info";

const VALID_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

function resolveLevel(explicit: LogLevel | undefined): LogLevel {
  if (explicit !== undefined) return explicit;
  const env = process.env.LOG_LEVEL;
  if (typeof env === "string") {
    const lowered = env.toLowerCase() as LogLevel;
    if (VALID_LEVELS.has(lowered)) return lowered;
  }
  return DEFAULT_LEVEL;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const pinoOptions: LoggerOptions = {
    level: resolveLevel(options.level),
    redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
    base: options.base ?? {},
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return options.destination !== undefined
    ? pino(pinoOptions, options.destination)
    : pino(pinoOptions);
}

const GLOBAL_KEY = "__darkscoreRootLogger";
type GlobalWithLogger = typeof globalThis & {
  [GLOBAL_KEY]?: Logger;
};

export function getRootLogger(): Logger {
  const g = globalThis as GlobalWithLogger;
  const cached = g[GLOBAL_KEY];
  if (cached !== undefined) return cached;
  const logger = createLogger();
  g[GLOBAL_KEY] = logger;
  return logger;
}

export function resetRootLoggerForTests(): void {
  const g = globalThis as GlobalWithLogger;
  delete g[GLOBAL_KEY];
}

