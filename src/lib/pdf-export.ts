import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LicitacionData } from '../types';

export function exportToPDF(data: LicitacionData, filename: string) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis de Licitación', pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(data.datosGenerales.titulo, 15, yPos, { maxWidth: pageWidth - 30 });

    yPos += 10;

    // General Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Datos Generales', 15, yPos);
    yPos += 7;

    const formatter = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: data.datosGenerales.moneda
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Campo', 'Valor']],
        body: [
            ['Presupuesto', formatter.format(data.datosGenerales.presupuesto)],
            ['Plazo', `${data.datosGenerales.plazoEjecucionMeses} meses`],
            ['Órgano', data.datosGenerales.organoContratacion],
            ['CPV', data.datosGenerales.cpv.join(', ')],
            ['Fecha Límite', data.datosGenerales.fechaLimitePresentacion || 'N/A'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Metadata (if exists)
    if (data.metadata) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Información Adicional', 15, yPos);
        yPos += 7;

        const metadataBody: string[][] = [];
        if (data.metadata.cliente) {
            metadataBody.push(['Cliente', data.metadata.cliente]);
        }
        if (data.metadata.importeAdjudicado) {
            metadataBody.push(['Importe Adjudicado', formatter.format(data.metadata.importeAdjudicado)]);
        }
        if (data.metadata.estado) {
            metadataBody.push(['Estado', data.metadata.estado]);
        }
        if (data.metadata.tags && data.metadata.tags.length > 0) {
            metadataBody.push(['Tags', data.metadata.tags.join(', ')]);
        }

        if (metadataBody.length > 0) {
            autoTable(doc, {
                startY: yPos,
                head: [['Campo', 'Valor']],
                body: metadataBody,
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] },
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        }
    }

    // Criteria
    doc.addPage();
    yPos = 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Criterios de Adjudicación', 15, yPos);
    yPos += 7;

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

    autoTable(doc, {
        startY: yPos,
        head: [['Tipo', 'Descripción', 'Ponderación', 'Detalle']],
        body: criteriaBody,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
            1: { cellWidth: 70 },
            3: { cellWidth: 50 }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Requirements
    if (data.requisitosTecnicos.funcionales.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Requisitos Técnicos', 15, yPos);
        yPos += 7;

        autoTable(doc, {
            startY: yPos,
            head: [['Requisito', 'Obligatorio', 'Página']],
            body: data.requisitosTecnicos.funcionales.map(r => [
                r.requisito,
                r.obligatorio ? 'Sí' : 'No',
                r.referenciaPagina?.toString() || ''
            ]),
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Risks
    if (data.restriccionesYRiesgos.riesgos.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Riesgos Detectados', 15, yPos);
        yPos += 7;

        autoTable(doc, {
            startY: yPos,
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
    }

    // Solvency
    doc.addPage();
    yPos = 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Requisitos de Solvencia', 15, yPos);
    yPos += 7;

    const solvencyBody = [
        ['Económica - Cifra de Negocio', formatter.format(data.requisitosSolvencia.economica.cifraNegocioAnualMinima)],
        ...data.requisitosSolvencia.tecnica.map(t => [
            `Técnica - ${t.descripcion}`,
            `${t.proyectosSimilaresRequeridos} proyectos${t.importeMinimoProyecto ? `, min: ${formatter.format(t.importeMinimoProyecto)}` : ''}`
        ])
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Tipo', 'Requisito']],
        body: solvencyBody,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
    });

    // Save
    doc.save(`${filename}.pdf`);
}
