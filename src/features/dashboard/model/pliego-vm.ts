import { LicitacionData, LicitacionContent, Note } from '../../../types';
import { qualityService } from '../../../services/quality.service';
import { unwrap } from '../../../lib/tracked-field';

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

    warnings: Array<{ title?: string; message: string; severity: 'CRITICO' | 'NORMAL' }>;
    chapters: ChapterStatus[];

    hash?: string;
    id: string;
    notas: Note[];
    citations: Array<{ text: string; section: string }>;

    getEvidence: (fieldPath: string) => { quote: string; pageHint?: string } | undefined;
    isAmbiguous: (fieldPath: string) => boolean;
}

function getFieldStatus(field: unknown): string | undefined {
    if (typeof field === 'object' && field !== null && 'status' in field) {
        return (field as Record<string, unknown>).status as string;
    }
    return undefined;
}

function getFieldEvidence(field: unknown): { quote: string; pageHint?: string } | undefined {
    if (typeof field === 'object' && field !== null && 'evidence' in field) {
        const ev = (field as Record<string, unknown>).evidence as Record<string, unknown> | undefined;
        if (ev && typeof ev.quote === 'string') {
            return { quote: ev.quote, pageHint: ev.pageHint as string | undefined };
        }
    }
    return undefined;
}

export function buildPliegoVM(data: LicitacionData): PliegoVM {
    const content = data.result || data;

    // Build evidence map from workflow + TrackedField evidences
    const contentAsRecord = content as Record<string, unknown>;
    const workflowFallback = (contentAsRecord.workflow as LicitacionData['workflow']) || undefined;
    const evidencesRaw = data.workflow?.evidences || workflowFallback?.evidences || [];
    const ambiguousRaw = data.workflow?.quality?.ambiguous_fields || workflowFallback?.quality?.ambiguous_fields || [];

    interface EvidenceEntry {
        fieldPath: string;
        quote: string;
        pageHint?: string | null;
    }
    const evidenceMap = new Map<string, { quote: string; pageHint?: string }>();
    if (Array.isArray(evidencesRaw)) {
        evidencesRaw.forEach((ev: EvidenceEntry) => {
            if (ev.fieldPath && ev.quote) {
                evidenceMap.set(ev.fieldPath, { quote: ev.quote, pageHint: ev.pageHint || undefined });
            }
        });
    }

    // Also index TrackedField evidences from datosGenerales
    const dg = content.datosGenerales;
    const trackedFields = [
        'titulo',
        'organoContratacion',
        'presupuesto',
        'moneda',
        'plazoEjecucionMeses',
        'cpv',
    ] as const;
    for (const fieldName of trackedFields) {
        const ev = getFieldEvidence((dg as Record<string, unknown>)[fieldName]);
        if (ev) {
            evidenceMap.set(`datosGenerales.${fieldName}`, ev);
        }
    }

    const ambiguousSet = new Set<string>(ambiguousRaw);
    // Add ambiguous TrackedFields
    for (const fieldName of trackedFields) {
        if (getFieldStatus((dg as Record<string, unknown>)[fieldName]) === 'ambiguo') {
            ambiguousSet.add(`datosGenerales.${fieldName}`);
        }
    }

    const getEvidence = (fieldPath: string) => evidenceMap.get(fieldPath);
    const isAmbiguous = (fieldPath: string) => ambiguousSet.has(fieldPath);

    // Unwrap critical fields from TrackedField
    const titulo = unwrap<string>(dg.titulo, '');
    const organo = unwrap<string>(dg.organoContratacion, '');
    const presupuesto = unwrap<number>(dg.presupuesto, 0);
    const moneda = unwrap<string>(dg.moneda, 'EUR');
    const plazo = unwrap<number>(dg.plazoEjecucionMeses, 0);
    const cpv = unwrap<string[]>(dg.cpv, []);

    const { criteriosAdjudicacion, requisitosSolvencia, requisitosTecnicos, restriccionesYRiesgos, modeloServicio } =
        content;

    // Check empty sections
    const isEmptyGenerales = presupuesto === 0 && plazo === 0 && cpv.length === 0;
    const isEmptyCriterios =
        criteriosAdjudicacion.subjetivos.length === 0 && criteriosAdjudicacion.objetivos.length === 0;
    const isEmptySolvencia =
        requisitosSolvencia.economica.cifraNegocioAnualMinima === 0 && requisitosSolvencia.tecnica.length === 0;
    const isEmptyTecnicos = requisitosTecnicos.funcionales.length === 0 && requisitosTecnicos.normativa.length === 0;
    const isEmptyRiesgos =
        restriccionesYRiesgos.riesgos.length === 0 &&
        restriccionesYRiesgos.killCriteria.length === 0 &&
        restriccionesYRiesgos.penalizaciones.length === 0;
    const isEmptyServicio = modeloServicio.sla.length === 0 && modeloServicio.equipoMinimo.length === 0;

    const isAnalysisEmpty =
        isEmptyGenerales &&
        isEmptyCriterios &&
        isEmptySolvencia &&
        isEmptyTecnicos &&
        isEmptyRiesgos &&
        isEmptyServicio &&
        !content.plantilla_personalizada;

    // Display values
    const formatCurrency = (amount: number, currency: string) => {
        if (!amount || amount === 0) return 'No detectado';
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' }).format(amount);
    };

    const formatMonths = (months: number) => {
        if (!months || months === 0) return 'No detectado';
        return `${months} meses`;
    };

    const display = {
        presupuesto: formatCurrency(presupuesto, moneda),
        plazo: formatMonths(plazo),
        organo: !organo || organo === 'Desconocido' || organo.includes('Error') ? 'No detectado' : organo,
        cpv: cpv.length === 0 ? 'No detectado' : cpv.join(', '),
        titulo: !titulo || titulo === 'Sin título' ? 'No detectado' : titulo,
        moneda: moneda || 'EUR',
    };

    // Quality
    const qualityReport = qualityService.evaluateQuality(content);

    // Warnings — combine backend warnings + frontend-generated warnings
    const warnings: Array<{ title?: string; message: string; severity: 'CRITICO' | 'NORMAL' }> = [];

    // Check TrackedField statuses for critical warnings
    for (const fieldName of trackedFields) {
        const status = getFieldStatus((dg as Record<string, unknown>)[fieldName]);
        if (status === 'no_encontrado') {
            warnings.push({
                title: 'Dato faltante',
                message: `No se detectó: ${fieldName}.`,
                severity: 'CRITICO',
            });
        } else if (status === 'ambiguo') {
            warnings.push({
                title: 'Dato ambiguo',
                message: `Campo ambiguo: ${fieldName}. Verificar manualmente.`,
                severity: 'CRITICO',
            });
        }
    }

    // Fallback warnings for display-level checks
    if (display.presupuesto === 'No detectado' && !warnings.some((w) => w.message.includes('presupuesto'))) {
        warnings.push({ title: 'Dato faltante', message: 'No se detectó presupuesto.', severity: 'CRITICO' });
    }

    if (isEmptyCriterios) {
        warnings.push({
            title: 'Aviso de extracción',
            message: 'No se detectaron criterios de adjudicación.',
            severity: 'NORMAL',
        });
    }
    if (isEmptyTecnicos) {
        warnings.push({
            title: 'Aviso de extracción',
            message: 'No se detectaron requisitos técnicos.',
            severity: 'NORMAL',
        });
    }
    if (isEmptyRiesgos) {
        warnings.push({
            title: 'Aviso de extracción',
            message: 'No se detectaron riesgos, penalizaciones ni criterios excluyentes.',
            severity: 'NORMAL',
        });
    }

    // Backend warnings from workflow
    const backendWarnings = data.workflow?.quality?.warnings || workflowFallback?.quality?.warnings || [];
    for (const w of backendWarnings) {
        if (!warnings.some((existing) => existing.message === w)) {
            warnings.push({ title: 'Aviso del análisis', message: w, severity: 'NORMAL' });
        }
    }

    if (qualityReport.consistencyWarnings && qualityReport.consistencyWarnings.length > 0) {
        qualityReport.consistencyWarnings.forEach((warning) => {
            warnings.push({ title: 'Inconsistencia Semántica', message: warning, severity: 'NORMAL' });
        });
    }

    // Chapters
    const chapters: ChapterStatus[] = [
        ...(content.plantilla_personalizada
            ? [{ id: 'plantilla', label: 'Extracción Personalizada', status: 'COMPLETO' as const }]
            : []),
        { id: 'resumen', label: 'Resumen', status: 'COMPLETO' },
        {
            id: 'datos',
            label: 'Datos Generales',
            status: qualityReport.bySection['datosGenerales'] || 'VACIO',
            emptyMessage: {
                title: 'Datos generales incompletos',
                text: 'Faltan campos clave como presupuesto, plazo o CPV.',
            },
        },
        {
            id: 'criterios',
            label: 'Criterios',
            status: qualityReport.bySection['criteriosAdjudicacion'] || 'VACIO',
            emptyMessage: {
                title: 'No se han encontrado criterios de adjudicación',
                text: 'Suele estar en el PCAP/PPT.',
            },
        },
        {
            id: 'solvencia',
            label: 'Solvencia',
            status: qualityReport.bySection['requisitosSolvencia'] || 'VACIO',
            emptyMessage: {
                title: 'No se han detectado requisitos de solvencia técnica',
                text: 'Verifica si el pliego exige experiencia previa.',
            },
        },
        {
            id: 'tecnicos',
            label: 'Técnicos',
            status: qualityReport.bySection['requisitosTecnicos'] || 'VACIO',
            emptyMessage: {
                title: 'No se han detectado requisitos técnicos',
                text: 'Si el pliego incluye especificaciones técnicas, reintenta el análisis.',
            },
        },
        {
            id: 'riesgos',
            label: 'Riesgos',
            status: isEmptyRiesgos ? 'VACIO' : 'COMPLETO',
            emptyMessage: {
                title: 'Sin riesgos detectados',
                text: 'Si el pliego es complejo, reintenta el análisis.',
            },
        },
        {
            id: 'servicio',
            label: 'Servicio',
            status: isEmptyServicio ? 'VACIO' : 'COMPLETO',
            emptyMessage: {
                title: 'No se han detectado SLAs ni equipo mínimo',
                text: 'Si el contrato requiere niveles de servicio, reintenta.',
            },
        },
    ];

    // Citations
    const citations: Array<{ text: string; section: string }> = [];
    const collectCitations = (obj: unknown, sectionName: string) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
            obj.forEach((item) => collectCitations(item, sectionName));
        } else if (typeof obj === 'object') {
            const typedObj = obj as { cita?: unknown };
            if (typedObj.cita && typeof typedObj.cita === 'string' && typedObj.cita.length > 5) {
                citations.push({ text: typedObj.cita, section: sectionName });
            }
            Object.values(obj).forEach((val) => collectCitations(val, sectionName));
        }
    };

    collectCitations(content.datosGenerales, 'Datos Generales');
    collectCitations(content.criteriosAdjudicacion, 'Criterios');
    collectCitations(content.requisitosSolvencia, 'Solvencia');
    collectCitations(content.requisitosTecnicos, 'Requisitos Técnicos');
    collectCitations(content.restriccionesYRiesgos, 'Riesgos');

    return {
        id: (data as LicitacionData & { hash?: string }).hash || 'unknown',
        hash: (data as LicitacionData & { hash?: string }).hash,
        result: content,
        notas: data.notas || [],
        citations,
        isAnalysisEmpty,
        isIncomplete: isAnalysisEmpty,
        quality: {
            overall: qualityReport.overall,
            bySection: qualityReport.bySection,
        },
        counts: {
            riesgos: restrictionsCount(restriccionesYRiesgos),
            killCriteria: restriccionesYRiesgos.killCriteria.length,
            criterios: criteriosAdjudicacion.objetivos.length + criteriosAdjudicacion.subjetivos.length,
            requerimientos: requisitosTecnicos.funcionales.length + requisitosTecnicos.normativa.length,
        },
        display,
        warnings,
        chapters,
        getEvidence,
        isAmbiguous,
    };
}

function restrictionsCount(section: LicitacionContent['restriccionesYRiesgos']): number {
    return section.riesgos.length + section.killCriteria.length + section.penalizaciones.length;
}
