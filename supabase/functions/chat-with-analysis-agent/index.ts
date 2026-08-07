import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { run, user as userMessage } from '../_shared/agents/sdk.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';
import { CHAT_MAX_REQUESTS_PER_HOUR, MAX_CHAT_PAYLOAD_BYTES } from '../_shared/config.ts';
import { createAnalysisTools } from './tools.ts';
import type {
    AcreditacionEmpresa,
    EjercicioEmpresa,
    PerfilEmpresa,
    ProyectoEmpresa,
} from '../../../src/shared/go-no-go.ts';
import { createChatAgents } from './agents.ts';
import { getConversationHistory, replaceConversationHistory } from './session.ts';
import { ChatRequestSchema, type ChatRequest, type StoredAnalysisEnvelope } from './types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL o SUPABASE_ANON_KEY no configuradas');
}

/**
 * Auth model:
 *   `verify_jwt = true` (config.toml) means the Supabase platform validates
 *   the bearer token and rejects unauthenticated requests with 401 before
 *   this function is invoked. We still need to *resolve the user* from the
 *   token (for ownership checks against `licitaciones` and
 *   `analysis_chat_sessions`), but we no longer need the manual
 *   reject-on-missing-token block that used to live here.
 */
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(req) });
    }

    try {
        // Token is guaranteed present by verify_jwt=true at the platform layer.
        // We still extract it to resolve the user record for ownership.
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '').trim();

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user },
        } = await supabase.auth.getUser(token);

        if (!user) {
            // verify_jwt=true should have made this unreachable, but defend in
            // depth: if Supabase ever forwards a request whose token resolves to
            // no user, fail closed.
            return jsonError(req, 401, 'No se pudo resolver el usuario');
        }

        const rateCheck = checkRateLimit(`chat:${user.id}`, {
            maxRequests: CHAT_MAX_REQUESTS_PER_HOUR,
        });
        if (!rateCheck.allowed) {
            const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
            return new Response(
                JSON.stringify({
                    error: `Límite de mensajes excedido (${CHAT_MAX_REQUESTS_PER_HOUR}/hora). Reintente en ${retryAfterSec}s.`,
                }),
                {
                    status: 429,
                    headers: {
                        ...getCorsHeaders(req),
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfterSec),
                    },
                }
            );
        }

        // Enforce the size cap on the actual body (content-length can be
        // absent or spoofed), before JSON parsing.
        const rawBody = await req.text();
        if (rawBody.length > MAX_CHAT_PAYLOAD_BYTES) {
            return jsonError(req, 413, 'Payload demasiado grande para el chat (máximo 64KB)');
        }

        const body = ChatRequestSchema.parse(JSON.parse(rawBody)) as ChatRequest;
        await assertAnalysisExists(supabase, body.analysisHash);

        const sessionId = await ensureSession(supabase, user.id, body.analysisHash, body.sessionId, body.message);

        const usedTools = new Set<string>();

        const tools = createAnalysisTools({
            analysisHash: body.analysisHash,
            loadAnalysis: async (analysisHash: string) => await loadAnalysisForUser(supabase, analysisHash),
            trackToolUse: (toolName: string) => usedTools.add(toolName),
            loadPerfil: async () => await loadPerfilForUser(supabase, user.id),
        });

        const { manager } = createChatAgents(tools);
        const existingHistory = await getConversationHistory(sessionId, {
            supabase,
            userId: user.id,
        });
        const input = [...existingHistory, userMessage(body.message)];

        const result = await run(manager, input, {
            context: {
                userId: user.id,
                analysisHash: body.analysisHash,
            },
        });

        const output = result.finalOutput;
        if (!output) {
            return jsonError(req, 500, 'El agente no devolvió una salida final');
        }

        await replaceConversationHistory(sessionId, result.history, {
            supabase,
            userId: user.id,
        });

        return new Response(
            JSON.stringify({
                answer: output.answer,
                citations: output.citations,
                usedTools: [...usedTools],
                sessionId,
            }),
            {
                status: 200,
                headers: {
                    ...getCorsHeaders(req),
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('[chat-with-analysis-agent] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return jsonError(req, 500, message);
    }
});

async function assertAnalysisExists(supabase: ReturnType<typeof createClient>, analysisHash: string) {
    const { data, error } = await supabase.from('licitaciones').select('hash').eq('hash', analysisHash).maybeSingle();

    if (error) {
        throw new Error(`No se pudo verificar el análisis: ${error.message}`);
    }

    if (!data) {
        throw new Error('Análisis no encontrado para el usuario autenticado');
    }
}

/**
 * Perfil del licitador para el Go/No-Go del copiloto (ADR-002 Paso 5).
 *
 * Va explícitamente por `perfil_id` y no por `user_id` en las hijas: es la
 * decisión 7.1 y la razón de que `empresa_perfil` tenga `id` propio. Y el
 * resultado no se devuelve al modelo — lo consume `evaluarGoNoGo` dentro de la
 * tool, que solo emite el veredicto (decisión 7.3).
 *
 * Un perfil inexistente devuelve listas vacías en vez de fallar: el motor lo
 * traduce a «no verificable» nombrando el campo que falta, que es la respuesta
 * correcta para quien todavía no ha rellenado nada.
 */
async function loadPerfilForUser(supabase: ReturnType<typeof createClient>, userId: string): Promise<PerfilEmpresa> {
    const vacio: PerfilEmpresa = { ejercicios: [], proyectos: [], acreditaciones: [] };

    const { data: perfil } = await supabase.from('empresa_perfil').select('id').eq('user_id', userId).maybeSingle();
    if (!perfil) return vacio;

    const perfilId = (perfil as { id: string }).id;
    const [ejercicios, proyectos, acreditaciones] = await Promise.all([
        supabase
            .from('empresa_ejercicio')
            .select('ejercicio, volumen_negocio, volumen_ambito')
            .eq('perfil_id', perfilId),
        supabase
            .from('empresa_proyecto')
            .select('cpv, importe, fecha_fin, certificado_buena_ejecucion')
            .eq('perfil_id', perfilId),
        supabase
            .from('empresa_acreditacion')
            .select('tipo, identificador, importe_cobertura, fecha_caducidad')
            .eq('perfil_id', perfilId),
    ]);

    return {
        ejercicios: (ejercicios.data ?? []).map((r: Record<string, unknown>): EjercicioEmpresa => ({
            ejercicio: Number(r.ejercicio),
            volumenNegocio: r.volumen_negocio as number | null,
            volumenAmbito: r.volumen_ambito as number | null,
        })),
        proyectos: (proyectos.data ?? []).map((r: Record<string, unknown>): ProyectoEmpresa => ({
            cpv: r.cpv as string[] | null,
            importe: r.importe as number | null,
            fechaFin: r.fecha_fin as string | null,
            certificadoBuenaEjecucion: r.certificado_buena_ejecucion as boolean | null,
        })),
        acreditaciones: (acreditaciones.data ?? []).map((r: Record<string, unknown>): AcreditacionEmpresa => ({
            tipo: r.tipo as AcreditacionEmpresa['tipo'],
            identificador: r.identificador as string | null,
            importeCobertura: r.importe_cobertura as number | null,
            fechaCaducidad: r.fecha_caducidad as string | null,
        })),
    };
}

async function loadAnalysisForUser(
    supabase: ReturnType<typeof createClient>,
    analysisHash: string
): Promise<StoredAnalysisEnvelope> {
    const { data, error } = await supabase
        .from('licitaciones')
        .select('hash, data, updated_at')
        .eq('hash', analysisHash)
        .single();

    if (error || !data) {
        throw new Error('Análisis no encontrado para el usuario autenticado');
    }

    return data as StoredAnalysisEnvelope;
}

async function ensureSession(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    analysisHash: string,
    sessionId: string | undefined,
    firstMessage: string
): Promise<string> {
    if (sessionId) {
        const { data, error } = await supabase
            .from('analysis_chat_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .eq('analysis_hash', analysisHash)
            .maybeSingle();

        if (error) {
            throw new Error(`No se pudo leer la sesión: ${error.message}`);
        }

        if (data) {
            return (data as { id: string }).id;
        }

        throw new Error('La sesión indicada no existe o no pertenece al usuario');
    }

    const title = firstMessage.length > 80 ? `${firstMessage.slice(0, 77)}...` : firstMessage;

    const { data, error } = await (supabase.from('analysis_chat_sessions') as any)
        .insert({
            user_id: userId,
            analysis_hash: analysisHash,
            title,
        })
        .select('id')
        .single();

    if (error || !data) {
        throw new Error(`No se pudo crear la sesión: ${error?.message}`);
    }

    return (data as { id: string }).id;
}

function jsonError(req: Request, status: number, message: string) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            ...getCorsHeaders(req),
            'Content-Type': 'application/json',
        },
    });
}
