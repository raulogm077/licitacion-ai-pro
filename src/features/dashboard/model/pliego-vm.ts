import { LicitacionData, LicitacionContent, Note } from '../../../types';
import { qualityService } from '../../../services/quality.service';

export interface ChapterStatus {
    id: string;
    label: string;
    status: 'COMPLETO' | 'PARCIAL' | 'VACIO' | 'ERROR';
    emptyMessage?: { title: string; text: string };
}

export interface PliegoVM {
    result: LicitacionContent;
    isAnalysisEmpty: boolean;
    isIncomplete: boolean;
    quality: {
        overall: 'COMPLETO' | 'PARCIAL' | 'VACIO';
        bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>;
    };
    counts: {
        riesgos: number;
        killCriteria: number;
        criterios: number;
        requerimientos: number;
    };
    display: {
        presupuesto: string;
        plazo: string;
        organo: string;
        cpv: string;
        titulo: string;
        moneda: string;
    };
    warnings: Array<{ message: string; severity: 'CRITICO' | 'NORMAL' }>;
    chapters: ChapterStatus[];
    hash?: string;
    id: string;
    notas: Note[];
    citations: Array<{ text: string; section: string }>;
    getEvidence: (fieldPath: string) => { quote: string; pageHint?: string } | undefined;
    isAmbiguous: (fieldPath: string) => boolean;
}

export function buildPliegoVM(data: LicitacionData): PliegoVM {
    const content = data.result || data;

    const { getEvidence, isAmbiguous } = createEvidenceHelpers(data, content);
    const emptyFlags = checkEmptySections(content);
    const display = buildDisplay(content.datosGenerales);
    const qualityReport = qualityService.evaluateQuality(content);
    const warnings = generateWarnings(display, emptyFlags);
    const chapters = buildChapters(qualityReport, emptyFlags);
    const citations = collectAllCitations(content);

    return {
        id: (data as LicitacionData & { hash?: string }).hash || 'unknown',
        hash: (data as LicitacionData & { hash?: string }).hash,
        result: content,
        notas: data.notas || [],
        citations,
        isAnalysisEmpty: emptyFlags.isAnalysisEmpty,
        isIncomplete: emptyFlags.isAnalysisEmpty,
        quality: {
            overall: qualityReport.overall,
            bySection: qualityReport.bySection
        },
        counts: {
            riesgos: restrictionsCount(content.restriccionesYRiesgos),
            killCriteria: content.restriccionesYRiesgos.killCriteria.length,
            criterios: content.criteriosAdjudicacion.objetivos.length + content.criteriosAdjudicacion.subjetivos.length,
            requerimientos: content.requisitosTecnicos.funcionales.length + content.requisitosTecnicos.normativa.length
        },
        display,
        warnings,
        chapters,
        getEvidence,
        isAmbiguous
    };
}

function createEvidenceHelpers(data: LicitacionData, content: LicitacionContent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evidencesRaw = data.workflow?.evidences || (content as any).workflow?.evidences || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ambiguousRaw = data.workflow?.quality?.ambiguous_fields || (content as any).workflow?.quality?.ambiguous_fields || [];

    const evidenceMap = new Map<string, { quote: string; pageHint?: string }>();
    if (Array.isArray(evidencesRaw)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evidencesRaw.forEach((ev: any) => {
            if (ev.fieldPath && ev.quote) {
                evidenceMap.set(ev.fieldPath, { quote: ev.quote, pageHint: ev.pageHint });
            }
        });
    }

    const ambiguousSet = new Set<string>(ambiguousRaw);

    const getEvidence = (fieldPath: string) => evidenceMap.get(fieldPath);
    const isAmbiguous = (fieldPath: string) => ambiguousSet.has(fieldPath);

    return { getEvidence, isAmbiguous };
}

function checkEmptySections(content: LicitacionContent) {
    const { datosGenerales, criteriosAdjudicacion, requisitosSolvencia, requisitosTecnicos, restriccionesYRiesgos, modeloServicio } = content;

    const isEmptyGenerales =
        datosGenerales.presupuesto === 0 &&
        datosGenerales.plazoEjecucionMeses === 0 &&
        datosGenerales.cpv.length === 0;

    const isEmptyCriterios =
        criteriosAdjudicacion.subjetivos.length === 0 &&
        criteriosAdjudicacion.objetivos.length === 0;

    const isEmptySolvencia =
        requisitosSolvencia.economica.cifraNegocioAnualMinima === 0 &&
        requisitosSolvencia.tecnica.length === 0;

    const isEmptyTecnicos =
        requisitosTecnicos.funcionales.length === 0 &&
        requisitosTecnicos.normativa.length === 0;

    const isEmptyRiesgos =
        restriccionesYRiesgos.riesgos.length === 0 &&
        restriccionesYRiesgos.killCriteria.length === 0 &&
        restriccionesYRiesgos.penalizaciones.length === 0;

    const isEmptyServicio =
        modeloServicio.sla.length === 0 &&
        modeloServicio.equipoMinimo.length === 0;

    const isAnalysisEmpty = isEmptyGenerales && isEmptyCriterios && isEmptySolvencia && isEmptyTecnicos && isEmptyRiesgos && isEmptyServicio;

    return { isEmptyGenerales, isEmptyCriterios, isEmptySolvencia, isEmptyTecnicos, isEmptyRiesgos, isEmptyServicio, isAnalysisEmpty };
}

function buildDisplay(datosGenerales: LicitacionContent['datosGenerales']) {
    const formatCurrency = (amount: number, currency: string) => {
        if (!amount || amount === 0) return "No detectado";
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' }).format(amount);
    };

    const formatMonths = (months: number) => {
        if (!months || months === 0) return "No detectado";
        return `${months} meses`;
    };

    return {
        presupuesto: formatCurrency(datosGenerales.presupuesto, datosGenerales.moneda),
        plazo: formatMonths(datosGenerales.plazoEjecucionMeses),
        organo: (!datosGenerales.organoContratacion || datosGenerales.organoContratacion === 'Desconocido' || datosGenerales.organoContratacion.includes('Error'))
            ? "No detectado" : datosGenerales.organoContratacion,
        cpv: (datosGenerales.cpv.length === 0) ? "No detectado" : datosGenerales.cpv.join(', '),
        titulo: (!datosGenerales.titulo || datosGenerales.titulo === 'Sin título') ? "No detectado" : datosGenerales.titulo,
        moneda: datosGenerales.moneda || 'EUR'
    };
}

function generateWarnings(display: ReturnType<typeof buildDisplay>, emptyFlags: ReturnType<typeof checkEmptySections>) {
    const warnings: Array<{ message: string; severity: 'CRITICO' | 'NORMAL' }> = [];

    if (display.presupuesto === "No detectado") warnings.push({ message: "No se detectó presupuesto.", severity: 'CRITICO' });
    if (display.plazo === "No detectado") warnings.push({ message: "No se detectó plazo de ejecución.", severity: 'CRITICO' });
    if (display.cpv === "No detectado") warnings.push({ message: "No se detectó ningún código CPV.", severity: 'CRITICO' });
    if (display.titulo === "No detectado") warnings.push({ message: "No se detectó el título de la licitación.", severity: 'CRITICO' });
    if (display.organo === "No detectado") warnings.push({ message: "El órgano de contratación no está identificado.", severity: 'CRITICO' });

    if (emptyFlags.isEmptyCriterios) warnings.push({ message: "No se detectaron criterios de adjudicación.", severity: 'NORMAL' });
    if (emptyFlags.isEmptyTecnicos) warnings.push({ message: "No se detectaron requisitos técnicos.", severity: 'NORMAL' });
    if (emptyFlags.isEmptyRiesgos) warnings.push({ message: "No se detectaron riesgos, penalizaciones ni criterios excluyentes.", severity: 'NORMAL' });

    return warnings;
}

function buildChapters(qualityReport: ReturnType<typeof qualityService.evaluateQuality>, emptyFlags: ReturnType<typeof checkEmptySections>): ChapterStatus[] {
    return [
        {
            id: 'resumen',
            label: 'Resumen',
            status: 'COMPLETO'
        },
        {
            id: 'datos',
            label: 'Datos Generales',
            status: qualityReport.bySection['datosGenerales'] || 'VACIO',
            emptyMessage: { title: 'Datos generales incompletos', text: 'Faltan campos clave como presupuesto, plazo o CPV. Reintenta la extracción o revisa el documento.' }
        },
        {
            id: 'criterios',
            label: 'Criterios',
            status: qualityReport.bySection['criteriosAdjudicacion'] || 'VACIO',
            emptyMessage: { title: 'No se han encontrado criterios de adjudicación', text: 'Suele estar en el PCAP/PPT. Reintenta el análisis si esperabas encontrarlo aquí.' }
        },
        {
            id: 'solvencia',
            label: 'Solvencia',
            status: qualityReport.bySection['requisitosSolvencia'] || 'VACIO',
            emptyMessage: { title: 'No se han detectado requisitos de solvencia técnica', text: 'Verifica si el pliego exige experiencia previa, proyectos similares o importes mínimos.' }
        },
        {
            id: 'tecnicos',
            label: 'Técnicos',
            status: qualityReport.bySection['requisitosTecnicos'] || 'VACIO',
            emptyMessage: { title: 'No se han detectado requisitos técnicos', text: 'Si el pliego incluye especificaciones técnicas, reintenta el análisis o revisa el apartado correspondiente.' }
        },
        {
            id: 'riesgos',
            label: 'Riesgos',
            status: emptyFlags.isEmptyRiesgos ? 'VACIO' : 'COMPLETO',
            emptyMessage: { title: 'Sin riesgos detectados', text: 'Si el pliego es complejo, reintenta el análisis o revisa manualmente la sección de restricciones y penalizaciones.' }
        },
        {
            id: 'servicio',
            label: 'Servicio',
            status: emptyFlags.isEmptyServicio ? 'VACIO' : 'COMPLETO',
            emptyMessage: { title: 'No se han detectado SLAs ni equipo mínimo', text: 'Si el contrato requiere niveles de servicio o perfiles mínimos, reintenta el análisis o revisa el documento.' }
        }
    ];
}

function collectAllCitations(content: LicitacionContent) {
    const citations: Array<{ text: string; section: string }> = [];

    const collectCitations = (obj: unknown, sectionName: string) => {
        if (!obj) return;
        if (typeof obj === 'object') {
            const typedObj = obj as { cita?: unknown };
            if (typedObj.cita && typeof typedObj.cita === 'string' && typedObj.cita.length > 5) {
                citations.push({ text: typedObj.cita, section: sectionName });
            }
            Object.values(obj).forEach(val => collectCitations(val, sectionName));
        } else if (Array.isArray(obj)) {
            obj.forEach(item => collectCitations(item, sectionName));
        }
    };

    collectCitations(content.datosGenerales, 'Datos Generales');
    collectCitations(content.criteriosAdjudicacion, 'Criterios');
    collectCitations(content.requisitosSolvencia, 'Solvencia');
    collectCitations(content.requisitosTecnicos, 'Requisitos Técnicos');
    collectCitations(content.restriccionesYRiesgos, 'Riesgos');

    return citations;
}

function restrictionsCount(section: LicitacionContent['restriccionesYRiesgos']): number {
    return section.riesgos.length + section.killCriteria.length + section.penalizaciones.length;
}
