/**
 * Go/No-Go: ¿me presento a esta licitación?
 *
 * El pipeline extrae con evidencia lo que el órgano de contratación EXIGE y
 * `ADR-002` aportó el otro lado: lo que la empresa TIENE. Este módulo los
 * compara siguiendo la Guía §3, y responde la pregunta que un licitador se hace
 * antes que ninguna otra.
 *
 * Es una capa post-extracción de funciones puras, al lado de `scoring.ts` y con
 * su mismo principio rector: **no adivinar**. Aquí eso tiene una forma concreta
 * y es la razón de ser del módulo.
 *
 * ## Un dato ausente no es un incumplimiento
 *
 * Cada chequeo devuelve `cumple`, `no_cumple` o `no_verificable`, y el tercero
 * no es un caso de borde: es el estado dominante mientras el perfil está a
 * medias. Un «no cumples» calculado sobre un campo que nadie rellenó es
 * exactamente la falsa autoridad que el resto del producto evita —
 * `absenceIsConclusive()` decide lo mismo sobre las citas (ADR-003), y esta es
 * su contrapartida sobre el perfil. Por eso `no_verificable` nombra siempre
 * **qué campo falta**: sirve para pedirlo, no solo para no responder.
 *
 * ## El cero que no es un cero
 *
 * `cifraNegocioAnualMinima` llega del schema canónico con `safeCoerceNumber(0)`,
 * así que un requisito que el pliego no declara aparece como `0`. Tomarlo al pie
 * de la letra —«exigen cero euros, luego cumples»— convierte una ausencia en un
 * aprobado. Se trata como no declarado, que es el mismo error que
 * `ARCHITECTURE.md` §8.24 documenta sobre los contadores de ingesta.
 */

// ─── Entradas ────────────────────────────────────────────────────────────────

/** Lo que el pliego exige, tal y como lo deja la extracción. */
export interface RequisitosPliego {
    /** Cifra de negocio anual mínima exigida. `0`/ausente = no declarada. */
    cifraNegocioAnualMinima?: number | null;
    /** Presupuesto base de licitación, para derivar el VAN cuando no es explícito. */
    presupuestoBaseLicitacion?: number | null;
    /** Duración del contrato en meses, para el mismo cálculo. */
    duracionMeses?: number | null;
    /** CPV del contrato. */
    cpv?: string[] | null;
    /** Importe mínimo acumulado en proyectos similares, si el pliego lo fija. */
    importeMinimoProyectosSimilares?: number | null;
    /** Cobertura mínima del seguro de responsabilidad civil. */
    coberturaSeguroExigida?: number | null;
    /** Certificaciones exigidas, tal y como aparecen: «ISO 9001», «ENS-Alto»… */
    certificacionesExigidas?: string[] | null;
}

export interface EjercicioEmpresa {
    ejercicio: number;
    volumenNegocio?: number | null;
    /** Volumen en el ámbito del contrato. Prevalece cuando existe. */
    volumenAmbito?: number | null;
}

export interface ProyectoEmpresa {
    denominacion?: string | null;
    cpv?: string[] | null;
    importe?: number | null;
    fechaFin?: string | null;
    certificadoBuenaEjecucion?: boolean | null;
}

export interface AcreditacionEmpresa {
    tipo: 'iso' | 'ens' | 'seguro_rc' | 'otra';
    identificador?: string | null;
    importeCobertura?: number | null;
    /** ISO-8601. Una acreditación caducada es un no-cumple, no un cumple. */
    fechaCaducidad?: string | null;
}

export interface PerfilEmpresa {
    ejercicios?: EjercicioEmpresa[];
    proyectos?: ProyectoEmpresa[];
    acreditaciones?: AcreditacionEmpresa[];
}

// ─── Salidas ─────────────────────────────────────────────────────────────────

export type EstadoChequeo = 'cumple' | 'no_cumple' | 'no_verificable';

export interface Chequeo {
    id: 'van' | 'seguro_rc' | 'similitud_cpv' | 'certificaciones';
    /** Referencia a la sección de la Guía que lo define. */
    guia: string;
    estado: EstadoChequeo;
    /** Explicación en una frase, apta para mostrar tal cual. */
    detalle: string;
    /**
     * Campos que faltan para poder decidir. Sólo se rellena con
     * `no_verificable`, y nunca queda vacío en ese estado: un «no sé» que no
     * dice qué le falta no sirve para pedirlo.
     */
    camposFaltantes?: string[];
}

export interface VeredictoGoNoGo {
    /**
     * `no_go` si algún chequeo es `no_cumple`. `desconocido` si ninguno falla
     * pero alguno no se puede verificar — nunca `go` sobre datos incompletos.
     */
    veredicto: 'go' | 'no_go' | 'desconocido';
    chequeos: Chequeo[];
    /** Unión de los campos que faltan, para el enlace de «completa tu perfil». */
    camposFaltantes: string[];
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Un importe solo cuenta si es un número finito y positivo. El `0` queda fuera
 * a propósito: en este dominio nunca significa «cero euros exigidos», significa
 * que el valor no llegó (ver cabecera).
 */
function importeDeclarado(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function noVerificable(id: Chequeo['id'], guia: string, detalle: string, camposFaltantes: string[]): Chequeo {
    return { id, guia, estado: 'no_verificable', detalle, camposFaltantes };
}

/** Los tres primeros dígitos del CPV: la presunción legal de similitud (§3.2.1). */
export function familiaCpv(cpv: string): string | null {
    const digitos = cpv.replace(/\D/g, '');
    return digitos.length >= 3 ? digitos.slice(0, 3) : null;
}

function estaCaducada(acreditacion: AcreditacionEmpresa, hoy: Date): boolean {
    if (!acreditacion.fechaCaducidad) return false;
    const fecha = new Date(acreditacion.fechaCaducidad);
    return !Number.isNaN(fecha.getTime()) && fecha < hoy;
}

// ─── §3.1.1 Volumen Anual de Negocios ────────────────────────────────────────

/**
 * VAN exigido. Si el pliego no lo declara, la Guía autoriza derivarlo:
 * `1,5 × (PBL / duración en años)`. Devuelve `null` si tampoco hay con qué.
 */
export function vanExigido(req: RequisitosPliego): number | null {
    if (importeDeclarado(req.cifraNegocioAnualMinima)) return req.cifraNegocioAnualMinima;
    if (importeDeclarado(req.presupuestoBaseLicitacion) && importeDeclarado(req.duracionMeses)) {
        const anios = req.duracionMeses / 12;
        return 1.5 * (req.presupuestoBaseLicitacion / anios);
    }
    return null;
}

/** El mejor de los tres últimos ejercicios disponibles, como pide la LCSP. */
export function mejorVanEmpresa(ejercicios: EjercicioEmpresa[]): number | null {
    const ordenados = [...ejercicios].sort((a, b) => b.ejercicio - a.ejercicio).slice(0, 3);
    const valores = ordenados
        // El volumen «en el ámbito» prevalece cuando existe: es el que muchos
        // pliegos exigen, y usar el total en su lugar infla el cumplimiento.
        .map((e) => (importeDeclarado(e.volumenAmbito) ? e.volumenAmbito : e.volumenNegocio))
        .filter(importeDeclarado);
    return valores.length > 0 ? Math.max(...valores) : null;
}

function chequeoVan(req: RequisitosPliego, perfil: PerfilEmpresa): Chequeo {
    const exigido = vanExigido(req);
    const disponible = mejorVanEmpresa(perfil.ejercicios ?? []);

    if (exigido === null || disponible === null) {
        const faltantes = [
            ...(exigido === null ? ['pliego.cifraNegocioAnualMinima'] : []),
            ...(disponible === null ? ['perfil.ejercicios.volumenNegocio'] : []),
        ];
        return noVerificable('van', '§3.1.1', 'No se puede comparar el volumen de negocio.', faltantes);
    }

    return {
        id: 'van',
        guia: '§3.1.1',
        estado: disponible >= exigido ? 'cumple' : 'no_cumple',
        detalle:
            disponible >= exigido
                ? `Volumen declarado ${disponible} ≥ exigido ${Math.round(exigido)}.`
                : `Volumen declarado ${disponible} por debajo del exigido ${Math.round(exigido)}. Considera solvencia externa o UTE.`,
    };
}

// ─── §3.1.2 Seguro de responsabilidad civil ──────────────────────────────────

function chequeoSeguro(req: RequisitosPliego, perfil: PerfilEmpresa, hoy: Date): Chequeo {
    if (!importeDeclarado(req.coberturaSeguroExigida)) {
        return {
            id: 'seguro_rc',
            guia: '§3.1.2',
            estado: 'cumple',
            detalle: 'El pliego no exige seguro de responsabilidad civil.',
        };
    }

    const polizas = (perfil.acreditaciones ?? []).filter((a) => a.tipo === 'seguro_rc');
    if (polizas.length === 0) {
        return noVerificable('seguro_rc', '§3.1.2', 'No hay póliza declarada en el perfil.', [
            'perfil.acreditaciones.seguro_rc',
        ]);
    }

    const vigentes = polizas.filter((p) => !estaCaducada(p, hoy));
    if (vigentes.length === 0) {
        return {
            id: 'seguro_rc',
            guia: '§3.1.2',
            estado: 'no_cumple',
            detalle: 'La póliza declarada está caducada.',
        };
    }

    const coberturas = vigentes.map((p) => p.importeCobertura).filter(importeDeclarado);
    if (coberturas.length === 0) {
        return noVerificable('seguro_rc', '§3.1.2', 'La póliza no declara importe de cobertura.', [
            'perfil.acreditaciones.importeCobertura',
        ]);
    }

    const mejor = Math.max(...coberturas);
    return {
        id: 'seguro_rc',
        guia: '§3.1.2',
        estado: mejor >= req.coberturaSeguroExigida ? 'cumple' : 'no_cumple',
        detalle: `Cobertura ${mejor} frente a ${req.coberturaSeguroExigida} exigidos.`,
    };
}

// ─── §3.2.1 Similitud por CPV ────────────────────────────────────────────────

export interface ProyectosSimilares {
    proyectos: ProyectoEmpresa[];
    importeAcumulado: number;
}

/** Proyectos cuya familia CPV (3 dígitos) coincide con alguna del contrato. */
export function proyectosSimilares(req: RequisitosPliego, perfil: PerfilEmpresa): ProyectosSimilares {
    const familias = new Set((req.cpv ?? []).map(familiaCpv).filter((f): f is string => f !== null));
    const proyectos = (perfil.proyectos ?? []).filter((p) =>
        (p.cpv ?? []).some((c) => {
            const familia = familiaCpv(c);
            return familia !== null && familias.has(familia);
        })
    );
    const importeAcumulado = proyectos
        .map((p) => p.importe)
        .filter(importeDeclarado)
        .reduce((a, b) => a + b, 0);
    return { proyectos, importeAcumulado };
}

function chequeoSimilitud(req: RequisitosPliego, perfil: PerfilEmpresa): Chequeo {
    const familias = (req.cpv ?? []).map(familiaCpv).filter((f) => f !== null);
    if (familias.length === 0) {
        return noVerificable('similitud_cpv', '§3.2.1', 'El pliego no aporta CPV utilizable.', ['pliego.cpv']);
    }
    if ((perfil.proyectos ?? []).length === 0) {
        return noVerificable('similitud_cpv', '§3.2.1', 'El perfil no tiene proyectos declarados.', [
            'perfil.proyectos',
        ]);
    }

    const { proyectos, importeAcumulado } = proyectosSimilares(req, perfil);
    if (proyectos.length === 0) {
        return {
            id: 'similitud_cpv',
            guia: '§3.2.1',
            estado: 'no_cumple',
            detalle: 'Ningún proyecto del histórico comparte familia CPV con el contrato.',
        };
    }

    // Sin umbral declarado no se puede juzgar el importe, pero la experiencia
    // sí está acreditada: se informa de lo que hay en vez de inventar el 70 %
    // habitual, que es una costumbre y no una regla del pliego.
    if (!importeDeclarado(req.importeMinimoProyectosSimilares)) {
        return {
            id: 'similitud_cpv',
            guia: '§3.2.1',
            estado: 'cumple',
            detalle: `${proyectos.length} proyecto(s) de familia CPV coincidente. El pliego no fija importe mínimo.`,
        };
    }

    return {
        id: 'similitud_cpv',
        guia: '§3.2.1',
        estado: importeAcumulado >= req.importeMinimoProyectosSimilares ? 'cumple' : 'no_cumple',
        detalle: `${proyectos.length} proyecto(s) similares por ${importeAcumulado}, frente a ${req.importeMinimoProyectosSimilares} exigidos.`,
    };
}

// ─── §3.2.2 Certificaciones ──────────────────────────────────────────────────

function normalizaCertificacion(raw: string): string {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function chequeoCertificaciones(req: RequisitosPliego, perfil: PerfilEmpresa, hoy: Date): Chequeo {
    const exigidas = (req.certificacionesExigidas ?? []).filter((c) => c.trim().length > 0);
    if (exigidas.length === 0) {
        return {
            id: 'certificaciones',
            guia: '§3.2.2',
            estado: 'cumple',
            detalle: 'El pliego no exige certificaciones.',
        };
    }

    const acreditaciones = (perfil.acreditaciones ?? []).filter((a) => a.tipo === 'iso' || a.tipo === 'ens');
    if (acreditaciones.length === 0) {
        return noVerificable('certificaciones', '§3.2.2', 'El perfil no declara certificaciones.', [
            'perfil.acreditaciones',
        ]);
    }

    const vigentes = acreditaciones
        .filter((a) => !estaCaducada(a, hoy))
        .map((a) => normalizaCertificacion(a.identificador ?? ''));

    // Una certificación caducada se trata como ausente, nunca como presente:
    // presentarla acreditaría algo que el órgano rechazaría.
    const faltan = exigidas.filter((exigida) => {
        const objetivo = normalizaCertificacion(exigida);
        return !vigentes.some((v) => v.includes(objetivo) || objetivo.includes(v));
    });

    return {
        id: 'certificaciones',
        guia: '§3.2.2',
        estado: faltan.length === 0 ? 'cumple' : 'no_cumple',
        detalle:
            faltan.length === 0
                ? 'Todas las certificaciones exigidas están vigentes.'
                : `Faltan o están caducadas: ${faltan.join(', ')}. Bloqueante.`,
    };
}

// ─── Veredicto ───────────────────────────────────────────────────────────────

/**
 * Evalúa los cuatro chequeos de viabilidad de la Guía §3.
 *
 * `hoy` se inyecta para que los tests de caducidad sean deterministas; en
 * producción se omite.
 */
export function evaluarGoNoGo(req: RequisitosPliego, perfil: PerfilEmpresa, hoy: Date = new Date()): VeredictoGoNoGo {
    const chequeos = [
        chequeoVan(req, perfil),
        chequeoSeguro(req, perfil, hoy),
        chequeoSimilitud(req, perfil),
        chequeoCertificaciones(req, perfil, hoy),
    ];

    const camposFaltantes = [...new Set(chequeos.flatMap((c) => c.camposFaltantes ?? []))];

    // El orden importa: un `no_cumple` manda sobre un `no_verificable`, porque
    // saber que estás excluido es información aunque el resto falte. Lo que no
    // ocurre nunca es un `go` con algo sin verificar.
    const veredicto = chequeos.some((c) => c.estado === 'no_cumple')
        ? 'no_go'
        : chequeos.some((c) => c.estado === 'no_verificable')
          ? 'desconocido'
          : 'go';

    return { veredicto, chequeos, camposFaltantes };
}
