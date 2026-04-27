/**
 * Redaction is the security contract for the logger (Spec 003 / C14).
 * Every path in REDACT_PATHS must be censored, and a representative
 * sample is asserted against actual pino output to catch regressions
 * caused by a future pino major bump or accidental option override.
 */
import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";

import { createLogger } from "./logger.js";
import { REDACT_CENSOR, REDACT_PATHS } from "./redact.js";

function captureOne(): {
  destination: Writable;
  read(): Record<string, unknown>;
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
    read(): Record<string, unknown> {
      const line = chunks.join("").trim().split("\n").pop() ?? "";
      return JSON.parse(line) as Record<string, unknown>;
    },
  };
}

describe("REDACT_PATHS", () => {
  it("includes the platform's three external API keys", () => {
    expect(REDACT_PATHS).toContain("OPENAI_API_KEY");
    expect(REDACT_PATHS).toContain("FINNHUB_API_KEY");
    expect(REDACT_PATHS).toContain("TWELVEDATA_API_KEY");
  });

  it("includes both bare and wildcard forms for nested objects", () => {
    expect(REDACT_PATHS).toContain("apiKey");
    expect(REDACT_PATHS).toContain("*.apiKey");
    expect(REDACT_PATHS).toContain("authorization");
    expect(REDACT_PATHS).toContain("headers.authorization");
  });
});

describe("createLogger redaction", () => {
  it("censors a top-level apiKey", () => {
    const cap = captureOne();
    const log = createLogger({ level: "info", destination: cap.destination });
    log.info({ apiKey: "sk-real-secret" }, "boot");
    const line = cap.read();
    expect(line["apiKey"]).toBe(REDACT_CENSOR);
    expect(JSON.stringify(line)).not.toContain("sk-real-secret");
  });

  it("censors a nested authorization header", () => {
    const cap = captureOne();
    const log = createLogger({ level: "info", destination: cap.destination });
    log.info(
      { headers: { authorization: "Bearer sk-real" } },
      "outbound",
    );
    const line = cap.read();
    const headers = line["headers"] as Record<string, unknown>;
    expect(headers["authorization"]).toBe(REDACT_CENSOR);
    expect(JSON.stringify(line)).not.toContain("sk-real");
  });

  it("censors a wildcard-matched OPENAI_API_KEY field", () => {
    const cap = captureOne();
    const log = createLogger({ level: "info", destination: cap.destination });
    log.info({ env: { OPENAI_API_KEY: "sk-leak" } }, "config");
    const line = cap.read();
    const env = line["env"] as Record<string, unknown>;
    expect(env["OPENAI_API_KEY"]).toBe(REDACT_CENSOR);
    expect(JSON.stringify(line)).not.toContain("sk-leak");
  });

  it("leaves non-secret fields intact", () => {
    const cap = captureOne();
    const log = createLogger({ level: "info", destination: cap.destination });
    log.info(
      { ticker: "AAPL", provider: "openai", status: 429 },
      "narrative provider failed open",
    );
    const line = cap.read();
    expect(line["ticker"]).toBe("AAPL");
    expect(line["provider"]).toBe("openai");
    expect(line["status"]).toBe(429);
    expect(line["msg"]).toBe("narrative provider failed open");
  });
});

