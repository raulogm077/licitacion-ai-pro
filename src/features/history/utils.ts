import { LicitacionData } from '../../types';

export type AnalysisStatus = "COMPLETO" | "PARCIAL" | "failed" | "desconocido";

export function getStatusFromData(data: LicitacionData): AnalysisStatus {
    if (data.workflow?.status === 'failed') return 'failed';
    if (data.workflow?.quality?.overall === 'COMPLETO') return 'COMPLETO';
    if (data.workflow?.quality?.overall === 'PARCIAL') return 'PARCIAL';
    return 'desconocido';
}
