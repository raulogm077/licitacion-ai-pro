import { tool } from '@openai/agents';
import { LicitacionAgentResponseSchema } from '../schemas/licitacion-agent.schema';

/**
 * Tool para que el Agent submita el resultado estructurado
 * 
 * IMPORTANTE: Usa tool() helper del SDK, no un objeto plano
 */
export const submitResultTool = tool({
    name: 'submit_analysis_result',
    description: 'Submit el análisis completo del pliego de licitación en formato JSON estructurado',
    parameters: LicitacionAgentResponseSchema,

    // La función que ejecutará el tool
    execute: async (result: unknown) => {
        // Validar con Zod
        const validated = LicitacionAgentResponseSchema.parse(result);

        console.log('[submit_analysis_result] Resultado validado correctamente');
        console.log(`[submit_analysis_result] Quality: ${validated.workflow?.quality?.overall}`);
        console.log(`[submit_analysis_result] Evidences: ${validated.workflow?.evidences?.length}`);

        return {
            success: true,
            message: 'Análisis recibido y validado',
            data: validated
        };
    }
});
