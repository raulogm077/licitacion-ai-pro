/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplatesPage } from '../TemplatesPage';
import { MemoryRouter } from 'react-router-dom';
import { templateService } from '../../services/template.service';

vi.mock('../../services/template.service', () => ({
    templateService: {
        getTemplates: vi.fn(),
        createTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        deleteTemplate: vi.fn()
    }
}));

describe('TemplatesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (templateService.getTemplates as any).mockResolvedValue({ ok: true, value: [] });
    });

    it('renders templates list', async () => {
        render(
            <MemoryRouter>
                <TemplatesPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Aún no hay plantillas')).toBeInTheDocument();
        });
    });
});
