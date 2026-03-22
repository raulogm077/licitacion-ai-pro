// In-memory rate limiter for Edge Functions
// Uses a sliding window approach per user
const rateLimitMap = new Map<string, number[]>();

const MAX_REQUESTS = 10; // Max requests per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];

    // Remove expired entries
    const valid = timestamps.filter(t => now - t < WINDOW_MS);

    if (valid.length >= MAX_REQUESTS) {
        const oldest = valid[0];
        const retryAfterMs = WINDOW_MS - (now - oldest);
        return { allowed: false, retryAfterMs };
    }

    valid.push(now);
    rateLimitMap.set(userId, valid);
    return { allowed: true };
}
