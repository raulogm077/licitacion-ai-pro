import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LicitacionData, SearchFilters } from '../types';

interface LicitacionDB extends DBSchema {
    licitaciones: {
        key: string; // SHA-256 Hash
        value: {
            hash: string;
            fileName: string;
            timestamp: number;
            data: LicitacionData;
        };
        indexes: {
            'timestamp': number;
            'presupuesto': number;
            'tags': string;
            'cliente': string;
            'estado': string;
        };
    };
}

const DB_NAME = 'licitacion-ai-pro-db';
const DB_VERSION = 2; // Incremented for new indices

class DBService {
    private dbPromise: Promise<IDBPDatabase<LicitacionDB>>;

    constructor() {
        this.dbPromise = openDB<LicitacionDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (!db.objectStoreNames.contains('licitaciones')) {
                    const store = db.createObjectStore('licitaciones', { keyPath: 'hash' });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('presupuesto', 'data.datosGenerales.presupuesto');
                    store.createIndex('tags', 'data.metadata.tags', { multiEntry: true });
                    store.createIndex('cliente', 'data.metadata.cliente');
                    store.createIndex('estado', 'data.metadata.estado');
                } else if (oldVersion < 2) {
                    // Migration: add new indices
                    const tx = db.transaction('licitaciones', 'versionchange');
                    const store = tx.objectStore('licitaciones');

                    if (!store.indexNames.contains('tags')) {
                        store.createIndex('tags', 'data.metadata.tags', { multiEntry: true });
                    }
                    if (!store.indexNames.contains('cliente')) {
                        store.createIndex('cliente', 'data.metadata.cliente');
                    }
                    if (!store.indexNames.contains('estado')) {
                        store.createIndex('estado', 'data.metadata.estado');
                    }
                }
            },
        });
    }

    async saveLicitacion(hash: string, fileName: string, data: LicitacionData) {
        const db = await this.dbPromise;
        const now = Date.now();

        // Auto-populate metadata
        if (!data.metadata) {
            data.metadata = {
                tags: [],
                fechaCreacion: now,
                ultimaModificacion: now,
            };
        } else {
            data.metadata.ultimaModificacion = now;
            if (!data.metadata.fechaCreacion) {
                data.metadata.fechaCreacion = now;
            }
        }

        await db.put('licitaciones', {
            hash,
            fileName,
            timestamp: now,
            data
        });
    }

    async updateLicitacion(hash: string, data: LicitacionData) {
        const db = await this.dbPromise;
        const existing = await db.get('licitaciones', hash);

        if (!existing) {
            throw new Error('Licitacion not found');
        }

        // Update metadata timestamp
        if (!data.metadata) {
            data.metadata = { tags: [], ultimaModificacion: Date.now() };
        } else {
            data.metadata.ultimaModificacion = Date.now();
        }

        await db.put('licitaciones', {
            ...existing,
            data,
            timestamp: Date.now(),
        });
    }

    async getLicitacion(hash: string) {
        const db = await this.dbPromise;
        return db.get('licitaciones', hash);
    }

    async getAllLicitaciones() {
        const db = await this.dbPromise;
        return db.getAll('licitaciones');
    }

    async deleteLicitacion(hash: string) {
        const db = await this.dbPromise;
        await db.delete('licitaciones', hash);
    }

    async searchByTags(tags: string[]) {
        const db = await this.dbPromise;
        const index = db.transaction('licitaciones').store.index('tags');
        const results: Array<{ hash: string; fileName: string; timestamp: number; data: LicitacionData }> = [];

        for (const tag of tags) {
            const items = await index.getAll(tag);
            results.push(...items);
        }

        // Remove duplicates
        const uniqueMap = new Map(results.map(item => [item.hash, item]));
        return Array.from(uniqueMap.values());
    }

    async searchByPresupuestoRange(min: number, max: number) {
        const all = await this.getAllLicitaciones();
        return all.filter(item => {
            const presupuesto = item.data.datosGenerales.presupuesto;
            return presupuesto >= min && presupuesto <= max;
        });
    }

    async advancedSearch(filters: SearchFilters) {
        let results = await this.getAllLicitaciones();

        if (filters.tags && filters.tags.length > 0) {
            results = results.filter(item =>
                item.data.metadata?.tags?.some(tag => filters.tags!.includes(tag))
            );
        }

        if (filters.cliente) {
            results = results.filter(item =>
                item.data.metadata?.cliente?.toLowerCase().includes(filters.cliente!.toLowerCase())
            );
        }

        if (filters.presupuestoMin !== undefined) {
            results = results.filter(item =>
                item.data.datosGenerales.presupuesto >= filters.presupuestoMin!
            );
        }

        if (filters.presupuestoMax !== undefined) {
            results = results.filter(item =>
                item.data.datosGenerales.presupuesto <= filters.presupuestoMax!
            );
        }

        if (filters.fechaDesde) {
            results = results.filter(item => item.timestamp >= filters.fechaDesde!);
        }

        if (filters.fechaHasta) {
            results = results.filter(item => item.timestamp <= filters.fechaHasta!);
        }

        if (filters.estado) {
            results = results.filter(item => item.data.metadata?.estado === filters.estado);
        }

        return results;
    }
}

export const dbService = new DBService();
