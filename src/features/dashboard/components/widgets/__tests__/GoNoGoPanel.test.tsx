/**
 * El criterio que estos tests protegen es la decisión 7.4 de ADR-002:
 * `no_verificable` no puede presentarse como incumplimiento. Ni por color, ni
 * por icono, ni por lenguaje. Si se confunden, el usuario descarta una
 * licitación a la que sí podía presentarse — un daño peor que no mostrar nada.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GoNoGoPanel } from '../GoNoGoPanel';
import type { PliegoVM } from '../../../model/pliego-vm';
import type { PerfilEmpresa } from '../../../../../shared/go-no-go';

function vmCon(result: Record<string, unknown>): PliegoVM {
    return { result } as unknown as PliegoVM;
}

const PLIEGO_EXIGENTE = {
    requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1_000_000 }, tecnica: [] },
    datosGenerales: { cpv: ['72212000-4'], plazoEjecucionMeses: 12 },
    economico: { presupuestoBaseLicitacion: 500_000 },
};

const PERFIL_VACIO: PerfilEmpresa = { ejercicios: [], proyectos: [], acreditaciones: [] };

const PERFIL_INSUFICIENTE: PerfilEmpresa = {
    ejercicios: [{ ejercicio: 2025, volumenNegocio: 100, volumenAmbito: 100 }],
    proyectos: [],
    acreditaciones: [],
};

describe('GoNoGoPanel', () => {
    it('sin perfil invita a completarlo en vez de enseñar un veredicto vacío', async () => {
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(null)} />);
        await waitFor(() => expect(screen.getByText(/Completa el perfil de tu empresa/i)).toBeInTheDocument());
    });

    it('con el perfil vacío no dice que incumples: dice que falta un dato tuyo', async () => {
        // Es el estado dominante al principio. Presentarlo como incumplimiento
        // haría que el usuario descarte la licitación por un campo sin rellenar.
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(PERFIL_VACIO)} />);

        await waitFor(() => expect(screen.getByText(/Faltan datos de tu perfil/i)).toBeInTheDocument());
        expect(screen.queryByText('No cumples')).not.toBeInTheDocument();
        expect(screen.getAllByText('Falta un dato tuyo').length).toBeGreaterThan(0);
    });

    it('nombra el campo que falta, para que se pueda rellenar', async () => {
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(PERFIL_VACIO)} />);
        await waitFor(() => expect(screen.getAllByText(/Falta en tu perfil:/i).length).toBeGreaterThan(0));
    });

    it('un incumplimiento real sí se marca como tal', async () => {
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(PERFIL_INSUFICIENTE)} />);

        await waitFor(() => expect(screen.getByText(/Hay un requisito que no cumples/i)).toBeInTheDocument());
        expect(screen.getAllByText('No cumples').length).toBeGreaterThan(0);
    });

    it('el estado no se transmite solo por color', async () => {
        // Accesibilidad: cada chequeo lleva etiqueta de texto y el aria-label
        // incluye el estado en palabras, no solo la clase de color.
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(PERFIL_INSUFICIENTE)} />);

        await waitFor(() => expect(screen.getAllByText('No cumples').length).toBeGreaterThan(0));
        const items = screen.getAllByRole('listitem');
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
            expect(item.getAttribute('aria-label')).toMatch(/Estado: (Cumples|No cumples|Falta un dato tuyo)/);
        }
    });

    it('cada chequeo cita su sección de la Guía', async () => {
        // Sin la referencia, el panel es una opinión y no un veredicto auditable.
        render(<GoNoGoPanel vm={vmCon(PLIEGO_EXIGENTE)} cargarPerfil={() => Promise.resolve(PERFIL_VACIO)} />);
        await waitFor(() => expect(screen.getAllByText(/^Guía /).length).toBeGreaterThan(0));
    });
});
