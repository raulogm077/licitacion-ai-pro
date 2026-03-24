interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class SimpleCache {
    private store = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number): void {
        this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    invalidateByPrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    clear(): void {
        this.store.clear();
    }

    get size(): number {
        return this.store.size;
    }
}

export const appCache = new SimpleCache();

export const CACHE_KEYS = {
    ALL_LICITACIONES: 'db:allLicitaciones',
    LICITACION: (hash: string) => `db:licitacion:${hash}`,
    ALL_TEMPLATES: 'tpl:allTemplates',
    TEMPLATE: (id: string) => `tpl:template:${id}`,
} as const;

export const CACHE_TTL = {
    LICITACIONES: 5 * 60 * 1000, // 5 min
    TEMPLATES: 30 * 60 * 1000, // 30 min
    SINGLE_ITEM: 10 * 60 * 1000, // 10 min
} as const;
