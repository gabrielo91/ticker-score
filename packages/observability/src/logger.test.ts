/**
 * Logger factory + singleton contract (Spec 003 / C14).
 */
import { afterEach, describe, expect, it } from "vitest";
import { Writable } from "node:stream";

import {
  createLogger,
  getRootLogger,
  resetRootLoggerForTests,
} from "./logger.js";

function capture(): {
  destination: Writable;
  lines(): Array<Record<string, unknown>>;
} {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString("utf8"));
      cb();
    },
  });
  return {
    destination,
    lines(): Array<Record<string, unknown>> {
      return chunks
        .join("")
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    },
  };
}

afterEach(() => {
  resetRootLoggerForTests();
  delete process.env.LOG_LEVEL;
});

describe("createLogger", () => {
  it("emits structured JSON with the supplied level and message", () => {
    const cap = capture();
    const log = createLogger({ level: "info", destination: cap.destination });
    log.info({ ticker: "AAPL" }, "ok");
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    const line = lines[0] as Record<string, unknown>;
    expect(line["level"]).toBe(30); // pino info = 30
    expect(line["msg"]).toBe("ok");
    expect(line["ticker"]).toBe("AAPL");
    expect(typeof line["time"]).toBe("string"); // iso timestamp
  });

  it("filters below the configured level", () => {
    const cap = capture();
    const log = createLogger({ level: "warn", destination: cap.destination });
    log.info({}, "skipped");
    log.warn({}, "kept");
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.["msg"]).toBe("kept");
  });

  it("attaches base fields to every line", () => {
    const cap = capture();
    const log = createLogger({
      level: "info",
      base: { service: "darkscore" },
      destination: cap.destination,
    });
    log.info({}, "first");
    log.info({}, "second");
    const lines = cap.lines();
    expect(lines.every((l) => l["service"] === "darkscore")).toBe(true);
  });

  it("supports child loggers carrying component context", () => {
    const cap = capture();
    const root = createLogger({ level: "info", destination: cap.destination });
    const child = root.child({ component: "narrative-runtime" });
    child.warn({ ticker: "AAPL" }, "fail-open");
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    const line = lines[0] as Record<string, unknown>;
    expect(line["component"]).toBe("narrative-runtime");
    expect(line["ticker"]).toBe("AAPL");
  });

  it("honours LOG_LEVEL env when no explicit level is supplied", () => {
    process.env.LOG_LEVEL = "error";
    const cap = capture();
    const log = createLogger({ destination: cap.destination });
    log.warn({}, "filtered");
    log.error({}, "kept");
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.["msg"]).toBe("kept");
  });

  it("ignores an unknown LOG_LEVEL and falls back to info", () => {
    process.env.LOG_LEVEL = "shouty";
    const cap = capture();
    const log = createLogger({ destination: cap.destination });
    log.debug({}, "filtered");
    log.info({}, "kept");
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.["msg"]).toBe("kept");
  });
});

describe("getRootLogger", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getRootLogger();
    const b = getRootLogger();
    expect(a).toBe(b);
  });

  it("rebuilds after resetRootLoggerForTests", () => {
    const a = getRootLogger();
    resetRootLoggerForTests();
    const b = getRootLogger();
    expect(a).not.toBe(b);
  });
});

