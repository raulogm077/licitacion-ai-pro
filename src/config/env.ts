import { z } from 'zod';

const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL must be a valid URL"),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY is required"),
    // Include other keys if found, e.g. VITE_GEMINI_API_KEY? (Check usage)
});

const getEnvSource = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env;
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env;
    }
    return {};
};

const processEnv = getEnvSource();

const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    const errors = parsed.error.format();
    const missing = Object.entries(errors)
        .filter(([, value]) => value && '_errors' in value)
        .map(([key]) => key)
        .join(', ');

    throw new Error(
        `❌ Invalid Environment Configuration: Missing or invalid keys: ${missing}. Please check your .env file.`
    );
}

export const env = parsed.data;
