/**
 * Captura incremental (ADR-002 Paso 3).
 *
 * El criterio que se protege aquí es que **solo se pide lo que el usuario puede
 * dar**. Un `camposFaltantes` que apunta al pliego —«el expediente no traía CPV
 * utilizable»— no se arregla rellenando el perfil, y ofrecer un formulario ahí
 * sería pedirle que corrija un documento que no es suyo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CapturaCampo } from '../CapturaCampo';
import { perfilService } from '../../../../../services/perfil.service';
import { esCampoDelPerfil, type Chequeo } from '../../../../../shared/go-no-go';

vi.mock('../../../../../services/perfil.service', () => ({
    perfilService: {
        upsertEjercicio: vi.fn(),
        addProyecto: vi.fn(),
        addAcreditacion: vi.fn(),
    },
}));

const chequeo = (over: Partial<Chequeo>): Chequeo =>
    ({
        id: 'van',
        guia: '§3.1.1',
        estado: 'no_verificable',
        detalle: 'No se puede comparar el volumen de negocio.',
        camposFaltantes: ['perfil.volumenNegocio'],
        ...over,
    }) as Chequeo;

describe('CapturaCampo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(perfilService.upsertEjercicio).mockResolvedValue({ ok: true, value: undefined });
        vi.mocked(perfilService.addAcreditacion).mockResolvedValue({ ok: true, value: undefined });
        vi.mocked(perfilService.addProyecto).mockResolvedValue({ ok: true, value: undefined });
    });

    it('no ofrece captura cuando lo que falta viene del pliego', () => {
        // «El pliego no aporta CPV utilizable» no lo arregla el usuario.
        render(
            <CapturaCampo
                chequeo={chequeo({ id: 'similitud_cpv', camposFaltantes: ['pliego.cpv'] })}
                onGuardado={() => {}}
            />
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('no ofrece captura sobre un chequeo que sí se pudo verificar', () => {
        render(<CapturaCampo chequeo={chequeo({ estado: 'cumple', camposFaltantes: [] })} onGuardado={() => {}} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('esCampoDelPerfil separa lo que el usuario puede rellenar', () => {
        expect(esCampoDelPerfil('perfil.volumenNegocio')).toBe(true);
        expect(esCampoDelPerfil('pliego.cpv')).toBe(false);
    });

    it('pide solo el campo del chequeo, no el perfil entero', async () => {
        render(<CapturaCampo chequeo={chequeo({ id: 'seguro_rc' })} onGuardado={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /Añadir póliza/i }));
        // Un único campo: la cobertura. Nada de razón social, NIF ni empleados.
        expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
        expect(screen.getByText(/Cobertura de la póliza/i)).toBeInTheDocument();
    });

    it('guarda el volumen y avisa para que el veredicto se recalcule', async () => {
        const onGuardado = vi.fn();
        render(<CapturaCampo chequeo={chequeo({})} onGuardado={onGuardado} />);

        fireEvent.click(screen.getByRole('button', { name: /Añadir volumen/i }));
        fireEvent.change(screen.getByLabelText(/Volumen de negocio/i), { target: { value: '2500000' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

        await waitFor(() => expect(onGuardado).toHaveBeenCalled());
        expect(perfilService.upsertEjercicio).toHaveBeenCalledWith(
            expect.objectContaining({ volumenNegocio: 2500000 })
        );
    });

    it('sin valor no escribe y lo dice, en vez de guardar un cero', async () => {
        // Guardar `0` sería declarar «facturo cero», que es una afirmación
        // distinta de «todavía no lo he puesto» — la misma distinción que
        // sostiene todo el motor.
        render(<CapturaCampo chequeo={chequeo({})} onGuardado={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /Añadir volumen/i }));
        fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

        await waitFor(() => expect(screen.getByText(/Indica el volumen de negocio/i)).toBeInTheDocument());
        expect(perfilService.upsertEjercicio).not.toHaveBeenCalled();
    });

    it('un fallo del servicio se muestra y no cierra el formulario', async () => {
        vi.mocked(perfilService.addAcreditacion).mockResolvedValue({ ok: false, error: new Error('sin permisos') });
        render(<CapturaCampo chequeo={chequeo({ id: 'certificaciones' })} onGuardado={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /Añadir certificación/i }));
        fireEvent.change(screen.getByLabelText(/Certificación/i), { target: { value: 'ISO 9001' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

        await waitFor(() => expect(screen.getByText('sin permisos')).toBeInTheDocument());
        expect(screen.getByLabelText(/Certificación/i)).toBeInTheDocument();
    });

    it('reconoce ENS frente a ISO por el identificador', async () => {
        render(<CapturaCampo chequeo={chequeo({ id: 'certificaciones' })} onGuardado={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /Añadir certificación/i }));
        fireEvent.change(screen.getByLabelText(/Certificación/i), { target: { value: 'ENS-Alto' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

        await waitFor(() =>
            expect(perfilService.addAcreditacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ens' }))
        );
    });
});
