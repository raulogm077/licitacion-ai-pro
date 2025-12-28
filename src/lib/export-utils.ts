import * as XLSX from 'xlsx';
import { LicitacionData, AnalyticsData } from '../types';

export function exportToJson(data: LicitacionData, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function exportToExcel(data: LicitacionData, filename: string) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: General Info
    const generalData = [
        ['Campo', 'Valor'],
        ['Título', data.datosGenerales.titulo],
        ['Presupuesto', data.datosGenerales.presupuesto],
        ['Moneda', data.datosGenerales.moneda],
        ['Plazo (Meses)', data.datosGenerales.plazoEjecucionMeses],
        ['Órgano Contratación', data.datosGenerales.organoContratacion],
        ['CPV', data.datosGenerales.cpv.join(', ')],
        ['Fecha Límite', data.datosGenerales.fechaLimitePresentacion || 'N/A']
    ];
    const wsGeneral = XLSX.utils.aoa_to_sheet(generalData);
    XLSX.utils.book_append_sheet(wb, wsGeneral, "General");

    // Sheet 2: Criterios
    const criteriosData = [
        ['Tipo', 'Descripción', 'Ponderación', 'Detalle/Fórmula'],
        ...data.criteriosAdjudicacion.subjetivos.map(c => ['Subjetivo', c.descripcion, c.ponderacion, c.detalles || '']),
        ...data.criteriosAdjudicacion.objetivos.map(c => ['Objetivo', c.descripcion, c.ponderacion, c.formula || ''])
    ];
    const wsCriterios = XLSX.utils.aoa_to_sheet(criteriosData);
    XLSX.utils.book_append_sheet(wb, wsCriterios, "Criterios");

    // Sheet 3: Requisitos
    const reqData = [
        ['Tipo', 'Requisito', 'Obligatorio', 'Página'],
        ...data.requisitosTecnicos.funcionales.map(r => ['Funcional', r.requisito, r.obligatorio ? 'Sí' : 'No', r.referenciaPagina || ''])
    ];
    const wsReq = XLSX.utils.aoa_to_sheet(reqData);
    XLSX.utils.book_append_sheet(wb, wsReq, "Requisitos");

    // Sheet 4: Riesgos
    const riskData = [
        ['Descripción', 'Impacto', 'Probabilidad', 'Mitigación'],
        ...data.restriccionesYRiesgos.riesgos.map(r => [r.descripcion, r.impacto, r.probabilidad || '', r.mitigacionSugerida || ''])
    ];
    const wsRisk = XLSX.utils.aoa_to_sheet(riskData);
    XLSX.utils.book_append_sheet(wb, wsRisk, "Riesgos");

    XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportAnalyticsToExcel(data: AnalyticsData, filename: string) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Key Metrics
    const metricsData = [
        ['Métrica', 'Valor'],
        ['Total Licitaciones', data.totalLicitaciones],
        ['Presupuesto Total', data.presupuestoTotal],
        ['Presupuesto Promedio', data.presupuestoPromedio],
        ['Importe Adjudicado Total', data.importeAdjudicadoTotal],
        ['Tiempo Análisis Promedio (ms)', data.tiempoAnalisisPromedio]
    ];
    const wsMetrics = XLSX.utils.aoa_to_sheet(metricsData);
    XLSX.utils.book_append_sheet(wb, wsMetrics, "Métricas Clave");

    // Sheet 2: Distribución Estados
    const estadosData = [
        ['Estado', 'Cantidad'],
        ...Object.entries(data.distribucionEstados)
    ];
    const wsEstados = XLSX.utils.aoa_to_sheet(estadosData);
    XLSX.utils.book_append_sheet(wb, wsEstados, "Estados");

    // Sheet 3: Top Clientes
    const clientesData = [
        ['Cliente', 'Cantidad', 'Total Presupuesto'],
        ...data.topClientes.map(c => [c.cliente, c.count, c.total])
    ];
    const wsClientes = XLSX.utils.aoa_to_sheet(clientesData);
    XLSX.utils.book_append_sheet(wb, wsClientes, "Top Clientes");

    XLSX.writeFile(wb, `${filename}.xlsx`);
}
