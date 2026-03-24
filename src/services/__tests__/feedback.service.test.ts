import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackService } from '../feedback.service';

const mockSession = { user: { id: 'user-123' } };

function createMockClient() {
    const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
            data: {
                id: 'fb-1',
                licitacion_hash: 'hash-1',
                field_path: 'result.datosGenerales.titulo',
                value: 'Test',
                feedback_type: 'up',
                created_at: '2026-01-01',
            },
            error: null,
        }),
        eq: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
    };

    return {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }),
        },
        from: vi.fn().mockReturnValue(mockBuilder),
        _builder: mockBuilder,
    };
}

describe('FeedbackService', () => {
    let service: FeedbackService;
    let mockClient: ReturnType<typeof createMockClient>;

    beforeEach(() => {
        mockClient = createMockClient();
        service = new FeedbackService(mockClient as unknown as ConstructorParameters<typeof FeedbackService>[0]);
    });

    it('saves feedback via upsert', async () => {
        const result = await service.saveFeedback('hash-1', 'field.path', 'value', 'up');
        expect(result.ok).toBe(true);
        expect(mockClient.from).toHaveBeenCalledWith('extraction_feedback');
        expect(mockClient._builder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-123',
                licitacion_hash: 'hash-1',
                field_path: 'field.path',
                feedback_type: 'up',
            }),
            { onConflict: 'user_id, licitacion_hash, field_path' }
        );
    });

    it('returns error when not authenticated', async () => {
        mockClient.auth.getSession.mockResolvedValue({ data: { session: null } });
        const result = await service.saveFeedback('hash', 'path', 'val', 'down');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('autenticado');
        }
    });

    it('removes feedback', async () => {
        mockClient._builder.eq.mockReturnThis();
        mockClient._builder.delete.mockReturnValue({
            eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
            }),
        });
        const result = await service.removeFeedback('hash-1', 'field.path');
        expect(result.ok).toBe(true);
    });

    it('gets feedback for a licitacion', async () => {
        mockClient._builder.eq.mockResolvedValue({
            data: [
                {
                    id: 'fb-1',
                    field_path: 'path',
                    value: 'val',
                    feedback_type: 'up',
                    licitacion_hash: 'h',
                    created_at: '',
                },
            ],
            error: null,
        });
        const result = await service.getFeedbackForLicitacion('hash-1');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(1);
        }
    });

    it('handles supabase errors gracefully', async () => {
        mockClient._builder.single.mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
        });
        const result = await service.saveFeedback('hash', 'path', 'val', 'up');
        expect(result.ok).toBe(false);
    });
});
