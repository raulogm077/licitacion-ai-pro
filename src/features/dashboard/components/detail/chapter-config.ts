import { PliegoVM } from '../../model/pliego-vm';

export type RenderPattern = 'row-table' | 'card-list' | 'simple-list' | 'risk-list' | 'key-value-list';

export interface SubsectionConfig {
    id: string;
    title?: string;
    dataExtractor: (vm: PliegoVM) => unknown[];
    fieldPathPrefix: string;
    renderPattern: RenderPattern;
    itemLabel?: (item: unknown, index: number) => string;
    itemValue?: (item: unknown) => string;
    itemBadge?: (item: unknown) => { text: string; variant: string } | null;
    itemSubtext?: (item: unknown) => string | null;
    containerClass?: string;
    iconType?: 'bullet-required' | 'check' | 'check-circle' | 'risk';
    isRequired?: (item: unknown) => boolean;
}

export interface ChapterConfig {
    id: string;
    title: string;
    headerBadge?: (vm: PliegoVM) => { text: string } | null;
    subsections: SubsectionConfig[];
    customHeader?: boolean;
}

function getString(item: unknown, key: string): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
        return ((item as Record<string, unknown>)[key] as string) ?? '';
    }
    return '';
}

export const chapterConfigs: ChapterConfig[] = [
    {
        id: 'datos',
        title: 'Datos Generales',
        subsections: [
            {
                id: 'general-rows',
                dataExtractor: (vm) => {
                    const g = vm.result.datosGenerales;
                    const rows = [
                        { label: 'Título', value: vm.display.titulo, fieldPath: 'result.datosGenerales.titulo' },
                        {
                            label: 'Órgano de Contratación',
                            value: vm.display.organo,
                            fieldPath: 'result.datosGenerales.organoContratacion',
                        },
                        {
                            label: 'Presupuesto Base',
                            value: vm.display.presupuesto,
                            fieldPath: 'result.datosGenerales.presupuesto',
                        },
                        {
                            label: 'Plazo de Ejecución',
                            value: vm.display.plazo,
                            fieldPath: 'result.datosGenerales.plazoEjecucionMeses',
                        },
                        { label: 'CPV', value: vm.display.cpv, fieldPath: 'result.datosGenerales.cpv' },
                    ];
                    if (g.fechaLimitePresentacion) {
                        rows.push({
                            label: 'Fecha Límite',
                            value: g.fechaLimitePresentacion,
                            fieldPath: 'result.datosGenerales.fechaLimitePresentacion',
                        });
                    }
                    return rows;
                },
                fieldPathPrefix: 'result.datosGenerales',
                renderPattern: 'row-table',
                itemLabel: (item) => (item as { label: string }).label,
                itemValue: (item) => (item as { value: string }).value,
            },
        ],
    },
    {
        id: 'criterios',
        title: 'Criterios',
        headerBadge: (vm) => {
            const total =
                vm.result.criteriosAdjudicacion.objetivos.length + vm.result.criteriosAdjudicacion.subjetivos.length;
            return total > 0 ? { text: `Total: ${total}` } : null;
        },
        subsections: [
            {
                id: 'objetivos',
                title: 'Objetivos (Evaluables mediante fórmula)',
                dataExtractor: (vm) => vm.result.criteriosAdjudicacion.objetivos,
                fieldPathPrefix: 'result.criteriosAdjudicacion.objetivos',
                renderPattern: 'card-list',
                itemLabel: (item) => (item as { descripcion: string }).descripcion,
                itemSubtext: (item) => (item as { formula?: string }).formula ?? null,
                itemBadge: (item) => ({
                    text: `${(item as { ponderacion: number }).ponderacion} pts`,
                    variant: 'blue',
                }),
                containerClass: 'dot-blue',
            },
            {
                id: 'subjetivos',
                title: 'Subjetivos (Juicio de valor)',
                dataExtractor: (vm) => vm.result.criteriosAdjudicacion.subjetivos,
                fieldPathPrefix: 'result.criteriosAdjudicacion.subjetivos',
                renderPattern: 'card-list',
                itemLabel: (item) => (item as { descripcion: string }).descripcion,
                itemSubtext: (item) => (item as { detalles?: string }).detalles ?? null,
                itemBadge: (item) => ({
                    text: `${(item as { ponderacion: number }).ponderacion} pts`,
                    variant: 'purple',
                }),
                containerClass: 'dot-purple',
            },
        ],
    },
    {
        id: 'solvencia',
        title: 'Solvencia',
        subsections: [
            {
                id: 'economica',
                title: 'Solvencia Económica',
                dataExtractor: (vm) => {
                    const eco = vm.result.requisitosSolvencia.economica;
                    if (eco.cifraNegocioAnualMinima <= 0 && !jsonHasContent(eco.descripcion)) return [];
                    return [eco];
                },
                fieldPathPrefix: 'result.requisitosSolvencia.economica.cifraNegocioAnualMinima',
                renderPattern: 'key-value-list',
                itemLabel: () => 'Cifra de Negocio Mínima',
                itemValue: (item) => {
                    const eco = item as { cifraNegocioAnualMinima: number; descripcion?: unknown };
                    if (eco.cifraNegocioAnualMinima > 0) {
                        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                            eco.cifraNegocioAnualMinima
                        );
                    }
                    return '';
                },
                itemSubtext: (item) => {
                    const eco = item as { descripcion?: unknown };
                    return jsonHasContent(eco.descripcion) ? String(eco.descripcion) : null;
                },
            },
            {
                id: 'tecnica',
                title: 'Solvencia Técnica',
                dataExtractor: (vm) => vm.result.requisitosSolvencia.tecnica,
                fieldPathPrefix: 'result.requisitosSolvencia.tecnica',
                renderPattern: 'simple-list',
                itemLabel: (item) => getString(item, 'descripcion'),
                iconType: 'check-circle',
            },
        ],
    },
    {
        id: 'tecnicos',
        title: 'Requisitos Técnicos',
        subsections: [
            {
                id: 'funcionales',
                title: 'Funcionales',
                dataExtractor: (vm) => vm.result.requisitosTecnicos.funcionales,
                fieldPathPrefix: 'result.requisitosTecnicos.funcionales',
                renderPattern: 'simple-list',
                itemLabel: (item) => getString(item, 'requisito'),
                iconType: 'bullet-required',
                isRequired: (item) =>
                    typeof item === 'object' ? (item as { obligatorio?: boolean }).obligatorio !== false : true,
            },
            {
                id: 'normativa',
                title: 'Normativa y Estándares',
                dataExtractor: (vm) => vm.result.requisitosTecnicos.normativa,
                fieldPathPrefix: 'result.requisitosTecnicos.normativa',
                renderPattern: 'simple-list',
                itemLabel: (item) => getString(item, 'norma'),
                iconType: 'check',
            },
        ],
    },
    {
        id: 'riesgos',
        title: 'Riesgos y Restricciones',
        customHeader: true,
        subsections: [
            {
                id: 'killCriteria',
                title: 'Kill Criteria (Exclusiones)',
                dataExtractor: (vm) => vm.result.restriccionesYRiesgos.killCriteria,
                fieldPathPrefix: 'result.restriccionesYRiesgos.killCriteria',
                renderPattern: 'risk-list',
                itemLabel: (item) => getString(item, 'criterio'),
                itemSubtext: (item) =>
                    typeof item === 'object' ? ((item as { justificacion?: string }).justificacion ?? null) : null,
                containerClass: 'kill-criteria',
            },
            {
                id: 'riesgos-items',
                dataExtractor: (vm) => vm.result.restriccionesYRiesgos.riesgos,
                fieldPathPrefix: 'result.restriccionesYRiesgos.riesgos',
                renderPattern: 'risk-list',
                itemLabel: (item) => (item as { descripcion: string }).descripcion,
                itemBadge: (item) => {
                    const impacto = (item as { impacto: string }).impacto;
                    const variant =
                        impacto === 'CRITICO' ? 'destructive' : impacto === 'ALTO' ? 'warning' : 'secondary';
                    return { text: impacto, variant };
                },
                itemSubtext: (item) => (item as { mitigacionSugerida?: string }).mitigacionSugerida ?? null,
            },
        ],
    },
    {
        id: 'servicio',
        title: 'Modelo de Servicio',
        subsections: [
            {
                id: 'sla',
                title: 'SLA (Niveles de Servicio)',
                dataExtractor: (vm) => vm.result.modeloServicio.sla,
                fieldPathPrefix: 'result.modeloServicio.sla',
                renderPattern: 'key-value-list',
                itemLabel: (item) => getString(item, 'metrica'),
                itemSubtext: (item) =>
                    typeof item === 'object'
                        ? (item as { objetivo?: string }).objetivo
                            ? `Objetivo: ${(item as { objetivo: string }).objetivo}`
                            : null
                        : null,
            },
            {
                id: 'equipoMinimo',
                title: 'Equipo Mínimo',
                dataExtractor: (vm) => vm.result.modeloServicio.equipoMinimo,
                fieldPathPrefix: 'result.modeloServicio.equipoMinimo',
                renderPattern: 'key-value-list',
                itemLabel: (item) => getString(item, 'rol'),
                itemBadge: (item) => {
                    if (typeof item === 'object' && (item as { experienciaAnios?: number }).experienciaAnios) {
                        return {
                            text: `${(item as { experienciaAnios: number }).experienciaAnios} años`,
                            variant: 'secondary',
                        };
                    }
                    return null;
                },
            },
        ],
    },
];

function jsonHasContent(val: unknown) {
    return !!(val && val !== 'No detectado' && val !== '');
}
