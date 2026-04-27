import { beforeEach, describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { CacheService, DEFAULT_TTL_SECONDS } from "./cache.js";
import type { CacheBackend } from "./client.js";

/**
 * In-memory CacheBackend stub. Mirrors just enough of the ioredis surface
 * exercised by `CacheService` to make the unit tests deterministic.
 */
function createMockBackend(): CacheBackend & {
  store: Map<string, string>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _mode: "EX", _ttl: number) => {
      store.set(key, value);
      return "OK" as const;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    }),
    scan: vi.fn(
      async (
        cursor: string,
        _matchToken: "MATCH",
        pattern: string,
        _countToken: "COUNT",
        count: number,
      ): Promise<[string, string[]]> => {
        const all = [...store.keys()];
        const start = Number(cursor);
        const end = Math.min(start + count, all.length);
        const re = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        const slice = all.slice(start, end).filter((k) => re.test(k));
        const next = end >= all.length ? "0" : String(end);
        return [next, slice];
      },
    ),
  };
}

describe("CacheService", () => {
  let backend: ReturnType<typeof createMockBackend>;
  let cache: CacheService;

  beforeEach(() => {
    backend = createMockBackend();
    cache = new CacheService(backend);
  });

  describe("get", () => {
    it("returns ok(null) on a cache miss", async () => {
      const r = await cache.get<{ x: number }>("missing");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBeNull();
    });

    it("returns ok(value) on a cache hit", async () => {
      backend.store.set("hit", JSON.stringify({ x: 42 }));
      const r = await cache.get<{ x: number }>("hit");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toEqual({ x: 42 });
    });

    it("runs the optional validator on hit", async () => {
      backend.store.set("hit", JSON.stringify({ x: 1 }));
      const validator = (v: unknown): { x: number } => {
        if (typeof v === "object" && v !== null && "x" in v) return v as { x: number };
        throw new Error("bad shape");
      };
      const r = await cache.get("hit", validator);
      expect(isOk(r)).toBe(true);
    });

    it("returns err when the validator throws", async () => {
      backend.store.set("hit", JSON.stringify({ wrong: true }));
      const r = await cache.get("hit", () => {
        throw new Error("nope");
      });
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.message).toMatch(/validator rejected/);
    });

    it("returns err when the stored value is not valid JSON", async () => {
      backend.store.set("bad", "{not json");
      const r = await cache.get("bad");
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.message).toMatch(/not valid JSON/);
    });

    it("returns err when the backend throws", async () => {
      backend.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const r = await cache.get("any");
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.message).toMatch(/ECONNREFUSED/);
    });
  });

  describe("set", () => {
    it("stores values with the default TTL when none is supplied", async () => {
      const r = await cache.set("k", { a: 1 });
      expect(isOk(r)).toBe(true);
      expect(backend.set).toHaveBeenCalledWith(
        "k",
        JSON.stringify({ a: 1 }),
        "EX",
        DEFAULT_TTL_SECONDS,
      );
    });

    it("uses an explicit TTL override", async () => {
      await cache.set("k", "v", 60);
      expect(backend.set).toHaveBeenCalledWith("k", JSON.stringify("v"), "EX", 60);
    });

    it("respects a per-instance default TTL", async () => {
      const c = new CacheService(backend, { defaultTtlSeconds: 30 });
      await c.set("k", "v");
      expect(backend.set).toHaveBeenCalledWith("k", JSON.stringify("v"), "EX", 30);
    });

    it("returns err for non-positive TTL values", async () => {
      const r = await cache.set("k", "v", 0);
      expect(isErr(r)).toBe(true);
    });

    it("returns err when JSON serialization fails", async () => {
      const cyclic: { self?: unknown } = {};
      cyclic.self = cyclic;
      const r = await cache.set("k", cyclic);
      expect(isErr(r)).toBe(true);
    });

    it("returns err when the backend throws", async () => {
      backend.set.mockRejectedValueOnce(new Error("OOM"));
      const r = await cache.set("k", "v");
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.message).toMatch(/OOM/);
    });
  });

  describe("invalidate", () => {
    it("deletes a single key and reports the removed count", async () => {
      backend.store.set("k", "\"v\"");
      const r = await cache.invalidate("k");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBe(1);
      expect(backend.store.has("k")).toBe(false);
    });

    it("returns ok(0) when the key did not exist", async () => {
      const r = await cache.invalidate("nope");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBe(0);
    });

    it("returns err when the backend throws", async () => {
      backend.del.mockRejectedValueOnce(new Error("boom"));
      const r = await cache.invalidate("k");
      expect(isErr(r)).toBe(true);
    });
  });

  describe("invalidatePattern", () => {
    it("removes only the keys matching the pattern", async () => {
      backend.store.set("twelvedata:AMZN:quote:1", "1");
      backend.store.set("twelvedata:AMZN:quote:2", "1");
      backend.store.set("twelvedata:MSFT:quote:1", "1");
      backend.store.set("alpha:AMZN:quote:1", "1");
      const r = await cache.invalidatePattern("twelvedata:AMZN:*");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBe(2);
      expect(backend.store.has("twelvedata:AMZN:quote:1")).toBe(false);
      expect(backend.store.has("twelvedata:AMZN:quote:2")).toBe(false);
      expect(backend.store.has("twelvedata:MSFT:quote:1")).toBe(true);
      expect(backend.store.has("alpha:AMZN:quote:1")).toBe(true);
    });

    it("paginates through SCAN cursors until the cursor returns to 0", async () => {
      backend.store.set("k:1", "1");
      backend.store.set("k:2", "1");
      backend.store.set("k:3", "1");
      const r = await cache.invalidatePattern("k:*", 100);
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBe(3);
      // SCAN was called at least once and the final cursor came back as "0".
      expect(backend.scan.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("returns ok(0) when nothing matches", async () => {
      backend.store.set("a", "1");
      const r = await cache.invalidatePattern("z:*");
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.data).toBe(0);
    });

    it("returns err when the backend throws", async () => {
      backend.scan.mockRejectedValueOnce(new Error("boom"));
      const r = await cache.invalidatePattern("a:*");
      expect(isErr(r)).toBe(true);
    });
  });
});

