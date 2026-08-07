import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, ShieldAlert, XCircle } from 'lucide-react';
import { PliegoVM } from '../../model/pliego-vm';
import {
    evaluarGoNoGo,
    requisitosDesdeAnalisis,
    type EstadoChequeo,
    type PerfilEmpresa,
} from '../../../../shared/go-no-go';
import { perfilService } from '../../../../services/perfil.service';

/**
 * Panel Go/No-Go (ADR-002 Paso 4).
 *
 * Responde «¿me presento?» comparando lo que el pliego exige con lo que el
 * licitador tiene. La decisión de diseño que manda aquí es la 7.4:
 *
 * **`no_verificable` no se presenta como incumplimiento.** Ni color de error,
 * ni icono de rechazo, ni lenguaje de exclusión. Un dato que el usuario no ha
 * rellenado no es un requisito que no cumple, y confundirlos haría que
 * descartase una licitación a la que sí podía presentarse. Se muestra en tono
 * neutro y nombrando el campo que falta, para que la acción evidente sea
 * rellenarlo y no rendirse.
 *
 * El estado no viaja solo por color: cada chequeo lleva icono y etiqueta de
 * texto, y el `aria-label` incluye el estado en palabras.
 */

const ESTADO_CONFIG: Record<
    EstadoChequeo,
    { icon: React.ElementType; contenedor: string; icono: string; etiqueta: string; texto: string }
> = {
    cumple: {
        icon: CheckCircle2,
        contenedor: 'border-l-emerald-500 bg-emerald-50/60 border-emerald-100',
        icono: 'text-emerald-600',
        etiqueta: 'text-emerald-700 bg-emerald-100 border-emerald-200',
        texto: 'Cumples',
    },
    no_cumple: {
        icon: XCircle,
        contenedor: 'border-l-red-500 bg-red-50/60 border-red-100',
        icono: 'text-red-500',
        etiqueta: 'text-red-600 bg-red-100 border-red-200',
        texto: 'No cumples',
    },
    // Deliberadamente gris y no ámbar: el ámbar se lee como advertencia, y esto
    // no lo es. Es una pregunta sin responder todavía.
    no_verificable: {
        icon: HelpCircle,
        contenedor: 'border-l-slate-300 bg-slate-50/60 border-slate-200',
        icono: 'text-slate-400',
        etiqueta: 'text-slate-600 bg-slate-100 border-slate-200',
        texto: 'Falta un dato tuyo',
    },
};

const VEREDICTO_TEXTO: Record<'go' | 'no_go' | 'desconocido', { titulo: string; detalle: string }> = {
    go: {
        titulo: 'Cumples los requisitos comprobables',
        detalle: 'Ningún chequeo de solvencia te excluye con los datos de tu perfil.',
    },
    no_go: {
        titulo: 'Hay un requisito que no cumples',
        detalle: 'Presentarte con este perfil expone la oferta a exclusión. Revisa el chequeo marcado.',
    },
    desconocido: {
        titulo: 'Faltan datos de tu perfil para decidir',
        detalle: 'Ningún requisito te excluye, pero tampoco se puede confirmar que los cumples.',
    },
};

interface Props {
    vm: PliegoVM;
    /** Inyectable para los tests; en producción usa el servicio real. */
    cargarPerfil?: () => Promise<PerfilEmpresa | null>;
}

export function GoNoGoPanel({ vm, cargarPerfil }: Props) {
    const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let vigente = true;
        const cargar =
            cargarPerfil ??
            (async () => {
                const r = await perfilService.getPerfilParaEvaluacion();
                return r.ok ? r.value : null;
            });

        cargar()
            .then((p) => {
                if (vigente) setPerfil(p);
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });

        return () => {
            vigente = false;
        };
    }, [cargarPerfil]);

    const veredicto = useMemo(() => {
        if (!perfil) return null;
        return evaluarGoNoGo(requisitosDesdeAnalisis(vm.result as unknown as Record<string, unknown>), perfil);
    }, [perfil, vm.result]);

    if (cargando) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-5" aria-busy="true">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
            </section>
        );
    }

    // Sin perfil no se enseña un veredicto vacío: se explica qué falta y para
    // qué sirve. Un panel de «desconocido» a secas parece una avería.
    if (!veredicto) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                    <ShieldAlert className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    ¿Me presento?
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                    Completa el perfil de tu empresa para comprobar automáticamente si cumples los requisitos de
                    solvencia de este expediente.
                </p>
            </section>
        );
    }

    const resumen = VEREDICTO_TEXTO[veredicto.veredicto];

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <ShieldAlert className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                ¿Me presento?
            </h3>

            <p className="mt-1 text-sm font-medium text-slate-800">{resumen.titulo}</p>
            <p className="text-sm text-slate-600">{resumen.detalle}</p>

            <ul className="mt-4 space-y-2">
                {veredicto.chequeos.map((chequeo) => {
                    const cfg = ESTADO_CONFIG[chequeo.estado];
                    const Icono = cfg.icon;
                    return (
                        <li
                            key={chequeo.id}
                            className={`rounded-lg border border-l-4 p-3 ${cfg.contenedor}`}
                            aria-label={`${chequeo.detalle}. Estado: ${cfg.texto}`}
                        >
                            <div className="flex items-start gap-2">
                                <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icono}`} aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${cfg.etiqueta}`}
                                        >
                                            {cfg.texto}
                                        </span>
                                        {/* La sección de la Guía es lo que hace auditable el
                                            veredicto: sin ella, el panel es una opinión. */}
                                        <span className="text-[11px] text-slate-400">Guía {chequeo.guia}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-700">{chequeo.detalle}</p>
                                    {chequeo.camposFaltantes && chequeo.camposFaltantes.length > 0 && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            Falta en tu perfil: {chequeo.camposFaltantes.join(', ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
