import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisChatService } from '../analysis-chat.service';
import { supabase } from '../../config/supabase';

vi.mock('../../config/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            refreshSession: vi.fn(),
        },
    },
}));

describe('AnalysisChatService', () => {
    const service = new AnalysisChatService();
    const mockSession = {
        access_token: 'token-123',
        user: { id: 'user-1' },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn());
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: mockSession },
            error: null,
        } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
        vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
            data: { session: mockSession },
            error: null,
        } as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
    });

    it('sends a chat request and parses the response', async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(
                JSON.stringify({
                    answer: 'Respuesta del asistente',
                    citations: [{ fieldPath: 'datosGenerales.presupuesto', quote: '120.000 EUR' }],
                    usedTools: ['get_field_value'],
                    sessionId: '11111111-1111-4111-8111-111111111111',
                }),
                { status: 200 }
            )
        );

        const response = await service.sendMessage({
            analysisHash: 'hash-1',
            message: 'Qué presupuesto tiene?',
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            'https://mock.supabase.co/functions/v1/chat-with-analysis-agent',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer token-123',
                    apikey: 'mock-anon-key',
                }),
            })
        );
        expect(response.answer).toBe('Respuesta del asistente');
        expect(response.usedTools).toEqual(['get_field_value']);
    });

    it('refreshes the session and retries once after a 401', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        answer: 'Respuesta con sesión refrescada',
                        citations: [],
                        usedTools: [],
                        sessionId: '22222222-2222-4222-8222-222222222222',
                    }),
                    { status: 200 }
                )
            );

        const response = await service.sendMessage({
            analysisHash: 'hash-1',
            message: 'Haz un resumen',
            sessionId: '22222222-2222-4222-8222-222222222220',
        });

        expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(response.answer).toContain('sesión refrescada');
    });

    it('throws when there is no authenticated user', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: null },
            error: null,
        } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

        await expect(
            service.sendMessage({
                analysisHash: 'hash-1',
                message: 'Hola',
            })
        ).rejects.toThrow('Usuario no autenticado');
    });
});
