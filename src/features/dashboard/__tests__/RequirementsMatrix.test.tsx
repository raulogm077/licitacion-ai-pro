
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequirementsMatrix } from '../RequirementsMatrix';
import { LicitacionData } from '../../../types';

// Mock Lucide icons to avoid rendering issues
vi.mock('lucide-react', () => ({
    CheckSquare: () => <span data-testid="icon-check" />,
    Square: () => <span data-testid="icon-square" />,
    ListChecks: () => <span data-testid="icon-list" />,
}));

// Mock Child Components
vi.mock('../../../components/ui/Card', () => ({
    Card: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardContent: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardHeader: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardTitle: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('../../../components/ui/Badge', () => ({
    Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const mockRequirements: LicitacionData['requisitosTecnicos']['funcionales'] = [
    { requisito: 'Req 1', obligatorio: true, referenciaPagina: 10 },
    { requisito: 'Req 2', obligatorio: false, referenciaPagina: 12 },
    { requisito: 'Req 3', obligatorio: true },
];

describe('RequirementsMatrix', () => {
    it('renders list of requirements', () => {
        render(<RequirementsMatrix requirements={mockRequirements} />);

        expect(screen.getByText('Req 1')).toBeInTheDocument();
        expect(screen.getByText('Req 2')).toBeInTheDocument();
        expect(screen.getByText('Req 3')).toBeInTheDocument();
    });

    it('calculates progress correctly', () => {
        render(<RequirementsMatrix requirements={mockRequirements} />);

        // Initial state: 0%
        expect(screen.getByText('0% Cumplimiento')).toBeInTheDocument();

        // Click first requirement
        fireEvent.click(screen.getByText('Req 1'));

        // 1/3 = 33%
        expect(screen.getByText('33% Cumplimiento')).toBeInTheDocument();

        // Click second requirement
        fireEvent.click(screen.getByText('Req 2'));

        // 2/3 = 67%
        expect(screen.getByText('67% Cumplimiento')).toBeInTheDocument();
    });

    it('filters requirements correctly', () => {
        render(<RequirementsMatrix requirements={mockRequirements} />);

        // Filter Mandatory
        fireEvent.click(screen.getByText('Obligatorios'));

        expect(screen.getByText('Req 1')).toBeInTheDocument();
        expect(screen.queryByText('Req 2')).not.toBeInTheDocument(); // Optional should be hidden
        expect(screen.getByText('Req 3')).toBeInTheDocument();

        // Filter Optional
        fireEvent.click(screen.getByText('Opcionales'));

        expect(screen.queryByText('Req 1')).not.toBeInTheDocument();
        expect(screen.getByText('Req 2')).toBeInTheDocument();

        // Filter All
        fireEvent.click(screen.getByText('Todos'));
        expect(screen.getByText('Req 1')).toBeInTheDocument();
        expect(screen.getByText('Req 2')).toBeInTheDocument();
    });
});
