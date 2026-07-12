// In-memory rate limiter for Edge Functions
// Uses a sliding window approach per key (namespace the key per feature,
// e.g. `analyze:<userId>` vs `chat:<userId>`, to keep independent budgets).
//
// ⚠️ Scope: the map lives per worker/isolate ("policy = per_worker" in
// config.toml), so the effective global limit can exceed the configured one
// under multiple isolates and resets on cold starts. Good enough as a cost
// guard; not a hard quota.
const rateLimitMap = new Map<string, number[]>();

const MAX_REQUESTS = 10; // Default max requests per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitOptions {
    maxRequests?: number;
    windowMs?: number;
}

export function checkRateLimit(
    key: string,
    options: RateLimitOptions = {}
): { allowed: boolean; retryAfterMs?: number } {
    const maxRequests = options.maxRequests ?? MAX_REQUESTS;
    const windowMs = options.windowMs ?? WINDOW_MS;
    const now = Date.now();
    const timestamps = rateLimitMap.get(key) || [];

    // Remove expired entries
    const valid = timestamps.filter((t) => now - t < windowMs);

    if (valid.length >= maxRequests) {
        const oldest = valid[0];
        const retryAfterMs = windowMs - (now - oldest);
        return { allowed: false, retryAfterMs };
    }

    valid.push(now);
    rateLimitMap.set(key, valid);
    return { allowed: true };
}
