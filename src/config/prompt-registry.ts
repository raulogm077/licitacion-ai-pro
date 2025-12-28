export interface PromptPlugin {
    id: string;
    name: string;
    description: string;
    version: string;

    // Core prompt logic
    getSystemPrompt: () => string;
    getSectionPrompt: (sectionKey: string) => string;
}

const DEFAULT_SYSTEM_PROMPT = `Eres un experto analista jurídico y técnico de licitaciones públicas en España. 
Tu objetivo es extraer datos estructurados de pliegos de prescripciones técnicas (PPT) y pliegos de cláusulas administrativas particulares (PCAP).
Sé preciso, objetivo y extrae únicamente información presente en el texto o deducciones directas muy claras.`;

export const DefaultAnalysisPlugin: PromptPlugin = {
    id: 'default-analyst',
    name: 'Analista Estándar',
    description: 'Análisis exhaustivo de pliegos siguiendo la normativa española.',
    version: '1.0.0',

    getSystemPrompt: () => DEFAULT_SYSTEM_PROMPT,

    getSectionPrompt: (sectionKey: string) => {
        const prompts: Record<string, string> = {
            datosGenerales: "Extrae el título de la licitación, presupuesto base de licitación (sin IVA), moneda, plazo de ejecución en meses, códigos CPV y el órgano de contratación.",
            criteriosAdjudicacion: "Identifica los criterios subjetivos (juicio de valor) y objetivos (fórmula). Para cada uno, incluye descripción, ponderación (porcentaje) y detalles o fórmula si está disponible.",
            requisitosTecnicos: "Extrae los requisitos funcionales obligatorios y detecta menciones a normas ISO, ENS, o certificaciones específicas requeridas.",
            requisitosSolvencia: "Extrae la cifra de negocio anual mínima requerida (solvencia económica) y los requisitos de solvencia técnica (número de proyectos similares, importes mínimos).",
            restriccionesYRiesgos: "Detecta 'Kill Criteria' (motivos de exclusión directa), riesgos de ejecución (impacto/probabilidad) y el cuadro de penalizaciones previsto.",
            modeloServicio: "Identifica niveles de servicio (SLA requeridos) y la composición mínima del equipo (roles, experiencia, titulación)."
        };
        return prompts[sectionKey] || "Analiza esta sección del pliego y extrae la información relevante.";
    }
};

export const FastAnalysisPlugin: PromptPlugin = {
    id: 'fast-analyst',
    name: 'Analista Rápido',
    description: 'Enfoque en datos generales y riesgos críticos. Ideal para filtrado inicial.',
    version: '1.0.0',

    getSystemPrompt: () => DEFAULT_SYSTEM_PROMPT,

    getSectionPrompt: (sectionKey: string) => {
        const prompts: Record<string, string> = {
            datosGenerales: "Extrae solo título, presupuesto y plazo. Sé muy breve.",
            restriccionesYRiesgos: "Identifica únicamente los 3 riesgos más críticos.",
        };
        return prompts[sectionKey] || "Extrae un resumen muy breve de esta sección.";
    }
};

class PromptRegistry {
    private static instance: PromptRegistry;
    private plugins: Map<string, PromptPlugin> = new Map();
    private activePluginId: string = 'default-analyst';

    private constructor() {
        this.register(DefaultAnalysisPlugin);
        this.register(FastAnalysisPlugin);
    }

    public static getInstance(): PromptRegistry {
        if (!PromptRegistry.instance) {
            PromptRegistry.instance = new PromptRegistry();
        }
        return PromptRegistry.instance;
    }

    public register(plugin: PromptPlugin) {
        this.plugins.set(plugin.id, plugin);
    }

    public setActivePlugin(id: string) {
        if (this.plugins.has(id)) {
            this.activePluginId = id;
        }
    }

    public getActivePlugin(): PromptPlugin {
        return this.plugins.get(this.activePluginId) || DefaultAnalysisPlugin;
    }

    public listPlugins(): PromptPlugin[] {
        return Array.from(this.plugins.values());
    }
}

export const promptRegistry = PromptRegistry.getInstance();
