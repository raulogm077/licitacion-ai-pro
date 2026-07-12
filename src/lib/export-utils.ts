import ExcelJS from 'exceljs';
import { AnalyticsData, LicitacionContent } from '../types';
import { unwrap } from './tracked-field';

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
        ['Tiempo Análisis Promedio (ms)', data.tiempoAnalisisPromedio],
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
    data.topClientes.forEach((c) => wsClientes.addRow([c.cliente, c.count, c.total]));

    await saveWorkbook(workbook, filename);
}

/** Exports a single analyzed licitación as a multi-sheet Excel report. */
export async function exportLicitacionToExcel(content: LicitacionContent, filename: string) {
    const workbook = new ExcelJS.Workbook();
    const dg = content.datosGenerales;

    const wsGeneral = workbook.addWorksheet('Datos Generales');
    wsGeneral.addRows([
        ['Campo', 'Valor'],
        ['Título', unwrap<string>(dg.titulo, '')],
        ['Órgano de contratación', unwrap<string>(dg.organoContratacion, '')],
        ['Presupuesto', unwrap<number>(dg.presupuesto, 0)],
        ['Moneda', unwrap<string>(dg.moneda, 'EUR')],
        ['Plazo de ejecución (meses)', unwrap<number>(dg.plazoEjecucionMeses, 0)],
        ['CPV', unwrap<string[]>(dg.cpv, []).join(', ')],
        ['Fecha límite de presentación', dg.fechaLimitePresentacion || ''],
    ]);

    const wsCriterios = workbook.addWorksheet('Criterios');
    wsCriterios.addRow(['Tipo', 'Criterio', 'Ponderación']);
    content.criteriosAdjudicacion.subjetivos.forEach((c) =>
        wsCriterios.addRow(['Subjetivo', c.descripcion, c.ponderacion])
    );
    content.criteriosAdjudicacion.objetivos.forEach((c) =>
        wsCriterios.addRow(['Objetivo', c.descripcion, c.ponderacion])
    );

    const wsSolvencia = workbook.addWorksheet('Solvencia');
    wsSolvencia.addRows([
        ['Tipo', 'Requisito'],
        ['Económica (cifra negocio mínima)', content.requisitosSolvencia.economica.cifraNegocioAnualMinima],
    ]);
    content.requisitosSolvencia.tecnica.forEach((t) => wsSolvencia.addRow(['Técnica', t.descripcion]));
    content.requisitosSolvencia.profesional.forEach((p) => wsSolvencia.addRow(['Profesional', p.descripcion]));

    const wsTecnicos = workbook.addWorksheet('Requisitos Técnicos');
    wsTecnicos.addRow(['Tipo', 'Requisito']);
    content.requisitosTecnicos.funcionales.forEach((f) => wsTecnicos.addRow(['Funcional', f.requisito]));
    content.requisitosTecnicos.normativa.forEach((n) => wsTecnicos.addRow(['Normativa', n.norma]));

    const wsRiesgos = workbook.addWorksheet('Riesgos');
    wsRiesgos.addRow(['Tipo', 'Descripción', 'Detalle']);
    content.restriccionesYRiesgos.killCriteria.forEach((kc) =>
        wsRiesgos.addRow(['Criterio excluyente', kc.criterio, kc.justificacion || ''])
    );
    content.restriccionesYRiesgos.penalizaciones.forEach((p) =>
        wsRiesgos.addRow(['Penalización', p.causa, p.sancion || ''])
    );
    content.restriccionesYRiesgos.riesgos.forEach((r) => wsRiesgos.addRow(['Riesgo', r.descripcion, r.impacto || '']));

    const wsServicio = workbook.addWorksheet('Modelo de Servicio');
    wsServicio.addRow(['Tipo', 'Detalle', 'Objetivo']);
    content.modeloServicio.sla.forEach((s) => wsServicio.addRow(['SLA', s.metrica, s.objetivo]));
    content.modeloServicio.equipoMinimo.forEach((e) =>
        wsServicio.addRow(['Equipo mínimo', e.rol, e.experienciaAnios ? `${e.experienciaAnios} años exp.` : ''])
    );

    await saveWorkbook(workbook, filename);
}
