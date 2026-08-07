import { assertEquals, assertObjectMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
    createAnalysisTools,
    extractEvidence,
    normalizeFieldValue,
    resolveFieldPath,
    searchInObject,
} from './tools.ts';
import { requisitosDesdeAnalisis } from '../../../src/shared/go-no-go.ts';

Deno.test('resolveFieldPath reads nested values', () => {
    const data = {
        datosGenerales: {
            titulo: { value: 'Contrato de limpieza', status: 'extraido' },
        },
    };

    const value = resolveFieldPath(data, 'datosGenerales.titulo');
    assertEquals(value, { value: 'Contrato de limpieza', status: 'extraido' });
});

Deno.test('normalizeFieldValue unwraps tracked field metadata', () => {
    const normalized = normalizeFieldValue({
        value: 120000,
        status: 'extraido',
        warnings: [],
    });

    assertEquals(normalized, {
        value: 120000,
        status: 'extraido',
        warnings: [],
    });
});

Deno.test('extractEvidence merges tracked evidence and workflow evidence', () => {
    const data = {
        result: {
            datosGenerales: {
                presupuesto: {
                    value: 120000,
                    status: 'extraido',
                    evidence: {
                        quote: 'Presupuesto base de licitación: 120.000 EUR',
                        pageHint: '12',
                        confidence: 0.91,
                    },
                },
            },
        },
        workflow: {
            evidences: [
                {
                    fieldPath: 'datosGenerales.presupuesto',
                    quote: 'Presupuesto base de licitación: 120.000 EUR',
                    pageHint: '12',
                    confidence: 0.91,
                },
                {
                    fieldPath: 'datosGenerales.presupuesto',
                    quote: 'El valor estimado del contrato asciende a 120.000 EUR',
                    pageHint: '13',
                    confidence: 0.72,
                },
            ],
        },
    };

    const citations = extractEvidence(data, 'datosGenerales.presupuesto');

    assertEquals(citations.length, 2);
    assertObjectMatch(citations[0], {
        fieldPath: 'datosGenerales.presupuesto',
        quote: 'Presupuesto base de licitación: 120.000 EUR',
        pageHint: '12',
    });
});

Deno.test('searchInObject returns matching leaf paths', () => {
    const data = {
        criteriosAdjudicacion: {
            objetivos: [
                {
                    descripcion: 'Oferta económica',
                    formula: 'Mayor puntuación a la oferta más baja',
                },
            ],
        },
    };

    const matches = searchInObject(data, 'oferta baja');

    assertEquals(matches.length, 1);
    assertEquals(matches[0]?.fieldPath, 'criteriosAdjudicacion.objetivos.0.formula');
});

// ─── Go/No-Go del copiloto (ADR-002 Paso 5) ──────────────────────────────────
//
// La invariante que estos tests protegen es la decisión 7.3: el modelo recibe
// el VEREDICTO, nunca el perfil. Si alguien propaga el objeto entero «porque es
// más cómodo», la facturación y los clientes del licitador empiezan a viajar a
// OpenAI en cada conversación sin que nada falle.

const ANALISIS = {
    data: {
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 1_500_000 },
            tecnica: [{ importeMinimoProyecto: 200_000 }, { importeMinimoProyecto: 500_000 }],
        },
        datosGenerales: { cpv: { value: ['72212000-4'], status: 'extraido' }, plazoEjecucionMeses: 24 },
        economico: { presupuestoBaseLicitacion: { value: 2_000_000, status: 'extraido' } },
    },
};

const PERFIL_CON_DATOS = {
    ejercicios: [{ ejercicio: 2025, volumenNegocio: 4_000_000, volumenAmbito: 3_000_000 }],
    proyectos: [{ cpv: ['72212000-4'], importe: 900_000, fechaFin: '2025-06-01', certificadoBuenaEjecucion: true }],
    acreditaciones: [
        { tipo: 'seguro_rc' as const, identificador: null, importeCobertura: 600_000, fechaCaducidad: null },
    ],
};

/**
 * El SDK expone la ejecución como `invoke(runContext, argsJson)`, no como
 * `execute`. Se llama por ese mismo camino que usa el Runner para que el test
 * ejercite lo que ocurre en producción y no una función interna.
 */
async function invocar(tools: Array<{ name: string }>, nombre: string): Promise<Record<string, unknown>> {
    const t = tools.find((x) => x.name === nombre);
    assert(t, `falta la tool ${nombre}`);
    const invoke = (t as unknown as { invoke: (ctx: unknown, args: string) => Promise<unknown> }).invoke;
    const salida = await invoke({}, '{}');
    return (typeof salida === 'string' ? JSON.parse(salida) : salida) as Record<string, unknown>;
}

function construirTools(loadPerfil?: () => Promise<typeof PERFIL_CON_DATOS>) {
    return createAnalysisTools({
        analysisHash: 'hash',
        loadAnalysis: () => Promise.resolve(ANALISIS as never),
        trackToolUse: () => {},
        loadPerfil: loadPerfil as never,
    });
}

Deno.test('get_go_no_go no filtra ningún dato del perfil al modelo', async () => {
    const tools = construirTools(() => Promise.resolve(PERFIL_CON_DATOS));
    const salida = await invocar(tools, 'get_go_no_go');
    const serializado = JSON.stringify(salida);

    // Los importes del perfil son lo que no puede salir. Se comprueban por
    // valor y no por nombre de campo: renombrar una clave no debe bastar para
    // que un dato de negocio se cuele.
    for (const valorDelPerfil of ['4000000', '3000000', '900000', '600000']) {
        assert(!serializado.includes(valorDelPerfil), `el perfil se filtró al modelo: ${valorDelPerfil}`);
    }
    assert(!serializado.includes('volumenNegocio'));
    assert(!serializado.includes('acreditaciones'));

    // `detalle` queda fuera a propósito: es la frase que cita las cifras
    // comparadas, y una de ellas es del licitador. Este assert es el que este
    // test pilló fallando en la primera ejecución.
    assert(!serializado.includes('detalle'));
});

Deno.test('get_go_no_go devuelve el veredicto con sus chequeos', async () => {
    const tools = construirTools(() => Promise.resolve(PERFIL_CON_DATOS));
    const salida = await invocar(tools, 'get_go_no_go');

    assertEquals(salida.disponible, true);
    assert(typeof salida.veredicto === 'string');
    assert(Array.isArray(salida.chequeos) && (salida.chequeos as unknown[]).length > 0);
});

Deno.test('sin perfil disponible la tool lo dice en vez de inventar un veredicto', async () => {
    // `loadPerfil` ausente es el caso de un despliegue sin la migración
    // aplicada. Devolver «go» ahí sería afirmar sobre datos que no existen.
    const tools = construirTools(undefined);
    const salida = await invocar(tools, 'get_go_no_go');

    assertEquals(salida.disponible, false);
    assertEquals(salida.veredicto, undefined);
});

Deno.test('requisitosDesdeAnalisis desenvuelve TrackedField y toma el importe mínimo mayor', () => {
    const req = requisitosDesdeAnalisis(ANALISIS.data as Record<string, unknown>);

    assertEquals(req.cifraNegocioAnualMinima, 1_500_000);
    assertEquals(req.cpv, ['72212000-4']);
    assertEquals(req.presupuestoBaseLicitacion, 2_000_000);
    // Cumplir el más exigente implica cumplir los demás; quedarse con el
    // primero dejaría fuera al que realmente decide.
    assertEquals(req.importeMinimoProyectosSimilares, 500_000);
});

Deno.test('un campo ausente del pliego llega como undefined, no como 0', () => {
    // `0` y «no declarado» tienen que seguir siendo distinguibles: el motor
    // trata un mínimo de cero como requisito no declarado, y colapsarlos aquí
    // destruiría esa distinción antes de que llegue a decidir.
    const req = requisitosDesdeAnalisis({ datosGenerales: {} });
    assertEquals(req.cifraNegocioAnualMinima, undefined);
    assertEquals(req.presupuestoBaseLicitacion, undefined);
});
