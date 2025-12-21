type RateLimitEntry = {
    count: number;
    windowStart: number;
};

type RateLimiter = {
    check: (key: string) => { allowed: boolean; remaining: number; resetAt: number };
};

export function createRateLimiter(windowMs: number, maxRequests: number): RateLimiter {
    if (windowMs <= 0 || maxRequests <= 0) {
        throw new Error('windowMs y maxRequests deben ser mayores que 0.');
    }

    const store = new Map<string, RateLimitEntry>();

    return {
        check: (key: string) => {
            const now = Date.now();
            const entry = store.get(key);

            if (!entry || now - entry.windowStart >= windowMs) {
                const resetAt = now + windowMs;
                store.set(key, { count: 1, windowStart: now });
                return { allowed: true, remaining: maxRequests - 1, resetAt };
            }

            if (entry.count >= maxRequests) {
                return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs };
            }

            entry.count += 1;
            store.set(key, entry);
            return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.windowStart + windowMs };
        }
    };
}
