import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BLOCK_NAMES } from '../../_shared/schemas/blocks.ts';
import { runBlockExtraction } from './block-extraction.ts';

Deno.test('runBlockExtraction resumes a fully checkpointed phase without model calls', async () => {
    const blocks = BLOCK_NAMES.map((blockName) => ({
        blockName,
        data: { resumed: blockName },
        evidences: [],
        warnings: [],
        ambiguous_fields: [],
    }));
    let checkpointCalls = 0;

    const result = await runBlockExtraction({
        // No OpenAI surface exists on purpose: a completed checkpoint must not
        // attempt another model call.
        openai: {} as never,
        vectorStoreId: 'vs-resume',
        documentMap: {} as never,
        guideContent: 'guía',
        context: {
            vectorStoreId: 'vs-resume',
            fileNames: ['pliego.pdf'],
            guideExcerpt: '',
            userId: 'user-1',
            requestId: 'worker-1',
        } as never,
        resume: {
            blocks,
            diagnostics: {
                sawRateLimit: true,
                degradedByRateLimit: false,
                degradedBlocks: [],
                emptyDespiteMapBlocks: [],
            },
        },
        onCheckpoint: async () => {
            checkpointCalls += 1;
        },
    });

    assertEquals(result.blocks, blocks);
    assertEquals(result.diagnostics.sawRateLimit, true);
    assertEquals(checkpointCalls, 0);
});

Deno.test('runBlockExtraction honors a zero-size worker slice without touching missing blocks', async () => {
    const firstBlock = {
        blockName: BLOCK_NAMES[0],
        data: { resumed: true },
        evidences: [],
        warnings: [],
        ambiguous_fields: [],
    };

    const result = await runBlockExtraction({
        openai: {} as never,
        vectorStoreId: 'vs-slice',
        documentMap: {} as never,
        guideContent: 'guía',
        context: {
            vectorStoreId: 'vs-slice',
            fileNames: ['pliego.pdf'],
            guideExcerpt: '',
            userId: 'user-1',
            requestId: 'worker-1',
        } as never,
        resume: {
            blocks: [firstBlock],
            diagnostics: {
                sawRateLimit: false,
                degradedByRateLimit: false,
                degradedBlocks: [],
                emptyDespiteMapBlocks: [],
            },
        },
        maxNewBlocks: 0,
    });

    assertEquals(result.blocks, [firstBlock]);
});

// ─── Expectativas de bloque vs. mapa documental ──────────────────────────────
//
// Regresión del incidente 2026-07-28: `criteriosAdjudicacion` volvió vacío en
// un PCAP de 8,5 M€ que sí los llevaba, sin excepción, sin 429 y sin timeout —
// `file_search` no recuperó nada y el modelo, correctamente, no inventó. El
// JSON vacío pasó `jsonShapeGuardrail` (que valida forma, no sustancia) y la
// Fase E acabó acusando al documento del usuario.
//
// Estas pruebas fijan el contraste entre las dos lecturas del corpus. Son
// deterministas y no llaman al modelo: el gate semántico del repo
// (`eval:pliegos:live`) es manual, así que lo que pueda cubrirse sin API key
// tiene que cubrirse aquí.

import {
    BLOCK_EXPECTATIONS,
    documentsPromising,
    isBlockEmpty,
    isEmptyDespiteMap,
} from '../../_shared/schemas/block-expectations.ts';
import { withTargetedRetrieval } from '../prompts/index.ts';

const PCAP = {
    tipo: 'PCAP',
    nombre: 'sscc-exp-0pca.pdf',
    contienePresupuesto: true,
    contienePlazos: false,
    contieneCriterios: true,
    contieneSolvencia: true,
    contieneRequisitos: false,
    contieneRestricciones: false,
    contieneModeloServicio: false,
};
const PPT = {
    tipo: 'PPT',
    nombre: 'sscc-exp-0ppt.pdf',
    contienePresupuesto: false,
    contienePlazos: false,
    contieneCriterios: false,
    contieneSolvencia: false,
    contieneRequisitos: true,
    contieneRestricciones: false,
    contieneModeloServicio: true,
};
const MAP = { documentos: [PCAP, PPT] } as never;

Deno.test('cada bloque con expectativa apunta a una bandera real del mapa', () => {
    // Si alguien renombra una bandera en DocumentEntrySchema, la tabla deja de
    // casar en silencio y el mecanismo se apaga sin que nada falle. Este test
    // es el que lo impide.
    const banderasDelMapa = new Set(Object.keys(PCAP).filter((k) => k.startsWith('contiene')));
    for (const [bloque, bandera] of Object.entries(BLOCK_EXPECTATIONS)) {
        assertEquals(banderasDelMapa.has(bandera), true, `${bloque} apunta a una bandera inexistente: ${bandera}`);
    }
});

Deno.test('documentsPromising devuelve solo los documentos que prometen el bloque', () => {
    assertEquals(
        documentsPromising(MAP, 'criteriosAdjudicacion').map((d) => d.tipo),
        ['PCAP']
    );
    assertEquals(
        documentsPromising(MAP, 'modeloServicio').map((d) => d.tipo),
        ['PPT']
    );
    // Sin expectativa declarada no hay prior y el mecanismo no se activa.
    assertEquals(documentsPromising(MAP, 'datosGenerales'), []);
    assertEquals(documentsPromising(MAP, 'anexosYObservaciones'), []);
    // Un mapa ausente o malformado nunca dispara nada.
    assertEquals(documentsPromising(null, 'criteriosAdjudicacion'), []);
    assertEquals(documentsPromising({ documentos: 'nope' } as never, 'criteriosAdjudicacion'), []);
});

Deno.test('isBlockEmpty distingue vacío de contenido en criterios', () => {
    assertEquals(isBlockEmpty('criteriosAdjudicacion', { subjetivos: [], objetivos: [] }), true);
    assertEquals(isBlockEmpty('criteriosAdjudicacion', {}), true);
    assertEquals(
        isBlockEmpty('criteriosAdjudicacion', { subjetivos: [], objetivos: [{ descripcion: 'Precio' }] }),
        false
    );
    // El umbral por sí solo NO salva la sección: ver el test dedicado más
    // abajo. Esta aserción decía lo contrario y era el bug.
    assertEquals(
        isBlockEmpty('criteriosAdjudicacion', {
            subjetivos: [],
            objetivos: [],
            umbralAnormalidad: { value: 'Baja del 25%', status: 'extraido' },
        }),
        true
    );
});

Deno.test('isBlockEmpty no se deja engañar por los defaults del schema', () => {
    // `EconomicoSchema.moneda` vale 'EUR' aunque no se haya extraído un solo
    // importe: un recorrido genérico daría este bloque por lleno.
    assertEquals(isBlockEmpty('economico', { moneda: 'EUR', desglosePorLotes: [] }), true);
    assertEquals(
        isBlockEmpty('economico', {
            moneda: 'EUR',
            presupuestoBaseLicitacion: { value: null, status: 'no_encontrado' },
        }),
        true
    );
    assertEquals(
        isBlockEmpty('economico', {
            moneda: 'EUR',
            presupuestoBaseLicitacion: { value: 8587086, status: 'extraido' },
        }),
        false
    );
    // Importe legacy sin envolver: sigue contando como contenido.
    assertEquals(isBlockEmpty('economico', { valorEstimadoContrato: 120000 }), false);
});

Deno.test('el umbral de anormalidad NO salva a un bloque de criterios sin criterios', () => {
    // Regresión del job `8e851069`: el bloque volvió con umbralAnormalidad
    // citado (pág. 7) y cero criterios. La primera versión del predicado lo
    // daba por «con contenido», así que no hubo re-consulta y el usuario leyó
    // otra vez que sus documentos no traían los criterios — mientras la Fase E
    // puntuaba la sección VACIO. El predicado tiene que ser al menos tan
    // estricto como la Fase E.
    const soloUmbral = {
        subjetivos: [],
        objetivos: [],
        umbralAnormalidad: {
            value: 'Se aplicará el artículo 149.2 de la LCSP para ofertas anormalmente bajas.',
            status: 'extraido',
            evidence: { quote: 'artículo 149.2', pageHint: '7' },
        },
    };
    assertEquals(isBlockEmpty('criteriosAdjudicacion', soloUmbral), true);
    assertEquals(isEmptyDespiteMap('criteriosAdjudicacion', soloUmbral, MAP), true);
});

Deno.test('isBlockEmpty nunca afirma vacío sobre un bloque que no sabe juzgar', () => {
    // El sesgo es deliberado: un falso "vacío" dispararía re-consultas inútiles
    // y acusaría de fallo a extracciones correctas.
    assertEquals(isBlockEmpty('datosGenerales', {}), false);
    assertEquals(isBlockEmpty('anexosYObservaciones', {}), false);
});

Deno.test('isEmptyDespiteMap solo salta cuando las dos lecturas se contradicen', () => {
    // Caso real del incidente: mapa dice que el PCAP los trae, extracción vacía.
    assertEquals(isEmptyDespiteMap('criteriosAdjudicacion', { subjetivos: [], objetivos: [] }, MAP), true);
    // Vacío pero sin promesa del mapa → el pliego puede no traerlo de verdad.
    assertEquals(isEmptyDespiteMap('restriccionesYRiesgos', { riesgos: [] }, MAP), false);
    // Con promesa y con contenido → nada que hacer.
    assertEquals(isEmptyDespiteMap('criteriosAdjudicacion', { objetivos: [{ descripcion: 'Precio' }] }, MAP), false);
});

Deno.test('la re-consulta dirigida nombra el documento y autoriza el vacío', () => {
    const base = 'Extrae los CRITERIOS DE ADJUDICACIÓN';
    const dirigido = withTargetedRetrieval(base, [{ nombre: 'sscc-exp-0pca.pdf', tipo: 'PCAP' }]);

    assertEquals(dirigido.startsWith(base), true, 'el prompt base se conserva íntegro');
    assertEquals(dirigido.includes('sscc-exp-0pca.pdf'), true, 'debe anclar la búsqueda al fichero concreto');
    // Sin esta cláusula, «búscalo otra vez» se convierte en presión para
    // inventar. Es la línea que no puede caerse al editar el prompt.
    assertEquals(dirigido.includes('NO inventes'), true, 'debe seguir autorizando el resultado vacío');

    // Sin documentos que nombrar no se altera el prompt: repetir la misma
    // llamada sin cambiar nada no arregla un fallo de recuperación.
    assertEquals(withTargetedRetrieval(base, []), base);
});
