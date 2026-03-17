import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../template.service';

const mockSupabaseClient = {
    auth: {
        getSession: vi.fn(),
    },
    from: vi.fn(),
};

describe('TemplateService', () => {
    let service: TemplateService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TemplateService(mockSupabaseClient as any);

        mockSupabaseClient.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'test-user' } } },
            error: null,
        });
    });

    it('should fetch templates successfully', async () => {
        const mockTemplates = [{ id: '1', name: 'Test Template' }];
        const mockOrder = vi.fn().mockResolvedValue({ data: mockTemplates, error: null });
        const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await service.getTemplates();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(mockTemplates);
        }
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('extraction_templates');
    });

    it('should handle unauthenticated user in getTemplates', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

        const result = await service.getTemplates();

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('Usuario no autenticado');
        }
    });

    it('should create a template successfully', async () => {
        const mockTemplate = { id: '1', name: 'New Template', schema: [] };
        const mockSingle = vi.fn().mockResolvedValue({ data: mockTemplate, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

        const result = await service.createTemplate('New Template', 'Desc', []);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(mockTemplate);
        }
        expect(mockInsert).toHaveBeenCalledWith({
            user_id: 'test-user',
            name: 'New Template',
            description: 'Desc',
            schema: [],
        });
    });

    it('should delete a template successfully', async () => {
        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
        mockSupabaseClient.from.mockReturnValue({ delete: mockDelete });

        const result = await service.deleteTemplate('1');

        expect(result.ok).toBe(true);
        expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
});
