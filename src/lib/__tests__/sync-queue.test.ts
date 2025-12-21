import { describe, expect, it, beforeEach } from 'vitest';
import { enqueueSync, peekSyncQueue, dequeueSync, replaceSyncQueue } from '../sync-queue';

const sampleItem = {
    hash: 'hash-1',
    fileName: 'file.pdf',
    data: {
        datosGenerales: {
            titulo: 'Contrato',
            presupuesto: 100,
            moneda: 'EUR',
            plazoEjecucionMeses: 6,
            cpv: ['123'],
            organoContratacion: 'Organo',
        },
        criteriosAdjudicacion: {
            subjetivos: [],
            objetivos: [],
        },
        requisitosTecnicos: {
            funcionales: [],
            normativa: [],
        },
        requisitosSolvencia: {
            economica: {
                cifraNegocioAnualMinima: 1000,
            },
            tecnica: [],
        },
        restriccionesYRiesgos: {
            killCriteria: [],
            riesgos: [],
            penalizaciones: [],
        },
        modeloServicio: {
            sla: [],
            equipoMinimo: [],
        },
    },
    userId: 'user-1',
};

describe('sync-queue', () => {
    beforeEach(() => {
        window.localStorage.clear();
        replaceSyncQueue([]);
    });

    it('enqueues and dequeues items (happy path)', () => {
        enqueueSync(sampleItem);
        expect(peekSyncQueue()).toHaveLength(1);
        dequeueSync(sampleItem.hash);
        expect(peekSyncQueue()).toHaveLength(0);
    });

    it('overwrites items with same hash (edge case)', () => {
        enqueueSync(sampleItem);
        enqueueSync({ ...sampleItem, fileName: 'updated.pdf' });
        const items = peekSyncQueue();
        expect(items).toHaveLength(1);
        expect(items[0].fileName).toBe('updated.pdf');
    });

    it('recovers from corrupted storage (error handling)', () => {
        window.localStorage.setItem('licitacion-sync-queue', '{invalid');
        const items = peekSyncQueue();
        expect(items).toEqual([]);
    });
});
