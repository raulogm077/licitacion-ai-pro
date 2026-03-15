import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LicitacionData } from '../types';
import { formatCurrency } from './formatters';

interface AutoTableDoc extends jsPDF {
    lastAutoTable: { finalY: number };
}

interface PdfContext {
    doc: jsPDF;
    pageWidth: number;
    yPos: number;
}

export function exportToPDF(data: LicitacionData, filename: string) {
    const ctx: PdfContext = {
        doc: new jsPDF(),
        pageWidth: 0,
        yPos: 20
    };
    ctx.pageWidth = ctx.doc.internal.pageSize.getWidth();

    addHeader(ctx, data.datosGenerales.titulo);
    addGeneralInfo(ctx, data);
    addMetadata(ctx, data);
    addCriteria(ctx, data);
    addRequirements(ctx, data);
    addRisks(ctx, data);
    addSolvency(ctx, data);

    ctx.doc.save(`${filename}.pdf`);
}

function addHeader(ctx: PdfContext, titulo: string) {
    ctx.doc.setFontSize(20);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Análisis de Licitación', ctx.pageWidth / 2, ctx.yPos, { align: 'center' });

    ctx.yPos += 15;
    ctx.doc.setFontSize(14);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.text(titulo, 15, ctx.yPos, { maxWidth: ctx.pageWidth - 30 });

    ctx.yPos += 10;
}

function addGeneralInfo(ctx: PdfContext, data: LicitacionData) {
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Datos Generales', 15, ctx.yPos);
    ctx.yPos += 7;

    autoTable(ctx.doc, {
        startY: ctx.yPos,
        head: [['Campo', 'Valor']],
        body: [
            ['Presupuesto', formatCurrency(data.datosGenerales.presupuesto, data.datosGenerales.moneda)],
            ['Plazo', `${data.datosGenerales.plazoEjecucionMeses} meses`],
            ['Órgano', data.datosGenerales.organoContratacion],
            ['CPV', data.datosGenerales.cpv.join(', ')],
            ['Fecha Límite', data.datosGenerales.fechaLimitePresentacion || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
    });

    ctx.yPos = (ctx.doc as unknown as AutoTableDoc).lastAutoTable.finalY + 10;
}

function addMetadata(ctx: PdfContext, data: LicitacionData) {
    if (!data.metadata) return;

    ctx.doc.addPage();
    ctx.yPos = 20;
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Información Adicional', 15, ctx.yPos);
    ctx.yPos += 7;

    const metadataBody: string[][] = [];
    if (data.metadata.cliente) {
        metadataBody.push(['Cliente', data.metadata.cliente]);
    }
    if (data.metadata.importeAdjudicado) {
        metadataBody.push(['Importe Adjudicado', formatCurrency(data.metadata.importeAdjudicado, data.datosGenerales.moneda)]);
    }
    if (data.metadata.estado) {
        metadataBody.push(['Estado', data.metadata.estado]);
    }
    if (data.metadata.tags && data.metadata.tags.length > 0) {
        metadataBody.push(['Tags', data.metadata.tags.join(', ')]);
    }

    if (metadataBody.length > 0) {
        autoTable(ctx.doc, {
            startY: ctx.yPos,
            head: [['Campo', 'Valor']],
            body: metadataBody,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
        });
        ctx.yPos = (ctx.doc as unknown as AutoTableDoc).lastAutoTable.finalY + 10;
    }
}

function addCriteria(ctx: PdfContext, data: LicitacionData) {
    ctx.doc.addPage();
    ctx.yPos = 20;
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Criterios de Adjudicación', 15, ctx.yPos);
    ctx.yPos += 7;

    const criteriaBody = [
        ...data.criteriosAdjudicacion.subjetivos.map(c => [
            'Subjetivo',
            c.descripcion,
            `${c.ponderacion}%`,
            c.detalles || ''
        ]),
        ...data.criteriosAdjudicacion.objetivos.map(c => [
            'Objetivo',
            c.descripcion,
            `${c.ponderacion}%`,
            c.formula || ''
        ])
    ];

    autoTable(ctx.doc, {
        startY: ctx.yPos,
        head: [['Tipo', 'Descripción', 'Ponderación', 'Detalle']],
        body: criteriaBody,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
            1: { cellWidth: 70 },
            3: { cellWidth: 50 }
        }
    });

    ctx.yPos = (ctx.doc as unknown as AutoTableDoc).lastAutoTable.finalY + 10;
}

function addRequirements(ctx: PdfContext, data: LicitacionData) {
    if (data.requisitosTecnicos.funcionales.length === 0) return;

    ctx.doc.addPage();
    ctx.yPos = 20;
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Requisitos Técnicos', 15, ctx.yPos);
    ctx.yPos += 7;

    autoTable(ctx.doc, {
        startY: ctx.yPos,
        head: [['Requisito', 'Obligatorio', 'Página']],
        body: data.requisitosTecnicos.funcionales.map(r => [
            r.requisito,
            r.obligatorio ? 'Sí' : 'No',
            r.referenciaPagina?.toString() || ''
        ]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
    });

    ctx.yPos = (ctx.doc as unknown as AutoTableDoc).lastAutoTable.finalY + 10;
}

function addRisks(ctx: PdfContext, data: LicitacionData) {
    if (data.restriccionesYRiesgos.riesgos.length === 0) return;

    ctx.doc.addPage();
    ctx.yPos = 20;
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Riesgos Detectados', 15, ctx.yPos);
    ctx.yPos += 7;

    autoTable(ctx.doc, {
        startY: ctx.yPos,
        head: [['Descripción', 'Impacto', 'Probabilidad', 'Mitigación']],
        body: data.restriccionesYRiesgos.riesgos.map(r => [
            r.descripcion,
            r.impacto,
            r.probabilidad || '',
            r.mitigacionSugerida || ''
        ]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] }, // Red for risks
        columnStyles: {
            0: { cellWidth: 60 }
        }
    });

    ctx.yPos = (ctx.doc as unknown as AutoTableDoc).lastAutoTable.finalY + 10;
}

function addSolvency(ctx: PdfContext, data: LicitacionData) {
    ctx.doc.addPage();
    ctx.yPos = 20;
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Requisitos de Solvencia', 15, ctx.yPos);
    ctx.yPos += 7;

    const solvencyBody = [
        ['Económica - Cifra de Negocio', formatCurrency(data.requisitosSolvencia.economica.cifraNegocioAnualMinima, data.datosGenerales.moneda)],
        ...data.requisitosSolvencia.tecnica.map(t => [
            `Técnica - ${t.descripcion}`,
            `${t.proyectosSimilaresRequeridos} proyectos${t.importeMinimoProyecto ? `, min: ${formatCurrency(t.importeMinimoProyecto, data.datosGenerales.moneda)}` : ''}`
        ])
    ];

    autoTable(ctx.doc, {
        startY: ctx.yPos,
        head: [['Tipo', 'Requisito']],
        body: solvencyBody,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
    });
}
