import { Agent } from 'npm:@openai/agents@0.1.0';
import { ChatAgentOutputSchema } from './types.ts';

export function createChatAgents(
  readTools: any[]
) {
  const criteriaAgent = new Agent({
    name: 'CriteriaAgent',
    instructions: [
      'Eres especialista en criterios de adjudicación de licitaciones.',
      'Usa únicamente la información del análisis persistido.',
      'Si algo no consta o es ambiguo, dilo con claridad.',
    ].join(' '),
    model: 'gpt-5.4',
    tools: readTools,
  });

  const solvencyAgent = new Agent({
    name: 'SolvencyAgent',
    instructions: [
      'Eres especialista en solvencia económica, técnica y profesional.',
      'No inventes requisitos ni completes huecos por inferencia.',
      'Siempre que puedas, apóyate en evidencias del análisis.',
    ].join(' '),
    model: 'gpt-5.4',
    tools: readTools,
  });

  const riskAgent = new Agent({
    name: 'RiskAgent',
    instructions: [
      'Eres especialista en restricciones, exclusiones, penalizaciones y riesgos.',
      'Responde con prudencia y solo con base en el expediente ya analizado.',
      'Señala ambigüedad o ausencia documental cuando corresponda.',
    ].join(' '),
    model: 'gpt-5.4',
    tools: readTools,
  });

  const manager = new Agent({
    name: 'AnalysisChatManager',
    instructions: [
      'Eres el copiloto conversacional de un expediente ya analizado.',
      'Responde siempre en español.',
      'No inventes datos.',
      'Usa herramientas antes de afirmar detalles concretos.',
      'Distingue entre extraído, ambiguo y no encontrado.',
      'Devuelve siempre una respuesta estructurada con answer y citations.',
      'Si una cita no tiene fieldPath, pageHint o confidence, devuelve null en ese campo.',
      'Si no hay citas relevantes, devuelve citations como [].',
      'Incluye solo citas relevantes y evita duplicarlas.',
    ].join(' '),
    model: 'gpt-5.4',
    outputType: ChatAgentOutputSchema,
    tools: [
      ...readTools,
      criteriaAgent.asTool({
        toolName: 'criteria_agent',
        toolDescription:
          'Especialista en criterios de adjudicación y valoración.',
      }),
      solvencyAgent.asTool({
        toolName: 'solvency_agent',
        toolDescription:
          'Especialista en solvencia económica, técnica y profesional.',
      }),
      riskAgent.asTool({
        toolName: 'risk_agent',
        toolDescription:
          'Especialista en riesgos, restricciones y penalizaciones.',
      }),
    ],
  });

  return { manager };
}
