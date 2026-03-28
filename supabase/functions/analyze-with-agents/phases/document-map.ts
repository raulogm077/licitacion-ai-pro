/**
 * Fase B: Mapa Documental
 *
 * Identifica la estructura del expediente usando Responses API + file_search.
 * Devuelve un mapa estructurado de los documentos encontrados.
 */
import OpenAI from 'npm:openai@7.8.0';
import { DocumentMapSchema } from '../../_shared/schemas/document-map.ts';
import type { DocumentMap } from '../../_shared/schemas/document-map.ts';

export interface DocumentMapInput {
    openai: OpenAI;
    vectorStoreId: string;
    fileNames: string[];
    guideContent: string;
    onProgress?: (msg: string) => void;
}

const DOCUMENT_MAP_PROMPT = (
    fileNames: string[],
    guideExcerpt: string
) => `Eres un analista de pliegos de licitación. Tu tarea es identificar la ESTRUCTURA DOCUMENTAL del expediente indexado.

DOCUMENTOS DISPONIBLES EN EL ÍNDICE:
${fileNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

METODOLOGÍA (extracto de la guía interna):
${guideExcerpt}

INSTRUCCIONES:
1. Usa file_search para explorar los documentos indexados.
2. Identifica qué tipo de documento es cada uno: PCAP, PPT, CUADRO_CARATULA, ANEXO_ECONOMICO, ANEXO_TECNICO, MEMORIA_JUSTIFICATIVA, DEUC, u OTRO.
3. Para cada documento, indica qué secciones contiene (presupuesto, plazos, criterios, solvencia, requisitos, restricciones, modelo de servicio).
4. Identifica si hay lotes y cuántos.
5. Identifica tablas clave relevantes.

FORMATO DE RESPUESTA:
Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (sin markdown, sin comentarios, sin texto adicional):
{
  "documentos": [
    {
      "tipo": "PCAP|PPT|CUADRO_CARATULA|ANEXO_ECONOMICO|ANEXO_TECNICO|MEMORIA_JUSTIFICATIVA|DEUC|OTRO",
      "nombre": "nombre del documento",
      "descripcion": "breve descripción",
      "contienePresupuesto": true/false,
      "contienePlazos": true/false,
      "contieneCriterios": true/false,
      "contieneSolvencia": true/false,
      "contieneRequisitos": true/false,
      "contieneRestricciones": true/false,
      "contieneModeloServicio": true/false
    }
  ],
  "lotes": {
    "hayLotes": true/false,
    "numeroLotes": 0,
    "descripcion": "descripción si hay lotes"
  },
  "tablasClave": [
    { "descripcion": "tabla identificada", "seccion": "sección donde se encuentra" }
  ],
  "observaciones": ["observación relevante"]
}`;

export async function runDocumentMap(input: DocumentMapInput): Promise<DocumentMap> {
    const { openai, vectorStoreId, fileNames, guideContent, onProgress } = input;

    onProgress?.('Analizando estructura documental...');

    // Condensed guide excerpt for the document map phase
    const guideExcerpt = guideContent.substring(0, 3000);

    const response = await openai.responses.create({
        model: 'gpt-4.1',
        input: [
            {
                role: 'user',
                content: DOCUMENT_MAP_PROMPT(fileNames, guideExcerpt),
            },
        ],
        tools: [
            {
                type: 'file_search',
                vector_store_ids: [vectorStoreId],
            },
        ],
    });

    // Extract text from response
    const outputText = extractOutputText(response);

    // Parse JSON from response
    const parsed = parseJsonFromText(outputText);
    const validated = DocumentMapSchema.parse(parsed);

    console.log(
        `[DocumentMap] Identified ${validated.documentos.length} documents, lotes: ${validated.lotes.hayLotes}`
    );
    onProgress?.(`Mapa documental: ${validated.documentos.length} documentos identificados`);

    return validated;
}

function extractOutputText(response: OpenAI.Responses.Response): string {
    // The Responses API returns output as an array of items
    for (const item of response.output) {
        if (item.type === 'message' && item.content) {
            for (const content of item.content) {
                if (content.type === 'output_text') {
                    return content.text;
                }
            }
        }
    }
    throw new Error('No text output found in Responses API response');
}

function parseJsonFromText(text: string): unknown {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch {
        // Try extracting JSON from markdown code block
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        // Try finding first { to last }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return JSON.parse(text.substring(start, end + 1));
        }
        throw new Error('No se pudo extraer JSON válido de la respuesta');
    }
}

export { extractOutputText, parseJsonFromText };
