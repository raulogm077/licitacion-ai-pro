import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EvidenceToggle } from '../EvidenceToggle';

describe('EvidenceToggle', () => {
    it('does not render if no evidence is provided', () => {
        const { container } = render(<EvidenceToggle evidence={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders toggle button and opens/closes popover', () => {
        const evidence = { quote: 'Test quote', pageHint: '12' };
        render(<EvidenceToggle evidence={evidence} />);

        const btn = screen.getByTitle('Cita sin verificar');
        expect(btn).toBeInTheDocument();

        // Popover initially hidden
        expect(screen.queryByText('"Test quote"')).not.toBeInTheDocument();

        // Click to open
        fireEvent.click(btn);
        expect(screen.getByText('"Test quote"')).toBeInTheDocument();
        expect(screen.getByText('Pág. 12')).toBeInTheDocument();

        // Click the button again to toggle closed
        fireEvent.click(btn);
        expect(screen.queryByText('"Test quote"')).not.toBeInTheDocument();
    });
});

// ─── Autoridad de la cita ────────────────────────────────────────────────────
//
// Incidente 2026-07-28 (`docs/adr/ADR-003`): seis análisis de los mismos dos
// PDFs mostraron seis licitaciones distintas, y cada una traía su «evidencia»
// entrecomillada con número de página. La cita la redacta el modelo; hasta que
// alguien la contrasta contra el documento no acredita nada, y presentarla como
// si lo hiciera es lo que hizo el fallo invisible.

describe('EvidenceToggle — no aparenta una verificación que no ocurrió', () => {
    it('una cita sin estado se presenta como NO verificada', () => {
        // Es el caso del histórico entero: `verification` ausente.
        render(<EvidenceToggle evidence={{ quote: 'Título: Servicios de apoyo…' }} />);
        fireEvent.click(screen.getByTitle('Cita sin verificar'));

        expect(screen.getByText(/no se ha contrastado contra el documento/i)).toBeInTheDocument();
    });

    it('solo dice "verificada" cuando el pipeline lo ha comprobado', () => {
        render(<EvidenceToggle evidence={{ quote: 'PBL: 8.587.086,00 €', verification: 'verified' }} />);
        fireEvent.click(screen.getByTitle('Evidencia verificada'));

        expect(screen.getByText(/aparece literalmente en el documento/i)).toBeInTheDocument();
    });

    it('avisa de que el dato no es fiable cuando la cita no está en el documento', () => {
        render(<EvidenceToggle evidence={{ quote: 'cita fabricada', verification: 'not_found' }} />);
        fireEvent.click(screen.getByTitle('Cita no encontrada en el documento'));

        expect(screen.getByText(/no es fiable/i)).toBeInTheDocument();
    });

    it('distingue "no se pudo comprobar" de "no aparece"', () => {
        // Un PDF escaneado sin texto extraíble no permite falsar la cita. Decir
        // «no aparece» ahí sería afirmar más de lo que sabemos.
        render(<EvidenceToggle evidence={{ quote: 'cita de un escaneo', verification: 'unverifiable' }} />);
        fireEvent.click(screen.getByTitle('No ha podido verificarse'));

        expect(screen.getByText(/no hay texto extraíble/i)).toBeInTheDocument();
    });
});
