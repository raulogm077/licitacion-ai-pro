import { useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { perfilService } from '../../../../services/perfil.service';
import { esCampoDelPerfil, type Chequeo } from '../../../../shared/go-no-go';

/**
 * Captura incremental del perfil (ADR-002 Paso 3).
 *
 * Es el paso que decide si todo lo demás se usa. El riesgo dominante de la ADR
 * nunca fue técnico: es un onboarding largo que nadie completa, que deja el
 * Go/No-Go respondiendo «desconocido» a todo y convierte la funcionalidad en
 * decoración.
 *
 * Por eso no hay formulario de perfil. Se pide **el campo concreto que falta,
 * donde falta**: dentro del chequeo que no se pudo verificar, con el contexto
 * de por qué hace falta delante. El usuario rellena un número y ve el veredicto
 * cambiar; nadie le pide su vida empresarial por adelantado.
 *
 * ## Un campo del pliego no es un campo del perfil
 *
 * `camposFaltantes` puede señalar `pliego.cpv`, que significa que el expediente
 * no traía CPV utilizable. Eso no lo puede arreglar el usuario rellenando su
 * perfil, así que ahí no se ofrece captura: ofrecerla sería pedirle que
 * corrija un documento que no es suyo.
 */

const AÑO_ACTUAL = new Date().getFullYear();

interface Props {
    chequeo: Chequeo;
    /** Se llama tras guardar, para que el veredicto se recalcule. */
    onGuardado: () => void;
}

export function CapturaCampo({ chequeo, onGuardado }: Props) {
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [valores, setValores] = useState<Record<string, string>>({});

    const faltantesDelPerfil = (chequeo.camposFaltantes ?? []).filter(esCampoDelPerfil);
    if (chequeo.estado !== 'no_verificable' || faltantesDelPerfil.length === 0) return null;

    const campo = (nombre: string) => valores[nombre] ?? '';
    const numero = (nombre: string): number | null => {
        const n = Number(campo(nombre).replace(',', '.'));
        return Number.isFinite(n) && campo(nombre).trim() !== '' ? n : null;
    };

    async function guardar() {
        setGuardando(true);
        setError(null);
        try {
            const r = await escribir();
            if (!r.ok) {
                setError(r.error.message);
                return;
            }
            setAbierto(false);
            setValores({});
            onGuardado();
        } finally {
            setGuardando(false);
        }
    }

    function escribir() {
        switch (chequeo.id) {
            case 'van': {
                const volumen = numero('volumenNegocio');
                if (volumen === null) return Promise.resolve(errorDe('Indica el volumen de negocio.'));
                return perfilService.upsertEjercicio({
                    ejercicio: numero('ejercicio') ?? AÑO_ACTUAL,
                    volumenNegocio: volumen,
                    // Opcional a propósito: muchos pliegos piden el volumen «en
                    // el ámbito» del contrato, pero exigirlo aquí frenaría al
                    // usuario que solo conoce el total.
                    volumenAmbito: numero('volumenAmbito'),
                });
            }
            case 'seguro_rc': {
                const cobertura = numero('importeCobertura');
                if (cobertura === null) return Promise.resolve(errorDe('Indica el importe de cobertura.'));
                return perfilService.addAcreditacion({ tipo: 'seguro_rc', importeCobertura: cobertura });
            }
            case 'similitud_cpv': {
                const cpv = campo('cpv').trim();
                if (!cpv) return Promise.resolve(errorDe('Indica al menos un código CPV.'));
                return perfilService.addProyecto({
                    denominacion: campo('denominacion').trim() || null,
                    cpv: cpv
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean),
                    importe: numero('importe'),
                    certificadoBuenaEjecucion: null,
                });
            }
            case 'certificaciones': {
                const identificador = campo('identificador').trim();
                if (!identificador) return Promise.resolve(errorDe('Indica la certificación.'));
                return perfilService.addAcreditacion({
                    tipo: /ens/i.test(identificador) ? 'ens' : 'iso',
                    identificador,
                });
            }
        }
    }

    if (!abierto) {
        return (
            <button
                type="button"
                onClick={() => setAbierto(true)}
                className="mt-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {ETIQUETA_ACCION[chequeo.id]}
            </button>
        );
    }

    return (
        <div className="mt-2 space-y-2 rounded border border-slate-200 bg-white p-2">
            {CAMPOS[chequeo.id].map((c) => (
                <label key={c.nombre} className="block text-xs text-slate-600">
                    {c.etiqueta}
                    <input
                        type={c.tipo}
                        value={campo(c.nombre)}
                        onChange={(e) => setValores((v) => ({ ...v, [c.nombre]: e.target.value }))}
                        placeholder={c.placeholder}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
                    />
                </label>
            ))}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando}
                    className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                    {guardando ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Check className="h-3 w-3" aria-hidden="true" />
                    )}
                    Guardar
                </button>
                <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

function errorDe(mensaje: string) {
    return { ok: false as const, error: new Error(mensaje) };
}

const ETIQUETA_ACCION: Record<Chequeo['id'], string> = {
    van: 'Añadir volumen de negocio',
    seguro_rc: 'Añadir póliza de RC',
    similitud_cpv: 'Añadir proyecto similar',
    certificaciones: 'Añadir certificación',
};

interface CampoForm {
    nombre: string;
    etiqueta: string;
    tipo: 'text' | 'number';
    placeholder?: string;
}

const CAMPOS: Record<Chequeo['id'], CampoForm[]> = {
    van: [
        { nombre: 'ejercicio', etiqueta: 'Ejercicio', tipo: 'number', placeholder: String(AÑO_ACTUAL) },
        { nombre: 'volumenNegocio', etiqueta: 'Volumen de negocio (€)', tipo: 'number' },
        { nombre: 'volumenAmbito', etiqueta: 'En el ámbito del contrato (€, opcional)', tipo: 'number' },
    ],
    seguro_rc: [{ nombre: 'importeCobertura', etiqueta: 'Cobertura de la póliza (€)', tipo: 'number' }],
    similitud_cpv: [
        { nombre: 'denominacion', etiqueta: 'Proyecto (opcional)', tipo: 'text' },
        { nombre: 'cpv', etiqueta: 'CPV (separa varios con comas)', tipo: 'text', placeholder: '72212000-4' },
        { nombre: 'importe', etiqueta: 'Importe (€)', tipo: 'number' },
    ],
    certificaciones: [
        { nombre: 'identificador', etiqueta: 'Certificación', tipo: 'text', placeholder: 'ISO 9001 / ENS-Alto' },
    ],
};
