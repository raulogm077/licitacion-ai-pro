import { Agent } from '@openai/agents';
import { getAnalistaInstructions } from './utils/instructions';
import { submitResultTool } from './tools/submit-result.tool';

/**
 * Agente principal para análisis de pliegos de licitación
 * 
 * IMPORTANTE: Esta instancia se crea UNA SOLA VEZ (singleton pattern)
 * para reutilizarse en múltiples requests.
 */
export const analistaAgent = new Agent({
    name: 'Analista de Pliegos',
    model: 'gpt-4o-2024-08-06',  // Mismo modelo que Assistant V2
    instructions: getAnalistaInstructions(),

    tools: [
        submitResultTool
    ]
    // Note: temperature and other model params are controlled at run() time, not Agent creation
});

// Export para usar en Edge Function
export default analistaAgent;
