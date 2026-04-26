import { describe, expect, it, vi } from "vitest";
import { isErr, isOk } from "@darkscore/types";
import { RateLimiter, YahooClient, type YahooClientOptions } from "./client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const SESSION_URL = "https://example.test/seed";
const CRUMB_URL = "https://example.test/getcrumb";

/**
 * Build a fetch mock that handles the two-step session bootstrap and
 * delegates everything else to `onApi`. Returns the mocked impl plus a
 * factory of pre-wired `YahooClient` options.
 */
function withSession(
  onApi: (url: string) => Response | Promise<Response>,
  bootstrap: { setCookie?: string; crumb?: string | Response } = {},
) {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === SESSION_URL) {
      return new Response(null, {
        status: 200,
        headers: {
          "set-cookie": bootstrap.setCookie ?? "A1=token; Path=/; Domain=.yahoo.com",
        },
      });
    }
    if (url === CRUMB_URL) {
      const c = bootstrap.crumb ?? "test-crumb-XYZ";
      return c instanceof Response ? c : new Response(c);
    }
    return onApi(url);
  });
  const opts: YahooClientOptions = {
    fetchImpl,
    sessionBootstrapUrl: SESSION_URL,
    crumbUrl: CRUMB_URL,
  };
  return { fetchImpl, opts };
}

describe("YahooClient — quoteSummary (authenticated)", () => {
  it("bootstraps a session and attaches crumb + cookie", async () => {
    const { fetchImpl, opts } = withSession(() =>
      jsonResponse({ quoteSummary: { result: [], error: null } }),
    );
    const client = new YahooClient(opts);
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isOk(r)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // seed, getcrumb, api
    const apiCall = fetchImpl.mock.calls[2];
    const apiUrl = String(apiCall?.[0] ?? "");
    expect(apiUrl).toContain("/v10/finance/quoteSummary/AMZN");
    expect(apiUrl).toContain("modules=price");
    expect(apiUrl).toContain("crumb=test-crumb-XYZ");
    const headers = (apiCall?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.cookie).toBe("A1=token");
  });

  it("reuses the session across calls", async () => {
    const { fetchImpl, opts } = withSession(() => jsonResponse({}));
    const client = new YahooClient(opts);
    await client.fetchQuoteSummary("AMZN", ["price"]);
    await client.fetchQuoteSummary("MSFT", ["price"]);
    // 1 seed + 1 crumb + 2 api = 4 (no second bootstrap)
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("invalidates and retries once on 401", async () => {
    let apiHit = 0;
    const { fetchImpl, opts } = withSession(() => {
      apiHit++;
      if (apiHit === 1) {
        return new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        });
      }
      return jsonResponse({ quoteSummary: { result: [], error: null } });
    });
    const client = new YahooClient(opts);
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isOk(r)).toBe(true);
    // seed + crumb + 401 + seed + crumb + 200 = 6
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("propagates a non-401 error without retrying", async () => {
    const { fetchImpl, opts } = withSession(
      () =>
        new Response("nope", { status: 503, statusText: "Service Unavailable" }),
    );
    const client = new YahooClient(opts);
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/503/u);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("surfaces a getcrumb 'Too Many Requests' body as an error", async () => {
    const { opts } = withSession(() => jsonResponse({}), {
      crumb: "Too Many Requests",
    });
    const client = new YahooClient(opts);
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/getcrumb/iu);
  });

  it("surfaces missing Set-Cookie on bootstrap", async () => {
    const { opts } = withSession(() => jsonResponse({}), { setCookie: "" });
    const client = new YahooClient(opts);
    const r = await client.fetchQuoteSummary("AMZN", ["price"]);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/cookie/iu);
  });
});

describe("YahooClient — chart (unauthenticated)", () => {
  it("does not bootstrap a session for chart calls", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}));
    const client = new YahooClient({
      fetchImpl,
      sessionBootstrapUrl: SESSION_URL,
      crumbUrl: CRUMB_URL,
    });
    await client.fetchChart("BRK.B", "1y", "1d");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/v8/finance/chart/BRK.B");
  });

  it("returns err on a non-2xx response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("nope", { status: 503, statusText: "Service Unavailable" }),
    );
    const client = new YahooClient({ fetchImpl });
    const r = await client.fetchChart("AMZN", "1y", "1d");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/503/u);
  });

  it("returns err when fetch throws (network error)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("ECONNRESET");
    });
    const client = new YahooClient({ fetchImpl });
    const r = await client.fetchChart("AMZN", "1y", "1d");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toMatch(/ECONNRESET/u);
  });
});

describe("RateLimiter", () => {
  it("admits requests up to the limit immediately", async () => {
    const limiter = new RateLimiter(5, 1000);
    const now = vi.fn(() => 1_000_000);
    const start = Date.now();
    for (let i = 0; i < 5; i++) await limiter.acquire(now);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("waits when the window is full", async () => {
    const limiter = new RateLimiter(2, 50);
    await limiter.acquire();
    await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it("rejects non-positive limits", () => {
    expect(() => new RateLimiter(0)).toThrow(/limit must be > 0/u);
  });
});

