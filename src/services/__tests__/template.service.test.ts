import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../template.service';
import { appCache } from '../../lib/cache';

const mockSupabaseClient = {
    auth: {
        getSession: vi.fn(),
    },
    from: vi.fn(),
};

const withSession = () =>
    mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'test-user' } } },
        error: null,
    });

const withNoSession = () =>
    mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
    });

describe('TemplateService', () => {
    let service: TemplateService;

    beforeEach(() => {
        vi.clearAllMocks();
        appCache.clear();
        service = new TemplateService(mockSupabaseClient as unknown as import('@supabase/supabase-js').SupabaseClient);
        withSession();
    });

    // ── getTemplates ─────────────────────────────────────────────────────────

    describe('getTemplates', () => {
        it('fetches templates successfully', async () => {
            const mockTemplates = [{ id: '1', name: 'Test Template' }];
            const mockOrder = vi.fn().mockResolvedValue({ data: mockTemplates, error: null });
            const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
            mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

            const result = await service.getTemplates();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toEqual(mockTemplates);
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('extraction_templates');
        });

        it('returns error when unauthenticated', async () => {
            withNoSession();
            const result = await service.getTemplates();
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toBe('Usuario no autenticado');
        });

        it('returns error on DB failure', async () => {
            const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
            const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
            mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

            const result = await service.getTemplates();
            expect(result.ok).toBe(false);
        });

        it('returns cached templates on second call', async () => {
            const mockTemplates = [{ id: '1', name: 'Cached' }];
            const mockOrder = vi.fn().mockResolvedValue({ data: mockTemplates, error: null });
            const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
            mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

            await service.getTemplates();
            await service.getTemplates();

            // from() called only once — second call hits cache
            expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
        });
    });

    // ── getTemplate ──────────────────────────────────────────────────────────

    describe('getTemplate', () => {
        it('fetches single template by id', async () => {
            const mockTemplate = { id: 'tpl-1', name: 'Single', schema: [] };
            const mockSingle = vi.fn().mockResolvedValue({ data: mockTemplate, error: null });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

            const result = await service.getTemplate('tpl-1');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value.name).toBe('Single');
        });

        it('returns error when unauthenticated', async () => {
            withNoSession();
            const result = await service.getTemplate('tpl-1');
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toBe('Usuario no autenticado');
        });

        it('returns error on DB failure', async () => {
            const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

            const result = await service.getTemplate('tpl-x');
            expect(result.ok).toBe(false);
        });
    });

    // ── createTemplate ───────────────────────────────────────────────────────

    describe('createTemplate', () => {
        it('creates template and returns it', async () => {
            const mockTemplate = { id: '1', name: 'New Template', schema: [] };
            const mockSingle = vi.fn().mockResolvedValue({ data: mockTemplate, error: null });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

            const result = await service.createTemplate('New Template', 'Desc', []);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toEqual(mockTemplate);
            expect(mockInsert).toHaveBeenCalledWith({
                user_id: 'test-user',
                name: 'New Template',
                description: 'Desc',
                schema: [],
            });
        });

        it('returns error when unauthenticated', async () => {
            withNoSession();
            const result = await service.createTemplate('T', 'D', []);
            expect(result.ok).toBe(false);
        });

        it('returns error on DB failure', async () => {
            const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

            const result = await service.createTemplate('T', 'D', []);
            expect(result.ok).toBe(false);
        });
    });

    // ── updateTemplate ───────────────────────────────────────────────────────

    describe('updateTemplate', () => {
        it('updates template successfully', async () => {
            const updated = { id: '1', name: 'Updated', schema: [] };
            const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ update: mockUpdate });

            const result = await service.updateTemplate('1', { name: 'Updated' });
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value.name).toBe('Updated');
        });

        it('returns error when unauthenticated', async () => {
            withNoSession();
            const result = await service.updateTemplate('1', { name: 'X' });
            expect(result.ok).toBe(false);
        });

        it('returns error on DB failure', async () => {
            const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ update: mockUpdate });

            const result = await service.updateTemplate('1', {});
            expect(result.ok).toBe(false);
        });
    });

    // ── deleteTemplate ───────────────────────────────────────────────────────

    describe('deleteTemplate', () => {
        it('deletes template successfully', async () => {
            const mockEq = vi.fn().mockResolvedValue({ error: null });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ delete: mockDelete });

            const result = await service.deleteTemplate('1');
            expect(result.ok).toBe(true);
            expect(mockEq).toHaveBeenCalledWith('id', '1');
        });

        it('returns error when unauthenticated', async () => {
            withNoSession();
            const result = await service.deleteTemplate('1');
            expect(result.ok).toBe(false);
        });

        it('returns error on DB failure', async () => {
            const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
            mockSupabaseClient.from.mockReturnValue({ delete: mockDelete });

            const result = await service.deleteTemplate('1');
            expect(result.ok).toBe(false);
        });
    });
});
