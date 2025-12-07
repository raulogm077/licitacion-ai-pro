import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "./schemas";

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

const MODEL_NAME = "gemini-1.5-pro"; // Upgraded to Pro model for advanced reasoning and higher precision

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
        Actúa como un experto analista de licitaciones públicas. Tu tarea es analizar el pliego adjunto y extraer información estructurada con ALTA PRECISIÓN.
        
        INSTRUCCIONES DE PENSAMIENTO (CHAIN OF THOUGHT):
        1. **Escaneo General**: Identifica Objeto, Órgano de Contratación y CPV (Códigos Comunes de Contratos Públicos).
        2. **Presupuesto**: Busca la cifra exacta del Presupuesto Base de Licitación (sin impuestos). Asegúrate de identificar la moneda (generalmente EUR).
        3. **Plazos**: Encuentra el plazo de ejecución (en meses) y la fecha límite de presentación de ofertas (si aparece explícitamente).
        4. **Criterios de Adjudicación**: Distingue rigurosamente entre:
           - Criterios Objetivos (Evaluables mediante fórmulas/automáticos). Extrae la fórmula si es posible.
           - Criterios Subjetivos (Juicio de valor). Resume qué se pide.
           - Asigna la ponderación exacta a cada uno.
        5. **Solvencia y Requisitos**:
           - Solvencia Económica: Cifra de negocios anual mínima requerida.
           - Solvencia Técnica: Experiencia previa requerida (número de proyectos, importes, años).
           - Riesgos/Kill Criteria: Identifica cláusulas que podrían excluir al licitador o suponer un riesgo alto.
        6. **Generación**: Construye el JSON final.

        FORMATO DE SALIDA:
        Debes devolver UNICAMENTE un objeto JSON válido. No incluyas bloques de código markdown (\`\`\`json) ni texto adicional fuera del JSON.
        
        ESQUEMA JSON OBJETIVO:
        (El sistema espera exactamente la interfaz LicitacionData definida en tu contexto).
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
            const text = response.text();

            if (onThinking) onThinking("Generando respuesta estructurada...");

            return this.cleanAndParseJson(text);
        } catch (error) {
            console.error("Error in AI analysis:", error);
            if (error instanceof LicitacionAIError) throw error;
            throw new LicitacionAIError("Falló el análisis del documento", error);
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
