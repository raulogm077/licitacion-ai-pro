import { tool } from '../_shared/agents/sdk.ts';
import { z } from 'npm:zod@3.25.76';
import type { StoredAnalysisEnvelope, Citation } from './types.ts';
import { evaluarGoNoGo, type PerfilEmpresa, type RequisitosPliego } from '../../../src/shared/go-no-go.ts';

type ToolDeps = {
    analysisHash: string;
    loadAnalysis: (analysisHash: string) => Promise<StoredAnalysisEnvelope>;
    trackToolUse: (toolName: string) => void;
    /**
     * Perfil del licitador de la sesión. Se inyecta como dependencia y NO se
     * expone a ninguna tool: solo `get_go_no_go` lo consume, y lo que devuelve
     * es el veredicto ya calculado (ADR-002 decisión 7.3).
     */
    loadPerfil?: () => Promise<PerfilEmpresa>;
};

export function createAnalysisTools(deps: ToolDeps) {
    const getAnalysisOverview = tool({
        name: 'get_analysis_overview',
        description: 'Devuelve una visión general del expediente ya analizado.',
        parameters: z.object({}),
        async execute() {
            deps.trackToolUse('get_analysis_overview');
            const analysis = await deps.loadAnalysis(deps.analysisHash);
            const resultRoot = getResultRoot(analysis.data);
            const workflow = getWorkflow(analysis.data);

            return {
                datosGenerales: pickObject(resultRoot, 'datosGenerales'),
                criteriosAdjudicacion: pickObject(resultRoot, 'criteriosAdjudicacion'),
                requisitosSolvencia: pickObject(resultRoot, 'requisitosSolvencia'),
                restriccionesYRiesgos: pickObject(resultRoot, 'restriccionesYRiesgos'),
                quality: workflow?.quality ?? null,
                warnings: workflow?.quality?.warnings ?? [],
                updatedAt: analysis.updated_at ?? null,
            };
        },
    });

    const getFieldValue = tool({
        name: 'get_field_value',
        description: 'Obtiene el valor exacto de un campo del análisis usando un fieldPath.',
        parameters: z.object({
            fieldPath: z.string(),
        }),
        async execute({ fieldPath }) {
            deps.trackToolUse('get_field_value');
            const analysis = await deps.loadAnalysis(deps.analysisHash);
            const resultRoot = getResultRoot(analysis.data);
            const raw = resolveFieldPath(resultRoot, fieldPath);

            return {
                fieldPath,
                value: normalizeFieldValue(raw),
                found: raw !== undefined,
            };
        },
    });

    const getFieldEvidence = tool({
        name: 'get_field_evidence',
        description: 'Obtiene las evidencias asociadas a un fieldPath del análisis persistido.',
        parameters: z.object({
            fieldPath: z.string(),
        }),
        async execute({ fieldPath }) {
            deps.trackToolUse('get_field_evidence');
            const analysis = await deps.loadAnalysis(deps.analysisHash);

            return {
                fieldPath,
                citations: extractEvidence(analysis.data, fieldPath),
            };
        },
    });

    const listQualityWarnings = tool({
        name: 'list_quality_warnings',
        description: 'Lista warnings, campos ambiguos y faltantes detectados por el pipeline.',
        parameters: z.object({}),
        async execute() {
            deps.trackToolUse('list_quality_warnings');
            const analysis = await deps.loadAnalysis(deps.analysisHash);
            const workflow = getWorkflow(analysis.data);

            return workflow?.quality ?? {};
        },
    });

    const searchAnalysisText = tool({
        name: 'search_analysis_text',
        description: 'Busca texto relevante dentro del análisis persistido y devuelve coincidencias con fieldPath.',
        parameters: z.object({
            query: z.string().min(1),
        }),
        async execute({ query }) {
            deps.trackToolUse('search_analysis_text');
            const analysis = await deps.loadAnalysis(deps.analysisHash);
            const resultRoot = getResultRoot(analysis.data);

            return {
                query,
                matches: searchInObject(resultRoot, query),
            };
        },
    });

    /**
     * Go/No-Go del licitador sobre el expediente cargado (ADR-002 Paso 5).
     *
     * **Devuelve el veredicto, nunca el perfil.** Es la decisión 7.3 y la razón
     * de que el cálculo ocurra aquí y no en el prompt: si el modelo recibiera
     * `PerfilEmpresa` en crudo, la facturación, los clientes y los importes de
     * la empresa viajarían a OpenAI en cada conversación, y no hacen falta para
     * responder «¿cumplo la solvencia?». Lo que sale de esta función es una
     * lista de chequeos con estado, motivo y el campo que falta.
     *
     * El estado `no_verificable` llega tal cual al modelo: un chequeo sin dato
     * no es un incumplimiento, y dejar que el modelo lo interprete como tal
     * haría que el copiloto desaconseje una licitación a la que el usuario sí
     * podía presentarse.
     */
    const getGoNoGo = tool({
        name: 'get_go_no_go',
        description:
            'Evalúa si el licitador cumple los requisitos de solvencia del expediente. ' +
            'Devuelve chequeos con estado cumple/no_cumple/no_verificable. ' +
            'Un chequeo "no_verificable" significa que falta un dato del perfil, NO que se incumpla.',
        parameters: z.object({}),
        async execute() {
            deps.trackToolUse('get_go_no_go');

            if (!deps.loadPerfil) {
                return {
                    disponible: false,
                    motivo: 'El perfil de empresa no está disponible en esta sesión.',
                };
            }

            const analysis = await deps.loadAnalysis(deps.analysisHash);
            const resultRoot = getResultRoot(analysis.data);
            const requisitos = extraerRequisitos(resultRoot);
            const perfil = await deps.loadPerfil();
            const veredicto = evaluarGoNoGo(requisitos, perfil);

            // Se enumeran los campos de salida uno a uno en vez de propagar el
            // objeto entero: así, si el veredicto crece con algo derivado del
            // perfil, hay que añadirlo aquí a mano y alguien lo mira.
            return {
                disponible: true,
                veredicto: veredicto.veredicto,
                // `detalle` NO se envía. Es una frase pensada para mostrar al
                // usuario y cita las cifras comparadas —«VAN de 3.000.000 €
                // frente a 1.500.000 € exigidos»—, así que el primer número es
                // del licitador. Mandarlo sería exactamente la fuga que la
                // decisión 7.3 evita, disfrazada de texto explicativo. El
                // modelo tiene estado, chequeo y campos que faltan: suficiente
                // para responder «¿cumplo la solvencia?» sin las cifras. Las
                // ve el usuario en el panel, que es local.
                chequeos: veredicto.chequeos.map((c) => ({
                    id: c.id,
                    estado: c.estado,
                    guia: c.guia,
                    camposFaltantes: c.camposFaltantes ?? [],
                })),
                camposFaltantes: veredicto.camposFaltantes,
            };
        },
    });

    return [getAnalysisOverview, getFieldValue, getFieldEvidence, listQualityWarnings, searchAnalysisText, getGoNoGo];
}

/**
 * Extrae del análisis persistido lo que el motor necesita del PLIEGO.
 *
 * Los campos llegan como `TrackedField` o como valor plano según su antigüedad,
 * así que se desenvuelven igual que en el frontend. Un campo ausente se pasa
 * como `undefined` y no como `0`: el motor distingue «no declarado» de «cero»,
 * y colapsarlos aquí destruiría esa distinción antes de que llegue a decidir.
 */
export function extraerRequisitos(resultRoot: Record<string, unknown>): RequisitosPliego {
    const solvencia = pickObject(resultRoot, 'requisitosSolvencia');
    const generales = pickObject(resultRoot, 'datosGenerales');
    const economica = solvencia && typeof solvencia === 'object' ? (solvencia as Record<string, unknown>) : {};
    const eco = economica.economica as Record<string, unknown> | undefined;

    return {
        cifraNegocioAnualMinima: desenvolverNumero(eco?.cifraNegocioAnualMinima),
        presupuestoBaseLicitacion: desenvolverNumero(
            (pickObject(resultRoot, 'economico') as Record<string, unknown> | null)?.presupuestoBaseLicitacion
        ),
        duracionMeses: desenvolverNumero(generales ? (generales as Record<string, unknown>).plazoEjecucionMeses : null),
        cpv: desenvolverArray(generales ? (generales as Record<string, unknown>).cpv : null),
        // El pliego puede fijar el importe mínimo en varias entradas de
        // solvencia técnica. Se toma el mayor: cumplir el más exigente implica
        // cumplir los demás, y quedarse con el primero dejaría fuera al que
        // realmente decide.
        importeMinimoProyectosSimilares: Array.isArray(economica.tecnica)
            ? (economica.tecnica as Array<Record<string, unknown>>)
                  .map((t) => desenvolverNumero(t.importeMinimoProyecto))
                  .filter((n): n is number => typeof n === 'number')
                  .reduce<number | undefined>((max, n) => (max === undefined || n > max ? n : max), undefined)
            : undefined,
    };
}

function desenvolverNumero(raw: unknown): number | undefined {
    const valor = raw && typeof raw === 'object' && 'value' in raw ? (raw as { value: unknown }).value : raw;
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : undefined;
}

function desenvolverArray(raw: unknown): string[] {
    const valor =
        raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw
            ? (raw as { value: unknown }).value
            : raw;
    return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

export function getResultRoot(data: Record<string, unknown>): Record<string, unknown> {
    if (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) {
        return data.result as Record<string, unknown>;
    }
    return data;
}

export function getWorkflow(data: Record<string, unknown>): Record<string, any> | null {
    if (data.workflow && typeof data.workflow === 'object' && !Array.isArray(data.workflow)) {
        return data.workflow as Record<string, any>;
    }
    return null;
}

function pickObject(root: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const value = root[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return null;
}

export function resolveFieldPath(root: Record<string, unknown>, fieldPath: string): unknown {
    return fieldPath.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            return undefined;
        }
        return (current as Record<string, unknown>)[segment];
    }, root);
}

export function normalizeFieldValue(raw: unknown): unknown {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as Record<string, unknown>)) {
        const tracked = raw as Record<string, unknown>;
        return {
            value: tracked.value ?? null,
            status: tracked.status ?? null,
            warnings: tracked.warnings ?? [],
        };
    }
    return raw ?? null;
}

export function extractEvidence(data: Record<string, unknown>, fieldPath: string): Citation[] {
    const citations: Citation[] = [];
    const resultRoot = getResultRoot(data);
    const raw = resolveFieldPath(resultRoot, fieldPath);

    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'evidence' in (raw as Record<string, unknown>)) {
        const evidence = (raw as Record<string, unknown>).evidence;
        if (isEvidenceLike(evidence)) {
            citations.push({
                fieldPath,
                quote: evidence.quote,
                pageHint: evidence.pageHint ?? null,
                confidence: evidence.confidence ?? null,
            });
        }
    }

    if (
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        'cita' in (raw as Record<string, unknown>) &&
        typeof (raw as Record<string, unknown>).cita === 'string'
    ) {
        citations.push({
            fieldPath,
            quote: String((raw as Record<string, unknown>).cita),
            pageHint: null,
            confidence: null,
        });
    }

    const workflow = getWorkflow(data);
    const workflowEvidences = Array.isArray(workflow?.evidences) ? workflow?.evidences : [];

    for (const item of workflowEvidences) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const candidate = item as Record<string, unknown>;
        const candidatePath = typeof candidate.fieldPath === 'string' ? candidate.fieldPath : undefined;

        if (candidatePath !== fieldPath) {
            continue;
        }

        if (typeof candidate.quote !== 'string') {
            continue;
        }

        citations.push({
            fieldPath: candidatePath ?? null,
            quote: candidate.quote,
            pageHint: typeof candidate.pageHint === 'string' ? candidate.pageHint : null,
            confidence: typeof candidate.confidence === 'number' ? candidate.confidence : null,
        });
    }

    return dedupeCitations(citations);
}

export function searchInObject(
    root: Record<string, unknown>,
    query: string
): Array<{ fieldPath: string; excerpt: string }> {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

    const matches: Array<{ fieldPath: string; excerpt: string }> = [];

    visitNode(root, '', (fieldPath, value) => {
        const text = stringifyLeaf(value);
        if (!text) {
            return;
        }

        const normalized = text.toLowerCase();
        if (terms.every((term) => normalized.includes(term))) {
            matches.push({
                fieldPath,
                excerpt: text.length > 280 ? `${text.slice(0, 277)}...` : text,
            });
        }
    });

    return matches.slice(0, 10);
}

function visitNode(value: unknown, path: string, visitor: (fieldPath: string, value: unknown) => void) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            visitNode(item, path ? `${path}.${index}` : String(index), visitor);
        });
        return;
    }

    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            visitNode(child, path ? `${path}.${key}` : key, visitor);
        }
        return;
    }

    if (path) {
        visitor(path, value);
    }
}

function stringifyLeaf(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
}

function isEvidenceLike(value: unknown): value is Citation {
    return !!value && typeof value === 'object' && typeof (value as Citation).quote === 'string';
}

function dedupeCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    const deduped: Citation[] = [];

    for (const citation of citations) {
        const key = JSON.stringify(citation);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(citation);
    }

    return deduped;
}
