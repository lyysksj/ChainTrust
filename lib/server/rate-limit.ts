/**
 * In-memory sliding-window rate limiter.
 *
 * Scope: per-process. Resets on serverless cold start, not shared across
 * instances. That's deliberate for the hackathon — Redis can drop in later
 * behind the same `checkAndConsume` signature without touching callers.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkAndConsume(
  key: string,
  windowSec: number,
  maxHits: number,
  now: number = Date.now(),
): RateLimitResult {
  const cutoffMs = now - windowSec * 1000;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoffMs);
  if (bucket.hits.length >= maxHits) {
    const oldest = bucket.hits[0];
    const retryAfterMs = oldest + windowSec * 1000 - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: maxHits - bucket.hits.length,
    retryAfterSec: 0,
  };
}

export function peek(key: string): number {
  return buckets.get(key)?.hits.length ?? 0;
}
