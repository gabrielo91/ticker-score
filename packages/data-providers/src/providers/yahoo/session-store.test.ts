import { describe, expect, it } from "vitest";
import { CacheService, type CacheBackend } from "@darkscore/cache";
import {
  CachedSessionStore,
  DEFAULT_SESSION_TTL_SECONDS,
  InMemorySessionStore,
} from "./session-store.js";

const SESSION = { cookie: "A3=token", crumb: "abc" } as const;

describe("InMemorySessionStore", () => {
  it("returns null on miss and round-trips a set value", async () => {
    const store = new InMemorySessionStore();
    expect(await store.get()).toBeNull();
    await store.set(SESSION);
    expect(await store.get()).toEqual(SESSION);
  });

  it("expires after the configured TTL", async () => {
    let now = 1_000;
    const store = new InMemorySessionStore({ ttlSeconds: 5, now: () => now });
    await store.set(SESSION);
    now += 4_999;
    expect(await store.get()).toEqual(SESSION);
    now += 2;
    expect(await store.get()).toBeNull();
  });

  it("`del` clears the cached entry", async () => {
    const store = new InMemorySessionStore();
    await store.set(SESSION);
    await store.del();
    expect(await store.get()).toBeNull();
  });

  it("uses a sensible default TTL", () => {
    expect(DEFAULT_SESSION_TTL_SECONDS).toBe(300);
  });
});

class MapBackend implements CacheBackend {
  private readonly store = new Map<string, string>();
  readonly opCount = { get: 0, set: 0, del: 0 };

  async get(key: string): Promise<string | null> {
    this.opCount.get++;
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<"OK"> {
    this.opCount.set++;
    this.store.set(key, value);
    return "OK";
  }
  async del(...keys: string[]): Promise<number> {
    this.opCount.del++;
    let removed = 0;
    for (const k of keys) if (this.store.delete(k)) removed++;
    return removed;
  }
  async scan(): Promise<[string, string[]]> {
    return ["0", []];
  }
}

describe("CachedSessionStore", () => {
  it("writes through to the backing cache and reads back", async () => {
    const backend = new MapBackend();
    const store = new CachedSessionStore(new CacheService(backend));
    await store.set(SESSION);
    expect(backend.opCount.set).toBe(1);
    // Force a backend read by constructing a sibling that shares the cache
    // but has no in-memory memo populated.
    const sibling = new CachedSessionStore(new CacheService(backend));
    expect(await sibling.get()).toEqual(SESSION);
    expect(backend.opCount.get).toBe(1);
  });

  it("memoises in-process reads to avoid Redis round-trips per call", async () => {
    const backend = new MapBackend();
    const store = new CachedSessionStore(new CacheService(backend));
    await store.set(SESSION);
    // First get hits the memo (set populated it), so backend.get stays at 0
    expect(await store.get()).toEqual(SESSION);
    expect(await store.get()).toEqual(SESSION);
    expect(backend.opCount.get).toBe(0);
  });

  it("`del` clears both the memo and the backend", async () => {
    const backend = new MapBackend();
    const store = new CachedSessionStore(new CacheService(backend));
    await store.set(SESSION);
    await store.del();
    expect(backend.opCount.del).toBe(1);
    expect(await store.get()).toBeNull();
  });

  it("treats malformed cached payloads as a miss", async () => {
    // Backend that always returns a payload missing required fields.
    class GarbageBackend implements CacheBackend {
      async get(): Promise<string | null> {
        return JSON.stringify({ cookie: 12 });
      }
      async set(): Promise<"OK"> {
        return "OK";
      }
      async del(): Promise<number> {
        return 0;
      }
      async scan(): Promise<[string, string[]]> {
        return ["0", []];
      }
    }
    const store = new CachedSessionStore(new CacheService(new GarbageBackend()));
    expect(await store.get()).toBeNull();
  });
});

