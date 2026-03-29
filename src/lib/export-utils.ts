import ExcelJS from 'exceljs';
import { AnalyticsData } from '../types';

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
