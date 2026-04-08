import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SummarySection } from '../SummarySection';
import { buildPliegoVM } from '../../../model/pliego-vm';
import { createMockLicitacionData } from '../../../../../test-utils/mock-pliego-data';

describe('SummarySection Component', () => {
    it('renders objecto and organo correctly', () => {
        const mockData = createMockLicitacionData();
        mockData.datosGenerales.titulo = { value: 'This is the title', status: 'extraido' };
        mockData.datosGenerales.organoContratacion = { value: 'This is the organo', status: 'extraido' };
        const vm = buildPliegoVM(mockData);

        render(<SummarySection vm={vm} />);

        expect(screen.getAllByText('This is the organo').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/"This is the title"/).length).toBeGreaterThan(0);
    });

    it('renders mock tags correctly', () => {
        const mockData = createMockLicitacionData();
        mockData.datosGenerales.cpv = { value: ['1234'], status: 'extraido' };
        const vm = buildPliegoVM(mockData);

        render(<SummarySection vm={vm} />);

        expect(screen.getAllByText('TIC').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Servicios').length).toBeGreaterThan(0);
    });
});
