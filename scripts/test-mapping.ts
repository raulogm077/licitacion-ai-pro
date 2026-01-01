
import { z } from 'zod';
import { LicitacionContentSchema } from '../src/lib/schemas';

// Mock Response exactly as OpenAI Assistant V2 returns it (based on setup-assistant-v2.ts)
const MOCK_OPENAI_RESPONSE = {
    result: {
        datosGenerales: {
            titulo: "Licitación de Prueba para Mapeo",
            presupuesto: 150000,
            moneda: "EUR",
            plazoEjecucionMeses: 12,
            cpv: ["72000000-5"],
            organoContratacion: "Agencia de Pruebas Tecnológicas"
        },
        criteriosAdjudicacion: {
            objetivos: [{ descripcion: "Precio", ponderacion: 60, formula: "P = 60 * (Min/Of)" }],
            subjetivos: [{ descripcion: "Calidad Técnica", ponderacion: 40 }]
        },
        requisitosTecnicos: {
            funcionales: [
                { requisito: "Debe soportar alta disponibilidad", obligatorio: true }
            ],
            normativa: []
        },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 300000, descripcion: "Volumen anual de negocios" },
            tecnica: []
        },
        restriccionesYRiesgos: {
            killCriteria: ["No superar el presupuesto base"],
            riesgos: [],
            penalizaciones: []
        },
        modeloServicio: {
            sla: [],
            equipoMinimo: []
        }
    },
    workflow: {
        quality: {
            overall: "COMPLETO",
            bySection: { datosGenerales: "COMPLETO" },
            missingCriticalFields: [],
            ambiguous_fields: [],
            warnings: []
        },
        evidences: []
    }
};

console.log("🚀 Starting Mapping Verification Test...");

try {
    const rawData: any = MOCK_OPENAI_RESPONSE;

    // --- THIS IS THE LOGIC I ADDED TO THE BACKEND ---
    console.log("👉 Simulating Backend Logic: Unwrapping 'result'...");

    let contentToValidate = rawData;
    if (rawData.result && typeof rawData.result === 'object') {
        console.log("✅ Detected 'result' wrapper. Unwrapping...");
        contentToValidate = rawData.result;
    } else {
        console.log("ℹ️ No wrapper detected (or raw data).");
    }
    // ------------------------------------------------

    console.log("👉 Validating against App Schema (LicitacionContentSchema)...");
    const parsed = LicitacionContentSchema.parse(contentToValidate);

    console.log("✅ SUCCESS! Data Mapped Correctly.");
    console.log("---------------------------------------------------");
    console.log("Title Extracted:", parsed.datosGenerales.titulo);
    console.log("Budget Extracted:", parsed.datosGenerales.presupuesto);
    console.log("Structure:", Object.keys(parsed).join(", "));
    console.log("---------------------------------------------------");

} catch (error) {
    console.error("❌ MAPPING FAILED:", error);
    process.exit(1);
}
