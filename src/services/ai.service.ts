import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "../lib/schemas";
import { logger } from "./logger";

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





            console.log("🤖 [AI RAW RESPONSE PRE-PARSE]:", text.substring(0, 500)); // Debug log for empty response issues
            logger.debug("Respuesta RAW de IA recibida", { preview: text.substring(0, 200) + "..." });

            const parsed = this.cleanAndParseJson(text);
            return parsed;
        } catch (error) {
            console.error("❌ CRITICAL AI ERROR:", error);
            logger.error("Error crítico en análisis AI", { error: String(error) });

            // Log full error details if available
            if (error && typeof error === 'object' && 'response' in error) {
                const responseError = (error as { response: unknown }).response;
                console.error("Full Response Error:", responseError);
                logger.error("Detalles de respuesta de error AI", responseError);
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

            let parsed = JSON.parse(cleanText);

            // 2.1 Smart Correction: Check for common AI mistakes

            // Define Normalization Helper
            const normalizeKeys = (obj: unknown): unknown => {
                if (Array.isArray(obj)) {
                    return obj.map(normalizeKeys);
                }
                if (obj !== null && typeof obj === 'object') {
                    return Object.keys(obj).reduce((acc, key) => {
                        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        acc[lowerKey] = normalizeKeys((obj as any)[key]);
                        return acc;
                    }, {} as Record<string, unknown>);
                }
                return obj;
            };

            // STRATEGY 1: Normalize keys immediately (fixes DatosGenerales -> datosGenerales)
            parsed = normalizeKeys(parsed);

            // STRATEGY 2: Check for wrapping (e.g. { response: { datosGenerales: ... } })
            // Only unwrap if we generally don't see 'datosGenerales' but see it inside a child
            if (!parsed.datosGenerales && !parsed.metadata) {
                const keys = Object.keys(parsed);
                if (keys.length === 1 && typeof parsed[keys[0]] === 'object') {
                    const child = parsed[keys[0]];
                    // Check if child has what we need
                    if (child.datosGenerales || child.metadata) {
                        console.log("⚠️ AI wrapped response detected, unwrapping...");
                        parsed = child;
                    }
                }
            }

            // 3. Zod Validation
            // Now that we removed defaults, this will THROW if data is still missing, 
            // which is better than silently returning empty data.
            // 3. Zod Validation
            const result = LicitacionSchema.parse(parsed);

            // 4. Quality Gate: Reject if "meaningless" (only defaults)
            if (result.datosGenerales.titulo === "Sin título" && result.datosGenerales.presupuesto === 0) {
                throw new LicitacionAIError("Análisis incompleto: La IA no pudo extraer el título ni el presupuesto del documento.");
            }

            return result;

        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("Failed to parse or validate JSON:", text.substring(0, 200), errorMsg);
            logger.error("Fallo de validación/parseo JSON", {
                error: e instanceof Error ? e.message : String(e),
                rawTextPreview: text.substring(0, 100)
            });

            throw new LicitacionAIError(
                "La respuesta de la IA no es válida. " +
                (e instanceof Error ? e.message : "Error de validación") +
                "\n\nRaw: " + text.substring(0, 100),
                e
            );
        }
    }
}
