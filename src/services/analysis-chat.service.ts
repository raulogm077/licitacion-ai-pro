import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { logger } from './logger';

const ChatCitationSchema = z.object({
    fieldPath: z.string().optional(),
    quote: z.string(),
    pageHint: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
});

const ChatResponseSchema = z.object({
    answer: z.string(),
    citations: z.array(ChatCitationSchema).default([]),
    usedTools: z.array(z.string()).default([]),
    sessionId: z.string().uuid(),
});

export type AnalysisChatCitation = z.infer<typeof ChatCitationSchema>;
export type AnalysisChatResponse = z.infer<typeof ChatResponseSchema>;

export interface AnalysisChatRequest {
    analysisHash: string;
    message: string;
    sessionId?: string;
    signal?: AbortSignal;
}

export class AnalysisChatService {
    async sendMessage({
        analysisHash,
        message,
        sessionId,
        signal,
    }: AnalysisChatRequest): Promise<AnalysisChatResponse> {
        const trimmedMessage = message.trim();
        if (!analysisHash.trim()) {
            throw new Error('analysisHash es obligatorio');
        }
        if (!trimmedMessage) {
            throw new Error('message es obligatorio');
        }

        let session = await this.getActiveSession();
        let response = await this.invokeFunction(session.access_token, {
            analysisHash,
            message: trimmedMessage,
            sessionId,
            signal,
        });

        if (response.status === 401) {
            logger.warn('[AnalysisChatService] 401 from chat function, refreshing session');
            session = await this.getActiveSession(true);
            response = await this.invokeFunction(session.access_token, {
                analysisHash,
                message: trimmedMessage,
                sessionId,
                signal,
            });
        }

        if (!response.ok) {
            throw new Error(await this.readErrorMessage(response));
        }

        const payload = await response.json();
        const parsed = ChatResponseSchema.safeParse(payload);
        if (!parsed.success) {
            logger.error('[AnalysisChatService] Invalid response payload', parsed.error.flatten());
            throw new Error('La respuesta del asistente no tiene el formato esperado');
        }

        return parsed.data;
    }

    private async getActiveSession(forceRefresh = false): Promise<Session> {
        const authResponse = forceRefresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
        const session = authResponse.data.session;

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        if (!forceRefresh) {
            const now = Math.floor(Date.now() / 1000);
            if ((session.expires_at ?? 0) - now < 300) {
                return this.getActiveSession(true);
            }
        }

        return session;
    }

    private async invokeFunction(
        accessToken: string,
        {
            analysisHash,
            message,
            sessionId,
            signal,
        }: Pick<AnalysisChatRequest, 'analysisHash' | 'message' | 'sessionId' | 'signal'>
    ) {
        return fetch(`${env.VITE_SUPABASE_URL}/functions/v1/chat-with-analysis-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                apikey: env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
                analysisHash,
                message,
                sessionId,
            }),
            signal,
        });
    }

    private async readErrorMessage(response: Response) {
        try {
            const errorPayload = await response.json();
            return errorPayload.error || errorPayload.message || `Error del servidor (HTTP ${response.status})`;
        } catch {
            return `Error del servidor (HTTP ${response.status})`;
        }
    }
}

export const analysisChatService = new AnalysisChatService();
