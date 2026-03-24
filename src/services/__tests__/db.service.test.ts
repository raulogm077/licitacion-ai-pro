import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBService } from '../db.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { appCache } from '../../lib/cache';

// Mock Supabase Client
const mockSupabase = {
    auth: {
        getSession: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
} as unknown as SupabaseClient;

describe('DBService', () => {
    let service: DBService;

    beforeEach(() => {
        vi.clearAllMocks();
        appCache.clear();
        service = new DBService(mockSupabase);
    });

    describe('getLicitacion', () => {
        it('should map database response to DbLicitacion correctly', async () => {
            const mockData = {
                hash: '123',
                file_name: 'test.pdf',
                updated_at: '2023-01-01T00:00:00Z',
                data: {
                    metadata: { tags: ['test'] },
                    datosGenerales: {},
                },
            };

            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            };

            vi.mocked(mockSupabase.from).mockReturnValue(
                mockBuilder as unknown as ReturnType<typeof mockSupabase.from>
            );

            const result = await service.getLicitacion('123');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.hash).toBe('123');
                expect(result.value.metadata.tags).toEqual(['test']);
                expect(result.value.timestamp).toBe(new Date('2023-01-01T00:00:00Z').getTime());
            }
        });

        it('should return error if supabase fails', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
            };

            vi.mocked(mockSupabase.from).mockReturnValue(
                mockBuilder as unknown as ReturnType<typeof mockSupabase.from>
            );
            const result = await service.getLicitacion('123');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DB Error');
            }
        });
    });

    describe('advancedSearch', () => {
        it('should apply server-side filters and client-side tag filtering', async () => {
            const mockData = [
                {
                    hash: '1',
                    file_name: 'match.pdf',
                    updated_at: '2023-01-01T00:00:00Z',
                    data: { metadata: { tags: ['a', 'b'] } },
                },
                {
                    hash: '2',
                    file_name: 'no-match.pdf',
                    updated_at: '2023-01-01T00:00:00Z',
                    data: { metadata: { tags: ['c'] } },
                },
            ];

            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                then: (cb: (result: { data: typeof mockData; error: null }) => void) =>
                    cb({ data: mockData, error: null }),
            };

            vi.mocked(mockSupabase.from).mockReturnValue(
                mockBuilder as unknown as ReturnType<typeof mockSupabase.from>
            );

            // Filter by tag 'a'
            const result = await service.advancedSearch({ tags: ['a'] });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.length).toBe(1);
                expect(result.value[0].hash).toBe('1');
            }
        });
    });
});
