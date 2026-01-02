import type { LicitacionAgentResponse } from '../schemas/licitacion-agent.schema';

/**
 * Transforma la respuesta simplificada del Agent
 * al schema complejo que espera el frontend.
 * 
 * IMPORTANTE: Esta transformación es CRÍTICA para compatibilidad.
 */
export function transformAgentResponseToFrontend(
    agentResponse: LicitacionAgentResponse
): any {  // Retorna any porque será validado después por el Zod del frontend

    const { result, workflow } = agentResponse;

    return {
        // Datos Generales - mapeo 1:1
        datosGenerales: {
            titulo: result.datosGenerales.titulo,
            presupuesto: result.datosGenerales.presupuesto,
            moneda: result.datosGenerales.moneda,
            plazoEjecucionMeses: result.datosGenerales.plazoEjecucionMeses,
            cpv: result.datosGenerales.cpv,
            organoContratacion: result.datosGenerales.organoContratacion,
            fechaLimitePresentacion: result.datosGenerales.fechaLimitePresentacion
        },

        // Criterios - transformar strings a objetos
        criteriosAdjudicacion: {
            subjetivos: result.criteriosAdjudicacion.subjetivos.map(desc => ({
                descripcion: desc,
                ponderacion: 0,  // Default, el schema lo acepta
                detalles: undefined,
                cita: undefined
            })),
            objetivos: result.criteriosAdjudicacion.objetivos.map(desc => ({
                descripcion: desc,
                ponderacion: 0,
                formula: undefined,
                cita: undefined
            }))
        },

        // Requisitos Técnicos - strings a objetos
        requisitosTecnicos: {
            funcionales: result.requisitosTecnicos.funcionales.map(req => ({
                requisito: req,
                obligatorio: true,
                referenciaPagina: undefined,
                cita: undefined
            })),
            normativa: result.requisitosTecnicos.normativa.map(norma => ({
                norma,
                descripcion: undefined,
                cita: undefined
            }))
        },

        // Solvencia - transformación parcial
        requisitosSolvencia: {
            economica: {
                cifraNegocioAnualMinima: result.requisitosSolvencia.economica.cifraNegocioAnualMinima,
                descripcion: result.requisitosSolvencia.economica.descripcion
            },
            tecnica: result.requisitosSolvencia.tecnica.map(desc => ({
                descripcion: desc,
                proyectosSimilaresRequeridos: 0,
                importeMinimoProyecto: undefined,
                cita: undefined
            }))
        },

        // Riesgos - transformación compleja
        restriccionesYRiesgos: {
            killCriteria: result.restriccionesYRiesgos.killCriteria.map(kc => ({
                criterio: kc,
                justificacion: undefined,
                cita: undefined
            })),
            riesgos: result.restriccionesYRiesgos.riesgos.map(riesgo => ({
                descripcion: riesgo,
                impacto: 'MEDIO' as const,  // Default
                probabilidad: 'MEDIA' as const,
                mitigacionSugerida: undefined,
                cita: undefined
            })),
            penalizaciones: result.restriccionesYRiesgos.penalizaciones.map(pen => ({
                causa: pen,
                sancion: '',
                cita: undefined
            }))
        },

        // Modelo Servicio
        modeloServicio: {
            sla: result.modeloServicio.sla.map(sla => ({
                metrica: sla,
                objetivo: 'N/A',
                cita: undefined
            })),
            equipoMinimo: result.modeloServicio.equipoMinimo.map(perfil => ({
                rol: perfil,
                experienciaAnios: 0,
                titulacion: undefined,
                cita: undefined
            }))
        },

        // Workflow - pasar directo (ya es compatible)
        workflow
    };
}
