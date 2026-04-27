/**
 * Sliding-window rate limiter shared by every provider HTTP client. Lives at
 * the package root (not inside a provider subdir) because Finnhub, Twelve
 * Data and any future adapter all need the same primitive — colocating it
 * inside a single provider dir would make removing that provider break the
 * others.
 *
 * Behaviour: `acquire()` blocks until the caller is allowed to issue a
 * request without exceeding `limit` calls in any rolling `windowMs` slice.
 * `now` is injected so tests can drive the clock deterministically.
 */
export const DEFAULT_WINDOW_MS = 1_000;

export class RateLimiter {
  private readonly windowMs: number;
  private readonly limit: number;
  private readonly hits: number[] = [];

  constructor(limit: number, windowMs: number = DEFAULT_WINDOW_MS) {
    if (limit <= 0 || !Number.isFinite(limit)) {
      throw new RangeError(`RateLimiter: limit must be > 0, got ${limit}`);
    }
    this.limit = Math.trunc(limit);
    this.windowMs = windowMs;
  }

  async acquire(now: () => number = Date.now): Promise<void> {
    // eslint-disable-next-line no-constant-condition -- intentional polling loop with internal returns
    while (true) {
      const t = now();
      while (this.hits.length > 0 && (this.hits[0] ?? 0) <= t - this.windowMs) {
        this.hits.shift();
      }
      if (this.hits.length < this.limit) {
        this.hits.push(t);
        return;
      }
      const oldest = this.hits[0] ?? t;
      const wait = Math.max(0, oldest + this.windowMs - t);
      await new Promise<void>((resolve) => setTimeout(resolve, wait + 1));
    }
  }
}

