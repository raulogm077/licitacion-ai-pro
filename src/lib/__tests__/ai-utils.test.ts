import { describe, expect, it } from 'vitest';
import { cleanAndParseJson, LicitacionAIError } from '../ai-utils';

const baseData = {
    datosGenerales: {
        titulo: 'Servicio de soporte',
        presupuesto: 1000,
        moneda: 'EUR',
        plazoEjecucionMeses: 12,
        cpv: ['12345678'],
        organoContratacion: 'Ayuntamiento',
        fechaLimitePresentacion: '2025-01-01',
    },
    criteriosAdjudicacion: {
        subjetivos: [
            { descripcion: 'Calidad', ponderacion: 40, detalles: 'Memoria' },
        ],
        objetivos: [
            { descripcion: 'Precio', ponderacion: 60, formula: 'Pmin/Poferta' },
        ],
    },
    requisitosTecnicos: {
        funcionales: [
            { requisito: 'Soporte 24/7', obligatorio: true, referenciaPagina: 10 },
        ],
        normativa: [
            { norma: 'ISO 27001', descripcion: 'Seguridad' },
        ],
    },
    requisitosSolvencia: {
        economica: {
            cifraNegocioAnualMinima: 50000,
            descripcion: 'Últimos 3 años',
        },
        tecnica: [
            { descripcion: 'Proyectos similares', proyectosSimilaresRequeridos: 2, importeMinimoProyecto: 10000 },
        ],
    },
    restriccionesYRiesgos: {
        killCriteria: ['No presentar garantía'],
        riesgos: [
            { descripcion: 'Plazo ajustado', impacto: 'MEDIO', probabilidad: 'MEDIA', mitigacionSugerida: 'Equipo extra' },
        ],
        penalizaciones: [
            { causa: 'Retraso', sancion: 'Multa' },
        ],
    },
    modeloServicio: {
        sla: [
            { metrica: 'Disponibilidad', objetivo: '99.9%' },
        ],
        equipoMinimo: [
            { rol: 'PM', experienciaAnios: 5, titulacion: 'Ingeniería' },
        ],
    },
};

describe('cleanAndParseJson', () => {
    it('parses valid JSON with markdown wrapper (happy path)', () => {
        const input = `\`\`\`json\n${JSON.stringify(baseData)}\n\`\`\``;
        const parsed = cleanAndParseJson(input);
        expect(parsed.datosGenerales.titulo).toBe('Servicio de soporte');
    });

    it('extracts JSON when extra text is present (edge case)', () => {
        const input = `Nota previa\n${JSON.stringify(baseData)}\nNota final`;
        const parsed = cleanAndParseJson(input);
        expect(parsed.criteriosAdjudicacion.objetivos[0].descripcion).toBe('Precio');
    });

    it('throws LicitacionAIError on invalid JSON (error handling)', () => {
        const input = '{invalid-json';
        expect(() => cleanAndParseJson(input)).toThrowError(LicitacionAIError);
    });
});
