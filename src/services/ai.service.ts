import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "../lib/schemas";
import { logger } from "./logger";

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

const PRIMARY_MODEL = "gemini-2.0-flash-exp"; // High Quality / Low Quota
const FALLBACK_MODEL = "gemini-1.5-flash";   // Good Quality / High Quota

export class AIService {
    private genAI: GoogleGenerativeAI;
    private apiKey: string;
    private currentModelName: string;
    private model: GenerativeModel;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.genAI = new GoogleGenerativeAI(apiKey);

        // Start with Primary (Best Quality)
        this.currentModelName = PRIMARY_MODEL;
        this.model = this.initModel(this.currentModelName);
    }

    private initModel(modelName: string): GenerativeModel {
        return this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });
    }

    private switchToFallback() {
        if (this.currentModelName === PRIMARY_MODEL) {
            console.warn(`⚠️ Switching to Fallback Model: ${FALLBACK_MODEL}`);
            this.currentModelName = FALLBACK_MODEL;
            this.model = this.initModel(FALLBACK_MODEL);
            return true;
        }
        return false;
    }

    async analyzePdfContent(base64Content: string, onThinking?: (text: string) => void): Promise<LicitacionData> {
        const sections = [
            { key: 'datosGenerales', label: 'Datos Generales' },
            { key: 'criteriosAdjudicacion', label: 'Criterios de Adjudicación' },
            { key: 'requisitosSolvencia', label: 'Requisitos de Solvencia' },
            { key: 'requisitosTecnicos', label: 'Requisitos Técnicos' },
            { key: 'restriccionesYRiesgos', label: 'Restricciones y Riesgos' },
            { key: 'modeloServicio', label: 'Modelo de Servicio' }
        ];

        let partialResult: Partial<LicitacionData> = {};

        try {
            if (onThinking) onThinking(`Iniciando análisis con ${this.currentModelName}...`);

            let globalRetries = 0;
            const MAX_GLOBAL_RETRIES = 5;

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                if (onThinking) onThinking(`Analizando sección ${i + 1}/${sections.length} (${section.label})...`);

                logger.info(`Iniciando análisis de sección: ${section.key} [${this.currentModelName}]`);

                try {
                    const sectionData = await this.analyzeSection(base64Content, section.key);
                    partialResult = { ...partialResult, ...sectionData };

                    // Standard delay (4s) - reduced from 10s because we have fallback strategy now
                    await new Promise(resolve => setTimeout(resolve, 4000));

                } catch (sectionError) {
                    const errorStr = String(sectionError);
                    const isRateLimit = errorStr.includes("429") || errorStr.includes("Quota exceeded");

                    if (isRateLimit) {
                        // Strategy 1: Switch Model if on Primary
                        if (this.currentModelName === PRIMARY_MODEL) {
                            logger.warn("429 Rate Limit on Primary. Switching to Fallback.");
                            if (onThinking) onThinking("⚠️ Límite de cuota en modelo primario. Cambiando a modelo de respaldo (High Quota)...");

                            this.switchToFallback();

                            // Retry immediately (decrement i)
                            i--;
                            continue;
                        }

                        // Strategy 2: Smart Backoff if already on Fallback
                        if (globalRetries < MAX_GLOBAL_RETRIES) {
                            globalRetries++;
                            const waitTime = 60000 + (globalRetries * 10000);

                            logger.warn(`Rate Limit Hit on Fallback. Cooling down for ${waitTime}ms`, { section: section.key });
                            if (onThinking) onThinking(`⚠️ Límite de cuota en respaldo. Esperando ${Math.round(waitTime / 1000)}s...`);

                            await new Promise(resolve => setTimeout(resolve, waitTime));
                            i--;
                            continue;
                        }
                    }

                    console.error(`Error analizando sección ${section.key}:`, sectionError);
                    logger.error(`Error en sección ${section.key}`, { error: errorStr });
                }
            }

            logger.info("Análisis iterativo completado. Ensamblando resultado final.");
            if (onThinking) onThinking("Ensamblando y validando resultados finales...");

            // Final Validation / cleanup / hydration checks
            const finalResult = this.fillMissingDefaults(partialResult);

            // Validate with Zod
            const validated = LicitacionSchema.parse(finalResult);

            if (validated.datosGenerales.titulo === "Sin título" && validated.datosGenerales.presupuesto === 0) {
                // If the main section failed, the whole analysis is likely useless
                throw new LicitacionAIError("Análisis incompleto: La IA no pudo extraer el título ni el presupuesto (Fallo en Datos Generales).");
            }

            return validated;

        } catch (error) {
            console.error("❌ CRITICAL AI ERROR:", error);
            logger.error("Error crítico en análisis AI", { error: String(error) });

            if (error instanceof LicitacionAIError) throw error;
            throw new LicitacionAIError("Falló el análisis del documento: " + (error instanceof Error ? error.message : String(error)), error);
        }
    }

    private async analyzeSection(base64Content: string, sectionKey: string): Promise<Record<string, unknown>> {
        const prompt = this.getPromptForSection(sectionKey);

        // Retry logic: try up to 3 times
        let lastError: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (attempt > 1) {
                    // Smart backoff for Rate Limits (429) - 2s, 8s, 18s
                    const delay = 2000 * Math.pow(attempt, 2);
                    logger.warn(`Reintentando sección ${sectionKey} (Intento ${attempt}/3) en ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

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

                // Check for blocking
                if (!response.candidates || response.candidates.length === 0) {
                    if (response.promptFeedback?.blockReason) {
                        throw new Error(`Bloqueo de seguridad: ${response.promptFeedback.blockReason}`);
                    }
                    throw new Error("Respuesta de IA vacía (sin candidatos).");
                }

                const text = response.text();
                if (!text) throw new Error("Texto de respuesta vacío.");

                logger.debug(`Respuesta RAW sección ${sectionKey} (Intento ${attempt})`, { preview: text.substring(0, 100) + "..." });

                return this.cleanAndParseJson(text, sectionKey);

            } catch (e) {
                lastError = e;
                console.warn(`Fallo en intento ${attempt} para ${sectionKey}:`, e);
                // If it's a parse error, maybe retrying helps. If it's a block, usage of BLOCK_NONE should prevent it but let's retry anyway.
            }
        }

        throw new LicitacionAIError(`Falló sección ${sectionKey} tras 3 intentos. Último error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }

    private cleanAndParseJson(text: string, sectionKey: string): Record<string, unknown> {
        try {
            let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            // Remove common JS style comments if any
            cleanText = cleanText.replace(/^\s*\/\/.*$/gm, '');

            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanText = cleanText.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanText);

            // Expected format: { "datosGenerales": { ... } }
            // Or just { ... } if prompt wasn't followed perfectly.
            // But we can check if the top key matches sectionKey.
            // If the AI returns just the inner object, wrap it.

            if (parsed[sectionKey]) {
                return parsed as Record<string, unknown>;
            } else {
                // Heuristic: if it looks like the inner content, wrap it
                return { [sectionKey]: parsed };
            }
        } catch (e) {
            throw new LicitacionAIError(`Fallo de parseo JSON en sección ${sectionKey}: ` + (e instanceof Error ? e.message : String(e)) + `\nRaw: ${text.substring(0, 50)}...`, e);
        }
    }

    private getPromptForSection(sectionKey: string): string {
        // Base instructions
        const commonRules = `
            ERES UN EXPERTO ANALISTA DE LICITACIONES.
            OBJETIVO: Extraer SOLO información relacionada con la sección "${sectionKey}" del PDF.
            
            REGLAS DE FORMATO:
            1. Devuelve SOLO un JSON válido.
            2. SIN markdown. SIN comentarios.
            3. Estructura esperada: { "${sectionKey}": { ... los campos pedidos ... } }

            REGLAS DE CONTENIDO:
            1. Resume textos largos (>200 chars).
            2. Limita arrays a max 15 items (los más relevantes).
            3. Si no hay datos, usa null o [].
        `;

        let specificFields = "";

        // Define specific fields per section to keep prompt small and focused
        switch (sectionKey) {
            case 'datosGenerales':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "datosGenerales"):
                - titulo: Título del expediente.
                - presupuesto: Número (base sin impuestos).
                - moneda: "EUR".
                - plazoEjecucionMeses: Número.
                - cpv: Array de strings [códigos].
                - organoContratacion: String.
                `;
                break;
            case 'criteriosAdjudicacion':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "criteriosAdjudicacion"):
                - objetivos: Lista de {descripcion, ponderacion(num 0-100), formula}.
                - subjetivos: Lista de {descripcion, ponderacion(num 0-100), detalles}.
                `;
                break;
            case 'requisitosSolvencia':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "requisitosSolvencia"):
                - economica: { cifraNegocioAnualMinima(num), descripcion }.
                - tecnica: Lista de { descripcion, proyectosSimilaresRequeridos(num), importeMinimoProyecto(num) }.
                `;
                break;
            case 'requisitosTecnicos':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "requisitosTecnicos"):
                - funcionales: Lista de { requisito, obligatorio(bool) }. (Max 20 más importantes/críticos)
                - normativa: Lista de strings (Normas ISO, ENS, etc).
                `;
                break;
            case 'restriccionesYRiesgos':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "restriccionesYRiesgos"):
                - killCriteria: Lista de strings (requisitos excluyentes que impiden participar).
                - riesgos: Lista de {descripcion, impacto(ALTO/MEDIO/BAJO), mitigacionSugerida}.
                - penalizaciones: Lista de { causa, sancion }.
                `;
                break;
            case 'modeloServicio':
                specificFields = `
                CAMPOS A EXTRAER (dentro del objeto "modeloServicio"):
                - sla: Lista de strings (Acuerdos de Nivel de Servicio).
                - equipoMinimo: Lista de strings (Perfiles/Equipo).
                `;
                break;
        }

        return `${commonRules}\n${specificFields}`;
    }

    private fillMissingDefaults(partial: Partial<LicitacionData>): LicitacionData {
        // Hydrate missing sections with empty structures to ensure frontend doesn't crash
        return {
            datosGenerales: {
                titulo: "Sin título (Error Análisis)",
                presupuesto: 0,
                moneda: "EUR",
                plazoEjecucionMeses: 0,
                cpv: [],
                organoContratacion: "Desconocido",
                ...(partial.datosGenerales || {})
            },
            criteriosAdjudicacion: {
                objetivos: [],
                subjetivos: [],
                ...(partial.criteriosAdjudicacion || {})
            },
            requisitosSolvencia: {
                economica: { cifraNegocioAnualMinima: 0 },
                tecnica: [],
                ...(partial.requisitosSolvencia || {})
            },
            requisitosTecnicos: {
                funcionales: [],
                normativa: [],
                ...(partial.requisitosTecnicos || {})
            },
            restriccionesYRiesgos: {
                killCriteria: [],
                riesgos: [],
                penalizaciones: [],
                ...(partial.restriccionesYRiesgos || {})
            },
            modeloServicio: {
                sla: [],
                equipoMinimo: [],
                ...(partial.modeloServicio || {})
            },
            metadata: {
                tags: [],
                ...((partial as LicitacionData).metadata || {})
            }
        } as LicitacionData;
    }
}
