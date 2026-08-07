/**
 * Contrato del servicio de perfil del licitador (ADR-002).
 *
 * Dos invariantes se comprueban aquí porque romperlas no da síntoma en runtime:
 * que toda escritura a una tabla hija cuelgue de `perfil_id` y nunca de
 * `user_id` (decisión 7.1), y que un perfil vacío sea un resultado válido y no
 * un error (decisión 7.4, que el motor traduce a «no verificable»).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerfilService } from '../perfil.service';
import { evaluarGoNoGo } from '../../lib/go-no-go';

const mockClient = {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
};

const asClient = () => mockClient as unknown as import('@supabase/supabase-js').SupabaseClient;

const conSesion = () =>
    mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
    });

const sinSesion = () => mockClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

/** `select(...).maybeSingle()` sobre `empresa_perfil`. */
function perfilExistente(id: string | null) {
    return {
        select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
                data: id ? { id, razon_social: 'ACME', nif: 'B00000000', num_empleados: 60 } : null,
                error: null,
            }),
        }),
    };
}

/** `select(...).eq(...)` sobre una tabla hija. */
function hijaCon(rows: unknown[]) {
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: rows, error: null }) }) };
}

describe('PerfilService', () => {
    let service: PerfilService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PerfilService(asClient());
        conSesion();
    });

    describe('autenticación', () => {
        it('sin sesión no lee el perfil', async () => {
            sinSesion();
            const result = await service.getPerfil();
            expect(result.ok).toBe(false);
            expect(result.error?.message).toContain('no autenticado');
        });

        it('sin sesión no escribe', async () => {
            sinSesion();
            const result = await service.addProyecto({ cpv: ['72212000-4'] });
            expect(result.ok).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });
    });

    describe('un perfil vacío es un resultado válido, no un error', () => {
        it('getPerfil devuelve ok(null) cuando el usuario no ha creado ninguno', async () => {
            mockClient.from.mockReturnValue(perfilExistente(null));
            const result = await service.getPerfil();
            expect(result.ok).toBe(true);
            expect(result.value).toBeNull();
        });

        it('getPerfilParaEvaluacion devuelve listas vacías, no un fallo', async () => {
            // Es el estado de quien acaba de registrarse. Devolver `err` aquí
            // obligaría a la UI a distinguir «fallo» de «todavía no», que es la
            // distinción que el motor ya sabe hacer.
            mockClient.from.mockReturnValue(perfilExistente(null));
            const result = await service.getPerfilParaEvaluacion();
            expect(result.ok).toBe(true);
            expect(result.value).toEqual({ ejercicios: [], proyectos: [], acreditaciones: [] });
        });

        it('ese perfil vacío produce «desconocido» en el motor, nunca un no_cumple', async () => {
            mockClient.from.mockReturnValue(perfilExistente(null));
            const perfil = await service.getPerfilParaEvaluacion();
            const veredicto = evaluarGoNoGo({ cifraNegocioAnualMinima: 1_000_000, cpv: ['72220000-3'] }, perfil.value!);
            expect(veredicto.veredicto).toBe('desconocido');
            expect(veredicto.chequeos.filter((c) => c.estado === 'no_cumple')).toHaveLength(0);
        });
    });

    describe('traducción a la forma que consume el motor', () => {
        it('mapea snake_case a camelCase en las tres hijas', async () => {
            mockClient.from.mockImplementation((tabla: string) => {
                if (tabla === 'empresa_perfil') return perfilExistente('perfil-1');
                if (tabla === 'empresa_ejercicio')
                    return hijaCon([{ ejercicio: 2025, volumen_negocio: 900, volumen_ambito: 500 }]);
                if (tabla === 'empresa_proyecto')
                    return hijaCon([
                        {
                            denominacion: 'Obra',
                            cpv: ['45000000-7'],
                            importe: 100,
                            fecha_fin: '2025-01-01',
                            certificado_buena_ejecucion: true,
                        },
                    ]);
                return hijaCon([
                    { tipo: 'seguro_rc', identificador: null, importe_cobertura: 300, fecha_caducidad: '2027-01-01' },
                ]);
            });

            const { value } = await service.getPerfilParaEvaluacion();
            expect(value?.ejercicios?.[0]).toEqual({ ejercicio: 2025, volumenNegocio: 900, volumenAmbito: 500 });
            expect(value?.proyectos?.[0].certificadoBuenaEjecucion).toBe(true);
            expect(value?.proyectos?.[0].fechaFin).toBe('2025-01-01');
            expect(value?.acreditaciones?.[0].importeCobertura).toBe(300);
        });

        it('propaga el error de cualquiera de las tres consultas', async () => {
            mockClient.from.mockImplementation((tabla: string) => {
                if (tabla === 'empresa_perfil') return perfilExistente('perfil-1');
                if (tabla === 'empresa_proyecto')
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
                        }),
                    };
                return hijaCon([]);
            });

            const result = await service.getPerfilParaEvaluacion();
            expect(result.ok).toBe(false);
            expect(result.error?.message).toBe('boom');
        });
    });

    describe('la invariante que no da síntoma: perfil_id, nunca user_id', () => {
        it('toda escritura a una hija lleva perfil_id y ninguna lleva user_id', async () => {
            const insert = vi.fn().mockResolvedValue({ error: null });
            const upsert = vi.fn().mockResolvedValue({ error: null });
            mockClient.from.mockImplementation((tabla: string) =>
                tabla === 'empresa_perfil' ? perfilExistente('perfil-1') : { insert, upsert }
            );

            await service.upsertEjercicio({ ejercicio: 2025, volumenNegocio: 10 });
            await service.addProyecto({ cpv: ['72212000-4'] });
            await service.addAcreditacion({ tipo: 'iso', identificador: 'ISO 9001' });

            const escrituras = [...upsert.mock.calls, ...insert.mock.calls].map(([fila]) => fila);
            expect(escrituras).toHaveLength(3);
            for (const fila of escrituras) {
                expect(fila).toHaveProperty('perfil_id', 'perfil-1');
                expect(fila).not.toHaveProperty('user_id');
            }
        });

        it('solo el ejercicio hace upsert; las otras dos insertan', async () => {
            // `onConflict: 'perfil_id,ejercicio'` exige que la restricción única
            // exista. Aplicarlo a proyectos o acreditaciones haría fallar la
            // escritura en Postgres.
            const insert = vi.fn().mockResolvedValue({ error: null });
            const upsert = vi.fn().mockResolvedValue({ error: null });
            mockClient.from.mockImplementation((tabla: string) =>
                tabla === 'empresa_perfil' ? perfilExistente('perfil-1') : { insert, upsert }
            );

            await service.upsertEjercicio({ ejercicio: 2025 });
            await service.addProyecto({ cpv: [] });
            await service.addAcreditacion({ tipo: 'ens' });

            expect(upsert).toHaveBeenCalledTimes(1);
            expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'perfil_id,ejercicio' });
            expect(insert).toHaveBeenCalledTimes(2);
        });
    });

    describe('ensurePerfil', () => {
        it('reutiliza el perfil existente en vez de crear otro', async () => {
            const insert = vi.fn();
            mockClient.from.mockReturnValue({ ...perfilExistente('perfil-1'), insert });

            const result = await service.ensurePerfil();
            expect(result.value).toBe('perfil-1');
            expect(insert).not.toHaveBeenCalled();
        });

        it('crea el perfil con el user_id de la sesión, no de un parámetro', async () => {
            // Aceptar `user_id` desde fuera dejaría que la UI intentase escribir
            // en el perfil de otro: RLS lo rechazaría, pero tarde y sin decir
            // por qué.
            const single = vi.fn().mockResolvedValue({ data: { id: 'perfil-nuevo' }, error: null });
            const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
            mockClient.from.mockReturnValue({ ...perfilExistente(null), insert });

            const result = await service.ensurePerfil();
            expect(result.value).toBe('perfil-nuevo');
            expect(insert).toHaveBeenCalledWith({ user_id: 'user-1' });
        });
    });
});
