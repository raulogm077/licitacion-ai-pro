import ExcelJS from 'exceljs';
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

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function exportToExcel(data: LicitacionData, filename: string) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Licitacion AI';
    workbook.lastModifiedBy = 'Licitacion AI';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Sheet 1: General Info
    const wsGeneral = workbook.addWorksheet('General');
    wsGeneral.columns = [
        { header: 'Campo', key: 'campo', width: 25 },
        { header: 'Valor', key: 'valor', width: 50 },
    ];
    wsGeneral.addRows([
        ['Título', data.datosGenerales.titulo],
        ['Presupuesto', data.datosGenerales.presupuesto],
        ['Moneda', data.datosGenerales.moneda],
        ['Plazo (Meses)', data.datosGenerales.plazoEjecucionMeses],
        ['Órgano Contratación', data.datosGenerales.organoContratacion],
        ['CPV', data.datosGenerales.cpv.join(', ')],
        ['Fecha Límite', data.datosGenerales.fechaLimitePresentacion || 'N/A']
    ]);

    // Sheet 2: Criterios
    const wsCriterios = workbook.addWorksheet('Criterios');
    wsCriterios.addRow(['Tipo', 'Descripción', 'Ponderación', 'Detalle/Fórmula']);
    data.criteriosAdjudicacion.subjetivos.forEach(c => wsCriterios.addRow(['Subjetivo', c.descripcion, c.ponderacion, c.detalles || '']));
    data.criteriosAdjudicacion.objetivos.forEach(c => wsCriterios.addRow(['Objetivo', c.descripcion, c.ponderacion, c.formula || '']));

    // Sheet 3: Requisitos
    const wsReq = workbook.addWorksheet('Requisitos');
    wsReq.addRow(['Tipo', 'Requisito', 'Obligatorio', 'Página']);
    data.requisitosTecnicos.funcionales.forEach(r => wsReq.addRow(['Funcional', r.requisito, r.obligatorio ? 'Sí' : 'No', r.referenciaPagina || '']));

    // Sheet 4: Riesgos
    const wsRisk = workbook.addWorksheet('Riesgos');
    wsRisk.addRow(['Descripción', 'Impacto', 'Probabilidad', 'Mitigación']);
    data.restriccionesYRiesgos.riesgos.forEach(r => wsRisk.addRow([r.descripcion, r.impacto, r.probabilidad || '', r.mitigacionSugerida || '']));

    await saveWorkbook(workbook, filename);
}

export async function exportAnalyticsToExcel(data: AnalyticsData, filename: string) {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Key Metrics
    const wsMetrics = workbook.addWorksheet('Métricas Clave');
    wsMetrics.addRows([
        ['Métrica', 'Valor'],
        ['Total Licitaciones', data.totalLicitaciones],
        ['Presupuesto Total', data.presupuestoTotal],
        ['Presupuesto Promedio', data.presupuestoPromedio],
        ['Importe Adjudicado Total', data.importeAdjudicadoTotal],
        ['Tiempo Análisis Promedio (ms)', data.tiempoAnalisisPromedio]
    ]);

    // Sheet 2: Distribución Estados
    const wsEstados = workbook.addWorksheet('Estados');
    wsEstados.addRow(['Estado', 'Cantidad']);
    Object.entries(data.distribucionEstados).forEach(([estado, cantidad]) => {
        wsEstados.addRow([estado, cantidad]);
    });

    // Sheet 3: Top Clientes
    const wsClientes = workbook.addWorksheet('Top Clientes');
    wsClientes.addRow(['Cliente', 'Cantidad', 'Total Presupuesto']);
    data.topClientes.forEach(c => wsClientes.addRow([c.cliente, c.count, c.total]));

    await saveWorkbook(workbook, filename);
}
