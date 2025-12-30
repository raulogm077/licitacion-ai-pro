/**
 * Vercel Function: Pliegos Analysis API
 * 
 * Server-side endpoint for AI-powered PDF analysis with SSE streaming.
 * Supports multiple providers (Gemini, OpenAI workflow) and reading modes.
 * 
 * Security: OpenAI API key is server-side only. Gemini uses existing client keys for now.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { runWorkflow } from '../_lib/openaiWorkflow/runner.js';
import { mapWorkflowToLicitacionData } from '../_lib/mappers/openai-workflow-mapper.js';
import { LicitacionSchema } from '../_lib/shared/schemas.js';

// ... existing imports ...

// Types for SSE
type SSELogLevel = 'info' | 'warn' | 'error';
type SSEStage = 'auth' | 'validate' | 'ai' | 'map' | 'persist' | 'done';

interface SSEStageEvent {
    stage: SSEStage;
}

interface SSELogEvent {
    level: SSELogLevel;
    code: string;
    message: string;
}

interface SSEDeltaEvent {
    text: string;
}

interface SSEResultEvent {
    licitacionData: unknown;
}

interface SSEErrorEvent {
    code: string;
    userMessage: string;
}

// Helper to send SSE events
function sendSSE(res: VercelResponse, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const config = {
    maxDuration: 60,
};

/**
 * POST /api/pliegos/analyze
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        // Parse request body
        const { provider, readingMode, hash, pdfBase64, extractedText, filename } = req.body || {};

        // ========== STAGE: AUTH ==========
        sendSSE(res, 'stage', { stage: 'auth' } as SSEStageEvent);

        // Get Supabase URL and key from environment
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            sendSSE(res, 'error', {
                code: 'CONFIG_ERROR',
                userMessage: 'Configuración del servidor incorrecta (Supabase)'
            } as SSEErrorEvent);
            return res.end();
        }

        // Extract JWT from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendSSE(res, 'error', {
                code: 'AUTH_REQUIRED',
                userMessage: 'Autenticación requerida'
            } as SSEErrorEvent);
            return res.status(401).end();
        }

        const token = authHeader.substring(7);

        // Verify token with Supabase
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            sendSSE(res, 'error', {
                code: 'AUTH_INVALID',
                userMessage: 'Sesión inválida o expirada'
            } as SSEErrorEvent);
            return res.status(401).end();
        }

        sendSSE(res, 'log', {
            level: 'info',
            code: 'AUTH_SUCCESS',
            message: `Usuario autenticado: ${user.email}`
        } as SSELogEvent);

        // ========== STAGE: VALIDATE ==========
        sendSSE(res, 'stage', { stage: 'validate' } as SSEStageEvent);

        // ... handler starts below ...

        // Validate provider
        if (!provider || !['gemini', 'openai'].includes(provider)) {
            sendSSE(res, 'error', {
                code: 'INVALID_PROVIDER',
                userMessage: 'Proveedor de IA inválido'
            } as SSEErrorEvent);
            return res.end();
        }

        // Validate reading mode
        if (!readingMode || !['full', 'keydata'].includes(readingMode)) {
            sendSSE(res, 'error', {
                code: 'INVALID_READING_MODE',
                userMessage: 'Modo de lectura inválido'
            } as SSEErrorEvent);
            return res.end();
        }

        // Fail-fast: Check API keys
        if (provider === 'openai') {
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
                sendSSE(res, 'error', {
                    code: 'OPENAI_KEY_MISSING',
                    userMessage: 'OpenAI no está configurado en el servidor. Contacta al administrador.'
                } as SSEErrorEvent);
                return res.end();
            }
        }

        // Validate hash
        if (!hash || typeof hash !== 'string') {
            sendSSE(res, 'error', {
                code: 'INVALID_HASH',
                userMessage: 'Hash de documento inválido'
            } as SSEErrorEvent);
            return res.end();
        }

        // Validate that we have either extracted text or PDF
        if (!extractedText && !pdfBase64) {
            sendSSE(res, 'error', {
                code: 'MISSING_CONTENT',
                userMessage: 'Falta contenido del documento'
            } as SSEErrorEvent);
            return res.end();
        }

        sendSSE(res, 'log', {
            level: 'info',
            code: 'VALIDATION_SUCCESS',
            message: `Validación exitosa: ${provider} + ${readingMode}`
        } as SSELogEvent);

        // ========== STAGE: AI ==========
        sendSSE(res, 'stage', { stage: 'ai' } as SSEStageEvent);
        sendSSE(res, 'log', {
            level: 'info',
            code: 'AI_START',
            message: `Iniciando análisis con ${provider === 'openai' ? 'OpenAI Agent Builder' : 'Gemini'}...`
        } as SSELogEvent);

        let rawOutput: unknown;

        if (provider === 'openai') {
            // Call OpenAI workflow (caja negra - solo invocar y obtener resultado)
            try {
                rawOutput = await runWorkflow(
                    {
                        extractedText,
                        pdfBase64,
                        readingMode: readingMode as 'full' | 'keydata',
                        hash,
                        userId: user.id
                    },
                    {
                        onProgress: (stage: string, message: string) => {
                            sendSSE(res, 'delta', { text: `[${stage}] ${message}` } as SSEDeltaEvent);
                        }
                    }
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                sendSSE(res, 'error', {
                    code: 'OPENAI_WORKFLOW_ERROR',
                    userMessage: `Error en el workflow de OpenAI: ${errorMessage}`
                } as SSEErrorEvent);
                return res.end();
            }
        } else {
            // Gemini: Por ahora retornamos error indicando que debe usarse client-side
            // TODO: Implementar Gemini server-side si es necesario
            sendSSE(res, 'error', {
                code: 'GEMINI_NOT_IMPLEMENTED',
                userMessage: 'Gemini server-side aún no implementado. Usa OpenAI o client-side Gemini.'
            } as SSEErrorEvent);
            return res.end();
        }

        sendSSE(res, 'log', {
            level: 'info',
            code: 'AI_COMPLETE',
            message: 'Análisis de IA completado'
        } as SSELogEvent);

        // ========== STAGE: MAP ==========
        sendSSE(res, 'stage', { stage: 'map' } as SSEStageEvent);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mappedData: any;
        try {
            mappedData = mapWorkflowToLicitacionData(rawOutput);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error de mapeo';
            sendSSE(res, 'error', {
                code: 'MAPPING_ERROR',
                userMessage: `Error mapeando resultado: ${errorMessage}`
            } as SSEErrorEvent);
            return res.end();
        }

        // --- Module 3 Rules: Quality Check ---
        const quality = mappedData.workflow?.quality;
        if (quality?.overall === 'VACIO') {
            sendSSE(res, 'error', {
                code: 'QUALITY_REJECTION',
                userMessage: 'El documento no parece ser un pliego válido o es ilegible (' + (quality.warnings?.[0] || 'Sin datos detectados') + ').'
            } as SSEErrorEvent);
            return res.end();
        }

        if (quality?.overall === 'PARCIAL') {
            sendSSE(res, 'log', {
                level: 'warn',
                code: 'QUALITY_PARTIAL',
                message: 'Atención: Lectura parcial. Faltan campos críticos.'
            } as SSELogEvent);
        }

        if (quality?.ambiguous_fields?.length > 0) {
            sendSSE(res, 'log', {
                level: 'warn',
                code: 'QUALITY_AMBIGUITY',
                message: `Detectadas ambigüedades en campos: ${quality.ambiguous_fields.join(', ')}`
            } as SSELogEvent);
        }

        // Validate with Zod (Use LicitacionSchema to preserve workflow/metadata)
        const validationResult = LicitacionSchema.safeParse(mappedData);

        if (!validationResult.success) {
            console.error('[API] Zod validation failed:', validationResult.error);
            sendSSE(res, 'error', {
                code: 'SCHEMA_VALIDATION_ERROR',
                userMessage: 'El resultado de la IA no cumple con el formato interno'
            } as SSEErrorEvent);
            return res.end();
        }

        const licitacionData = validationResult.data;

        sendSSE(res, 'log', {
            level: 'info',
            code: 'MAP_SUCCESS',
            message: 'Datos mapeados y validados exitosamente'
        } as SSELogEvent);

        // ========== STAGE: PERSIST ==========
        sendSSE(res, 'stage', { stage: 'persist' } as SSEStageEvent);

        try {
            // Insert into Supabase
            const { error: insertError } = await supabase
                .from('licitaciones')
                .upsert({
                    user_id: user.id,
                    hash,
                    file_name: filename || 'documento.pdf',
                    data: licitacionData,
                    provider,
                    reading_mode: readingMode,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,hash'
                });

            if (insertError) {
                console.error('[API] Supabase insert error:', insertError);
                sendSSE(res, 'log', {
                    level: 'warn',
                    code: 'PERSIST_FAILED',
                    message: 'No se pudo guardar en la base de datos, pero el análisis fue exitoso'
                } as SSELogEvent);
            } else {
                sendSSE(res, 'log', {
                    level: 'info',
                    code: 'PERSIST_SUCCESS',
                    message: 'Datos guardados en Supabase'
                } as SSELogEvent);
            }
        } catch (error) {
            console.error('[API] Persistence error:', error);
            // No bloqueamos el flujo por error de persistencia
        }

        // ========== STAGE: RESULT ==========
        sendSSE(res, 'result', { licitacionData } as SSEResultEvent);

        // ========== STAGE: DONE ==========
        sendSSE(res, 'stage', { stage: 'done' } as SSEStageEvent);

        res.end();

    } catch (error) {
        console.error('[API] Unexpected error:', error);

        sendSSE(res, 'error', {
            code: 'INTERNAL_ERROR',
            userMessage: 'Error interno del servidor'
        } as SSEErrorEvent);

        res.end();
    }
}
