import { supabase as defaultClient } from '../config/supabase';
import { Result, ok, err } from '../lib/Result';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AcreditacionEmpresa, EjercicioEmpresa, PerfilEmpresa, ProyectoEmpresa } from '../shared/go-no-go';

/**
 * Lectura y escritura del perfil del licitador (ADR-002).
 *
 * Cierra el hueco entre las tablas del Paso 1 y el motor del Paso 2: las
 * primeras existen y el segundo sabe decidir, pero nada las conectaba. Los
 * pasos 3 a 5 de la ADR —captura incremental, panel y tool del copiloto— pasan
 * todos por aquí.
 *
 * ## Es la excepción a «mutaciones backend-only»
 *
 * El resto del modelo se escribe desde el backend y el navegador solo lee por
 * RLS. Este dato lo introduce el usuario, así que aquí sí hay escritura desde
 * el cliente, con políticas owner-scoped. Dos consecuencias que no se pueden
 * relajar:
 *
 * 1. **`perfil_id`, nunca `user_id`, en las hijas.** El servicio resuelve el
 *    perfil primero y cuelga todo de su `id`. Escribir `user_id` en una hija
 *    funcionaría hoy y encarecería la migración a perfil de organización
 *    (decisión 7.1), y por eso ni siquiera se expone la opción.
 * 2. **`nif` no viaja a los logs.** `logger` no lo toca aquí y el copiloto
 *    recibe el veredicto ya calculado, no el perfil (decisión 7.3).
 *
 * ## Un perfil vacío es un resultado válido
 *
 * `getPerfilParaEvaluacion` devuelve `ok` con listas vacías cuando el usuario
 * aún no ha rellenado nada. No es un error: es el estado normal al principio, y
 * el motor lo traduce a `no_verificable` con el campo que falta. Devolver `err`
 * aquí obligaría a la UI a distinguir «fallo» de «todavía no», que es
 * exactamente la distinción que el motor ya sabe hacer.
 */

interface PerfilRow {
    id: string;
    razon_social: string | null;
    nif: string | null;
    num_empleados: number | null;
}

interface EjercicioRow {
    ejercicio: number;
    volumen_negocio: number | null;
    volumen_ambito: number | null;
}

interface ProyectoRow {
    denominacion: string | null;
    cpv: string[] | null;
    importe: number | null;
    fecha_fin: string | null;
    certificado_buena_ejecucion: boolean | null;
}

interface AcreditacionRow {
    tipo: AcreditacionEmpresa['tipo'];
    identificador: string | null;
    importe_cobertura: number | null;
    fecha_caducidad: string | null;
}

/** Datos de cabecera del perfil, para la pantalla de edición. */
export interface PerfilCabecera {
    id: string;
    razonSocial: string | null;
    nif: string | null;
    numEmpleados: number | null;
}

export class PerfilService {
    private client: SupabaseClient;

    constructor(client: SupabaseClient = defaultClient) {
        this.client = client;
    }

    private async requireSession(): Promise<Result<{ userId: string }>> {
        const {
            data: { session },
        } = await this.client.auth.getSession();
        if (!session) return err(new Error('Usuario no autenticado'));
        return ok({ userId: session.user.id });
    }

    /**
     * Perfil del usuario actual, o `null` si todavía no ha creado ninguno.
     *
     * `null` no es un error: es el estado de quien acaba de registrarse.
     */
    async getPerfil(): Promise<Result<PerfilCabecera | null>> {
        try {
            const session = await this.requireSession();
            if (!session.ok) return err(session.error);

            const { data, error } = await this.client
                .from('empresa_perfil')
                .select('id, razon_social, nif, num_empleados')
                .maybeSingle();

            if (error) return err(new Error(error.message));
            if (!data) return ok(null);

            const row = data as PerfilRow;
            return ok({
                id: row.id,
                razonSocial: row.razon_social,
                nif: row.nif,
                numEmpleados: row.num_empleados,
            });
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Crea el perfil del usuario si no existe y devuelve su `id`.
     *
     * `user_id` se toma de la sesión, nunca de un parámetro: aceptarlo desde
     * fuera dejaría que la UI intentase escribir en el perfil de otro, y aunque
     * RLS lo rechazaría, el error llegaría tarde y sin explicación útil.
     */
    async ensurePerfil(): Promise<Result<string>> {
        try {
            const session = await this.requireSession();
            if (!session.ok) return err(session.error);

            const existente = await this.getPerfil();
            if (!existente.ok) return err(existente.error);
            if (existente.value) return ok(existente.value.id);

            const { data, error } = await this.client
                .from('empresa_perfil')
                .insert({ user_id: session.value.userId })
                .select('id')
                .single();

            if (error) return err(new Error(error.message));
            return ok((data as { id: string }).id);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Perfil completo en la forma que consume `evaluarGoNoGo`.
     *
     * Traduce `snake_case` de Postgres al camelCase del motor. Esa traducción
     * vive aquí y no en el motor a propósito: el motor debe poder evaluar datos
     * que no vengan de esta base —un formulario, un test, una importación— sin
     * arrastrar el esquema de la tabla.
     */
    async getPerfilParaEvaluacion(): Promise<Result<PerfilEmpresa>> {
        try {
            const cabecera = await this.getPerfil();
            if (!cabecera.ok) return err(cabecera.error);
            // Sin perfil no hay nada que evaluar, pero tampoco hay fallo: el
            // motor devolverá `no_verificable` nombrando lo que falta.
            if (!cabecera.value) return ok({ ejercicios: [], proyectos: [], acreditaciones: [] });

            const perfilId = cabecera.value.id;

            const [ejercicios, proyectos, acreditaciones] = await Promise.all([
                this.client
                    .from('empresa_ejercicio')
                    .select('ejercicio, volumen_negocio, volumen_ambito')
                    .eq('perfil_id', perfilId),
                this.client
                    .from('empresa_proyecto')
                    .select('denominacion, cpv, importe, fecha_fin, certificado_buena_ejecucion')
                    .eq('perfil_id', perfilId),
                this.client
                    .from('empresa_acreditacion')
                    .select('tipo, identificador, importe_cobertura, fecha_caducidad')
                    .eq('perfil_id', perfilId),
            ]);

            const fallo = [ejercicios, proyectos, acreditaciones].find((r) => r.error);
            if (fallo?.error) return err(new Error(fallo.error.message));

            return ok({
                ejercicios: ((ejercicios.data ?? []) as EjercicioRow[]).map((r): EjercicioEmpresa => ({
                    ejercicio: r.ejercicio,
                    volumenNegocio: r.volumen_negocio,
                    volumenAmbito: r.volumen_ambito,
                })),
                proyectos: ((proyectos.data ?? []) as ProyectoRow[]).map((r): ProyectoEmpresa => ({
                    denominacion: r.denominacion,
                    cpv: r.cpv,
                    importe: r.importe,
                    fechaFin: r.fecha_fin,
                    certificadoBuenaEjecucion: r.certificado_buena_ejecucion,
                })),
                acreditaciones: ((acreditaciones.data ?? []) as AcreditacionRow[]).map((r): AcreditacionEmpresa => ({
                    tipo: r.tipo,
                    identificador: r.identificador,
                    importeCobertura: r.importe_cobertura,
                    fechaCaducidad: r.fecha_caducidad,
                })),
            });
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Guarda un ejercicio. `onConflict` sobre `(perfil_id, ejercicio)` para que
     * corregir una cifra ya declarada sea una edición y no una fila duplicada
     * que luego compita consigo misma en el cálculo del mejor VAN.
     */
    async upsertEjercicio(ejercicio: EjercicioEmpresa): Promise<Result<void>> {
        return this.escribirHija(
            'empresa_ejercicio',
            {
                ejercicio: ejercicio.ejercicio,
                volumen_negocio: ejercicio.volumenNegocio ?? null,
                volumen_ambito: ejercicio.volumenAmbito ?? null,
            },
            // Solo esta tabla tiene UNIQUE(perfil_id, ejercicio). Pasar este
            // `onConflict` a las otras dos las haría fallar, porque Postgres
            // exige que la restricción exista.
            'perfil_id,ejercicio'
        );
    }

    async addProyecto(proyecto: ProyectoEmpresa): Promise<Result<void>> {
        return this.escribirHija('empresa_proyecto', {
            denominacion: proyecto.denominacion ?? null,
            cpv: proyecto.cpv ?? [],
            importe: proyecto.importe ?? null,
            fecha_fin: proyecto.fechaFin ?? null,
            certificado_buena_ejecucion: proyecto.certificadoBuenaEjecucion ?? null,
        });
    }

    async addAcreditacion(acreditacion: AcreditacionEmpresa): Promise<Result<void>> {
        return this.escribirHija('empresa_acreditacion', {
            tipo: acreditacion.tipo,
            identificador: acreditacion.identificador ?? null,
            importe_cobertura: acreditacion.importeCobertura ?? null,
            fecha_caducidad: acreditacion.fechaCaducidad ?? null,
        });
    }

    /**
     * Único camino de escritura a las tablas hijas.
     *
     * Existe para que `perfil_id` se resuelva siempre desde la sesión y en un
     * solo sitio. Si cada método lo hiciera por su cuenta, bastaría un olvido
     * para acabar colgando una fila de `user_id` — el error de la decisión 7.1,
     * que no da síntoma hasta el día de migrar a perfil de organización.
     */
    private async escribirHija(
        tabla: string,
        fila: Record<string, unknown>,
        /** Restricción única sobre la que hacer upsert. Sin ella, es un insert. */
        onConflict?: string
    ): Promise<Result<void>> {
        try {
            const perfilId = await this.ensurePerfil();
            if (!perfilId.ok) return err(perfilId.error);

            const conPerfil = { ...fila, perfil_id: perfilId.value };
            const tablaRef = this.client.from(tabla);
            const { error } = onConflict
                ? await tablaRef.upsert(conPerfil, { onConflict })
                : await tablaRef.insert(conPerfil);

            if (error) return err(new Error(error.message));
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

export const perfilService = new PerfilService();
