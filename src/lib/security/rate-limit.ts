type RateLimitParams = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKET_COUNT = 10000;

function pruneExpiredBuckets(now: number) {
  if (buckets.size <= MAX_BUCKET_COUNT) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(params: RateLimitParams): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const limit = Math.max(1, Math.floor(params.limit));
  const windowMs = Math.max(1000, Math.floor(params.windowMs));
  const existing = buckets.get(params.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, {
      count: 1,
      resetAt: now + windowMs
    });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: 0
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds
    };
  }

  existing.count += 1;
  buckets.set(params.key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0
  };
}
