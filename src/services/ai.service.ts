import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "../lib/schemas";

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

const MODEL_NAME = "gemini-flash-latest"; // Using alias as 1.5 is 404 and 2.0 has 0 quota

export class AIService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                temperature: 0.1, // Very low for maximum determinism and precision
                maxOutputTokens: 8192,
            }
        });
    }

    async analyzePdfContent(base64Content: string, onThinking?: (text: string) => void): Promise<LicitacionData> {
        try {
            if (onThinking) onThinking("Iniciando análisis profundo del documento...");

            const prompt = `
        ERES UN EXPERTO ANALISTA DE LICITACIONES. TU OBJETIVO ES EXTRAER DATOS CLAVE DE ESTE PDF Y DEVOLVER UN JSON PERFECTO.

        REGLAS CRÍTICAS:
        1. Responde SOLO con el JSON. Nada más antes ni después.
        2. Si un dato no aparece, usa null (o array vacío []). NO inventes datos.
        3. Para importes monetarios, extrae SOLO el número (ej: 10000.50).

        CAMPOS A EXTRAER (Estructura LicitacionData):
        - datosGenerales:
            - titulo: Título completo del expediente.
            - presupuesto: Base de licitación sin impuestos (número). Si no lo encuentras, pon 0.
            - moneda: "EUR" u otra.
            - plazoEjecucionMeses: Duración en meses (número).
            - cpv: Array de códigos CPV.
            - organoContratacion: Quién licita.

        - criteriosAdjudicacion:
            - objetivos (Fórmulas): Lista con {descripcion, ponderacion (0-100), formula}.
            - subjetivos (Juicio de Valor): Lista con {descripcion, ponderacion (0-100), detalles}.

        - requisitosSolvencia:
            - economica: { cifraNegocioAnualMinima (número), descripcion }.
            - tecnica: Lista con { descripcion, proyectosSimilaresRequeridos (número), importeMinimoProyecto (número) }.

        - requisitosTecnicos:
            - funcionales: Lista de requisitos "MUST HAVE".
            - normativa: Lista de normas (ISO, ENS, etc).

        - restriccionesYRiesgos:
            - killCriteria: Lista de requisitos excluyentes.
            - riesgos: Lista de posibles riesgos {descripcion, impacto (ALTO/MEDIO/BAJO), mitigacionSugerida}.
        
        - modeloServicio:
            - sla: Acuerdos de nivel de servicio.
            - equipoMinimo: Perfiles requeridos.

        FORMATO FINAL ESPERADO (EJEMPLO):
        {
          "datosGenerales": {
            "titulo": "Suministro de Licencias...",
            "presupuesto": 50000,
            "moneda": "EUR",
            "plazoEjecucionMeses": 12,
            "cpv": ["48000000"],
            "organoContratacion": "Ayuntamiento de..."
          },
          "criteriosAdjudicacion": {
            "objetivos": [],
            "subjetivos": []
          },
          "requisitosTecnicos": {
            "funcionales": [{ "requisito": "Debe ser cloud", "obligatorio": true }],
            "normativa": []
          },
          "requisitosSolvencia": {
            "economica": { "cifraNegocioAnualMinima": 0 },
            "tecnica": []
          },
          "restriccionesYRiesgos": {
            "killCriteria": [],
            "riesgos": [],
            "penalizaciones": []
          },
          "modeloServicio": {
            "sla": [],
            "equipoMinimo": []
          }
        }

        IMPORTANTE:
        - Respeta ESTRICTAMENTE las claves en minúsculas camelCase (ej: datosGenerales, no DatosGenerales).
        - Devuelve UNICAMENTE el JSON válido.
      `;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Content,
                        mimeType: "application/pdf",
                    },
                },
            ]);

            const response = await result.response;

            let text = "";
            try {
                text = response.text();
            } catch (textError) {
                console.error("Error extrayendo texto (Safety/Recitation):", textError);
                throw new LicitacionAIError("El modelo bloqueó la respuesta por seguridad/recitación.", textError);
            }

            if (!text) {
                throw new LicitacionAIError("La IA devolvió una respuesta vacía.");
            }

            if (onThinking) onThinking("Generando respuesta estructurada...");

            if (onThinking) onThinking("Generando respuesta estructurada...");

            console.log("🤖 [AI RAW RESPONSE PRE-PARSE]:", text.substring(0, 500)); // Debug log for empty response issues
            const parsed = this.cleanAndParseJson(text);
            return parsed;
        } catch (error) {
            console.error("❌ CRITICAL AI ERROR:", error);
            // Log full error details if available
            if (error && typeof error === 'object' && 'response' in error) {
                console.error("Full Response Error:", (error as { response: unknown }).response);
            }

            if (error instanceof LicitacionAIError) throw error;
            throw new LicitacionAIError("Falló el análisis del documento: " + (error instanceof Error ? error.message : String(error)), error);
        }
    }

    private cleanAndParseJson(text: string): LicitacionData {
        try {
            // 1. Remove Markdown code blocks
            let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

            // 2. Robustness: Find the first '{' and last '}' to isolate JSON from any "thinking" text
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanText = cleanText.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanText);

            // 3. Zod Validation
            return LicitacionSchema.parse(parsed);
        } catch (e) {
            console.error("Failed to parse or validate JSON:", text, e);
            throw new LicitacionAIError("La respuesta de la IA no es válida según el esquema (Zod Error)", e);
        }
    }
}
