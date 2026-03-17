/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LicitacionAgentResponse } from '../schemas/licitacion-agent.schema';

/**
 * Transforma la respuesta simplificada del Agent
 * al schema complejo que espera el frontend.
 * 
 * IMPORTANTE: Esta transformación es CRÍTICA para compatibilidad.
 *
 * UPDATE: Added strict defensive coding to prevent crashes on partial data
 */
export function transformAgentResponseToFrontend(
    agentResponse: LicitacionAgentResponse
): unknown {  // Retorna unknown porque será validado después por el Zod del frontend

    // Defensive check for top-level keys
    const result = agentResponse?.result || {} as any;
    const workflow = agentResponse?.workflow || {} as any;

    // Helper to safely access arrays
    const safeArray = (arr: unknown[]) => Array.isArray(arr) ? arr : [];
    // Helper to safely access strings
    const safeString = (str: unknown) => typeof str === 'string' ? str : '';
    // Helper to safely access numbers
    const safeNumber = (num: unknown) => typeof num === 'number' ? num : 0;

    // Defensive access to sections
    const datosGenerales = (result as any).datosGenerales || {};
    const criterios = (result as any).criteriosAdjudicacion || {};
    const tecnicos = (result as any).requisitosTecnicos || {};
    const solvencia = (result as any).requisitosSolvencia || {};
    const riesgos = (result as any).restriccionesYRiesgos || {};
    const servicio = (result as any).modeloServicio || {};

    return {
        plantilla_personalizada: (result as any).plantilla_personalizada || undefined,
        // Datos Generales - mapeo 1:1
        datosGenerales: {
            titulo: safeString(datosGenerales.titulo),
            presupuesto: safeNumber(datosGenerales.presupuesto),
            moneda: safeString(datosGenerales.moneda) || "EUR",
            plazoEjecucionMeses: safeNumber(datosGenerales.plazoEjecucionMeses),
            cpv: safeArray(datosGenerales.cpv).map(safeString),
            organoContratacion: safeString(datosGenerales.organoContratacion),
            fechaLimitePresentacion: datosGenerales.fechaLimitePresentacion
        },

        // Criterios - transformar strings a objetos
        criteriosAdjudicacion: {
            subjetivos: safeArray(criterios.subjetivos).map(desc => ({
                descripcion: safeString(desc),
                ponderacion: 0,
                detalles: undefined,
                cita: undefined
            })),
            objetivos: safeArray(criterios.objetivos).map(desc => ({
                descripcion: safeString(desc),
                ponderacion: 0,
                formula: undefined,
                cita: undefined
            }))
        },

        // Requisitos Técnicos - strings a objetos
        requisitosTecnicos: {
            funcionales: safeArray(tecnicos.funcionales).map(req => ({
                requisito: safeString(req),
                obligatorio: true,
                referenciaPagina: undefined,
                cita: undefined
            })),
            normativa: safeArray(tecnicos.normativa).map(norma => ({
                norma: safeString(norma),
                descripcion: undefined,
                cita: undefined
            }))
        },

        // Solvencia - transformación parcial
        requisitosSolvencia: {
            economica: {
                cifraNegocioAnualMinima: safeNumber(solvencia.economica?.cifraNegocioAnualMinima),
                descripcion: safeString(solvencia.economica?.descripcion)
            },
            tecnica: safeArray(solvencia.tecnica).map(desc => ({
                descripcion: safeString(desc),
                proyectosSimilaresRequeridos: 0,
                importeMinimoProyecto: undefined,
                cita: undefined
            }))
        },

        // Riesgos - transformación compleja
        restriccionesYRiesgos: {
            killCriteria: safeArray(riesgos.killCriteria).map(kc => ({
                criterio: safeString(kc),
                justificacion: undefined,
                cita: undefined
            })),
            riesgos: safeArray(riesgos.riesgos).map(riesgo => ({
                descripcion: safeString(riesgo),
                impacto: 'MEDIO' as const,
                probabilidad: 'MEDIA' as const,
                mitigacionSugerida: undefined,
                cita: undefined
            })),
            penalizaciones: safeArray(riesgos.penalizaciones).map(pen => ({
                causa: safeString(pen),
                sancion: '',
                cita: undefined
            }))
        },

        // Modelo Servicio
        modeloServicio: {
            sla: safeArray(servicio.sla).map(sla => ({
                metrica: safeString(sla),
                objetivo: 'N/A',
                cita: undefined
            })),
            equipoMinimo: safeArray(servicio.equipoMinimo).map(perfil => ({
                rol: safeString(perfil),
                experienciaAnios: 0,
                titulacion: undefined,
                cita: undefined
            }))
        },

        // Workflow - pasar directo (ya es compatible)
        workflow: workflow
    };
}
