import { LicitacionData } from '../types';
import { tf } from './tracked-field-factory';

export const createMockLicitacionData = (): LicitacionData =>
    ({
        datosGenerales: {
            titulo: tf('Test Licitacion'),
            presupuesto: tf(1000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(12),
            organoContratacion: tf('Test Org'),
            cpv: tf(['1234']),
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] },
        metadata: { tags: [] },
    }) as unknown as LicitacionData;
