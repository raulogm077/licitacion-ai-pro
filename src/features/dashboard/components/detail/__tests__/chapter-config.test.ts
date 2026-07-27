import { describe, it, expect } from 'vitest';
import { chapterConfigs, type ChapterConfig, type SubsectionConfig } from '../chapter-config';
import { buildPliegoVM, type PliegoVM } from '../../../model/pliego-vm';
import { LicitacionData } from '../../../../../types';
import { tf } from '../../../../../test-utils/tracked-field-factory';

/**
 * `chapter-config.ts` es el contrato declarativo entre el view-model y el
 * renderizado del dashboard: cada subsección declara cómo extraer sus datos y
 * cómo formatear cada item. Un fallo aquí no rompe el build, se ve como un
 * capítulo en blanco o un badge sin texto, así que conviene ejercitar los
 * extractores y formateadores directamente.
 */

const emptyData = (): LicitacionData =>
    ({
        datosGenerales: {
            titulo: tf('Servicio de mantenimiento'),
            organoContratacion: tf('Ayuntamiento'),
            presupuesto: tf(100000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(24),
            cpv: tf(['50000000']),
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] },
        metadata: { tags: [] },
    }) as unknown as LicitacionData;

const populatedData = (): LicitacionData => {
    const data = emptyData();
    (data.datosGenerales as Record<string, unknown>).fechaLimitePresentacion = '2026-09-30';
    data.criteriosAdjudicacion = {
        objetivos: [
            { descripcion: 'Precio', ponderacion: 60, formula: 'P = 60 * (Bmin/Bi)' },
            { descripcion: 'Plazo', ponderacion: 10 },
        ],
        subjetivos: [
            { descripcion: 'Memoria técnica', ponderacion: 30, detalles: 'Se valora la metodología' },
            { descripcion: 'Mejoras', ponderacion: 0 },
        ],
    } as unknown as LicitacionData['criteriosAdjudicacion'];
    data.requisitosSolvencia = {
        economica: { cifraNegocioAnualMinima: 250000, descripcion: 'Volumen anual en los 3 últimos ejercicios' },
        tecnica: [{ descripcion: 'Tres contratos similares' }, 'Certificado ISO 9001'],
        profesional: [],
    } as unknown as LicitacionData['requisitosSolvencia'];
    data.requisitosTecnicos = {
        funcionales: [
            { requisito: 'Portal web accesible', obligatorio: true },
            { requisito: 'App móvil', obligatorio: false },
            'Integración con terceros',
        ],
        normativa: [{ norma: 'ENS nivel medio' }],
    } as unknown as LicitacionData['requisitosTecnicos'];
    data.restriccionesYRiesgos = {
        killCriteria: [
            { criterio: 'No disponer de clasificación', justificacion: 'Exigido en el PCAP' },
            'Sin sede en la provincia',
        ],
        riesgos: [
            { descripcion: 'Penalización por demora', impacto: 'CRITICO', mitigacionSugerida: 'Plan de contingencia' },
            { descripcion: 'Rotación de equipo', impacto: 'ALTO' },
            { descripcion: 'Cambio normativo', impacto: 'BAJO' },
        ],
        penalizaciones: [],
    } as unknown as LicitacionData['restriccionesYRiesgos'];
    data.modeloServicio = {
        sla: [{ metrica: 'Disponibilidad', objetivo: '99,5%' }, { metrica: 'Tiempo de respuesta' }],
        equipoMinimo: [{ rol: 'Jefe de proyecto', experienciaAnios: 5 }, { rol: 'Técnico' }],
    } as unknown as LicitacionData['modeloServicio'];
    return data;
};

const chapter = (id: string): ChapterConfig => {
    const found = chapterConfigs.find((c) => c.id === id);
    if (!found) throw new Error(`No existe el capítulo ${id}`);
    return found;
};

const subsection = (chapterId: string, subId: string): SubsectionConfig => {
    const found = chapter(chapterId).subsections.find((s) => s.id === subId);
    if (!found) throw new Error(`No existe la subsección ${chapterId}/${subId}`);
    return found;
};

const populatedVM = (): PliegoVM => buildPliegoVM(populatedData());
const emptyVM = (): PliegoVM => buildPliegoVM(emptyData());

describe('chapter-config — contrato global', () => {
    it('todo extractor devuelve un array, tanto con datos como sin ellos', () => {
        for (const vm of [populatedVM(), emptyVM()]) {
            for (const cfg of chapterConfigs) {
                for (const sub of cfg.subsections) {
                    expect(Array.isArray(sub.dataExtractor(vm)), `${cfg.id}/${sub.id}`).toBe(true);
                }
            }
        }
    });

    it('ningún formateador lanza al recorrer todos los items de un análisis poblado', () => {
        const vm = populatedVM();
        for (const cfg of chapterConfigs) {
            cfg.headerBadge?.(vm);
            for (const sub of cfg.subsections) {
                sub.dataExtractor(vm).forEach((item, i) => {
                    expect(() => {
                        sub.itemLabel?.(item, i);
                        sub.itemValue?.(item);
                        sub.itemBadge?.(item);
                        sub.itemSubtext?.(item);
                        sub.isRequired?.(item);
                    }, `${cfg.id}/${sub.id}[${i}]`).not.toThrow();
                });
            }
        }
    });
});

describe('chapter-config — datos generales', () => {
    it('añade la fila de fecha límite solo cuando el pliego la trae', () => {
        const sub = subsection('datos', 'general-rows');

        const withDate = sub.dataExtractor(populatedVM());
        const withoutDate = sub.dataExtractor(emptyVM());

        expect(withDate.map((r) => sub.itemLabel!(r, 0))).toContain('Fecha Límite');
        expect(withoutDate.map((r) => sub.itemLabel!(r, 0))).not.toContain('Fecha Límite');
        expect(withoutDate).toHaveLength(5);
    });

    it('usa los valores ya normalizados por el view-model', () => {
        const sub = subsection('datos', 'general-rows');
        const rows = sub.dataExtractor(populatedVM());
        const titulo = rows.find((r) => sub.itemLabel!(r, 0) === 'Título');

        expect(sub.itemValue!(titulo)).toBe('Servicio de mantenimiento');
    });
});

describe('chapter-config — criterios', () => {
    it('muestra el total en el badge de cabecera solo si hay criterios', () => {
        expect(chapter('criterios').headerBadge!(populatedVM())).toEqual({ text: 'Total: 4' });
        expect(chapter('criterios').headerBadge!(emptyVM())).toBeNull();
    });

    it('expone la fórmula como subtexto y null cuando no existe', () => {
        const sub = subsection('criterios', 'objetivos');
        const [conFormula, sinFormula] = sub.dataExtractor(populatedVM());

        expect(sub.itemSubtext!(conFormula)).toContain('Bmin/Bi');
        expect(sub.itemSubtext!(sinFormula)).toBeNull();
        expect(sub.itemBadge!(conFormula)).toEqual({ text: '60 pts', variant: 'blue' });
    });

    it('expone los detalles del criterio subjetivo y su ponderación', () => {
        const sub = subsection('criterios', 'subjetivos');
        const [conDetalles, sinDetalles] = sub.dataExtractor(populatedVM());

        expect(sub.itemSubtext!(conDetalles)).toContain('metodología');
        expect(sub.itemSubtext!(sinDetalles)).toBeNull();
        expect(sub.itemBadge!(conDetalles)).toEqual({ text: '30 pts', variant: 'purple' });
    });
});

describe('chapter-config — solvencia', () => {
    it('oculta la solvencia económica cuando no hay cifra ni descripción', () => {
        expect(subsection('solvencia', 'economica').dataExtractor(emptyVM())).toEqual([]);
    });

    it('formatea la cifra como moneda y expone la descripción', () => {
        const sub = subsection('solvencia', 'economica');
        const [eco] = sub.dataExtractor(populatedVM());

        expect(sub.itemValue!(eco)).toContain('250.000');
        expect(sub.itemSubtext!(eco)).toContain('Volumen anual');
    });

    it('muestra la sección con descripción aunque la cifra sea cero, sin importe', () => {
        const data = emptyData();
        data.requisitosSolvencia.economica = {
            cifraNegocioAnualMinima: 0,
            descripcion: 'Se acredita por otros medios',
        } as unknown as LicitacionData['requisitosSolvencia']['economica'];
        const sub = subsection('solvencia', 'economica');
        const [eco] = sub.dataExtractor(buildPliegoVM(data));

        expect(eco).toBeDefined();
        expect(sub.itemValue!(eco)).toBe('');
        expect(sub.itemSubtext!(eco)).toContain('otros medios');
    });

    it('ignora la descripción placeholder "No detectado"', () => {
        const data = emptyData();
        data.requisitosSolvencia.economica = {
            cifraNegocioAnualMinima: 0,
            descripcion: 'No detectado',
        } as unknown as LicitacionData['requisitosSolvencia']['economica'];

        expect(subsection('solvencia', 'economica').dataExtractor(buildPliegoVM(data))).toEqual([]);
    });

    it('lee la solvencia técnica tanto de objetos como de strings sueltos', () => {
        const sub = subsection('solvencia', 'tecnica');
        const items = sub.dataExtractor(populatedVM());

        expect(sub.itemLabel!(items[0], 0)).toBe('Tres contratos similares');
        expect(sub.itemLabel!(items[1], 1)).toBe('Certificado ISO 9001');
    });
});

describe('chapter-config — requisitos técnicos', () => {
    it('marca como obligatorio salvo que el pliego diga explícitamente que no', () => {
        const sub = subsection('tecnicos', 'funcionales');
        const [obligatorio, opcional, comoString] = sub.dataExtractor(populatedVM());

        expect(sub.isRequired!(obligatorio)).toBe(true);
        expect(sub.isRequired!(opcional)).toBe(false);
        // Un requisito expresado como string suelto no puede negar la obligatoriedad.
        expect(sub.isRequired!(comoString)).toBe(true);
        expect(sub.itemLabel!(comoString, 2)).toBe('Integración con terceros');
    });

    it('devuelve cadena vacía si al item le falta la clave esperada', () => {
        const sub = subsection('tecnicos', 'normativa');

        expect(sub.itemLabel!({ otraClave: 'x' }, 0)).toBe('');
        expect(sub.itemLabel!(null, 0)).toBe('');
        expect(sub.itemLabel!(subsection('tecnicos', 'normativa').dataExtractor(populatedVM())[0], 0)).toBe(
            'ENS nivel medio'
        );
    });
});

describe('chapter-config — riesgos', () => {
    it('mapea el impacto del riesgo a la variante visual correcta', () => {
        const sub = subsection('riesgos', 'riesgos-items');
        const [critico, alto, bajo] = sub.dataExtractor(populatedVM());

        expect(sub.itemBadge!(critico)).toEqual({ text: 'CRITICO', variant: 'destructive' });
        expect(sub.itemBadge!(alto)).toEqual({ text: 'ALTO', variant: 'warning' });
        expect(sub.itemBadge!(bajo)).toEqual({ text: 'BAJO', variant: 'secondary' });
    });

    it('expone la mitigación sugerida cuando existe', () => {
        const sub = subsection('riesgos', 'riesgos-items');
        const [conMitigacion, sinMitigacion] = sub.dataExtractor(populatedVM());

        expect(sub.itemSubtext!(conMitigacion)).toBe('Plan de contingencia');
        expect(sub.itemSubtext!(sinMitigacion)).toBeNull();
    });

    it('acepta kill criteria como objeto con justificación y como string suelto', () => {
        const sub = subsection('riesgos', 'killCriteria');
        const [comoObjeto, comoString] = sub.dataExtractor(populatedVM());

        expect(sub.itemLabel!(comoObjeto, 0)).toBe('No disponer de clasificación');
        expect(sub.itemSubtext!(comoObjeto)).toBe('Exigido en el PCAP');
        expect(sub.itemLabel!(comoString, 1)).toBe('Sin sede en la provincia');
        expect(sub.itemSubtext!(comoString)).toBeNull();
    });
});

describe('chapter-config — modelo de servicio', () => {
    it('prefija el objetivo del SLA y lo omite si no está', () => {
        const sub = subsection('servicio', 'sla');
        const [conObjetivo, sinObjetivo] = sub.dataExtractor(populatedVM());

        expect(sub.itemSubtext!(conObjetivo)).toBe('Objetivo: 99,5%');
        expect(sub.itemSubtext!(sinObjetivo)).toBeNull();
        expect(sub.itemSubtext!('sla como string')).toBeNull();
    });

    it('muestra los años de experiencia como badge solo cuando se especifican', () => {
        const sub = subsection('servicio', 'equipoMinimo');
        const [conExperiencia, sinExperiencia] = sub.dataExtractor(populatedVM());

        expect(sub.itemBadge!(conExperiencia)).toEqual({ text: '5 años', variant: 'secondary' });
        expect(sub.itemBadge!(sinExperiencia)).toBeNull();
        expect(sub.itemBadge!('rol como string')).toBeNull();
    });
});
