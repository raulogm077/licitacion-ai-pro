import { z } from 'zod';

const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL must be a valid URL"),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY is required"),
    // Include other keys if found, e.g. VITE_GEMINI_API_KEY? (Check usage)
});

const getEnvSource = () => {
    const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

    // Merge sources to ensure we catch shell variables in CI (process.env) 
    // even if running in a Vite context (which defines import.meta.env)
    return { ...procEnv, ...metaEnv };
};

const processEnv = getEnvSource();

const parsed = envSchema.safeParse(processEnv);

export const envConfig = {
    isValid: parsed.success,
    errors: parsed.success ? null : parsed.error.format(),
    values: parsed.success ? parsed.data : {} as Partial<z.infer<typeof envSchema>>
};

// Fallback to empty string to prevent crashes, but isConfigValid will be false
export const env = parsed.success ? parsed.data : {
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: ""
};

if (!parsed.success) {
    console.error("❌ Invalid Environment Configuration:", parsed.error.format());
}
