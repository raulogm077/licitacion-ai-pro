import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe access to environment variables in both Vite (client) and Node (scripts/tests)
const getEnv = (key: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

let client: SupabaseClient;

// Lazy initialization logic simplified since we have hardcoded fallbacks now
// But keeping a check just in case strings are empty
if (!supabaseUrl || !supabaseAnonKey) {
    // Return a Proxy that throws specific error only when utilized
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = new Proxy({} as any, {
        get: (_target, prop) => {
            // Allow checking for 'then' to avoid promise-like checks crashing immediately
            if (prop === 'then') return undefined;
            if (prop === '__esModule') return true;

            throw new Error(
                `Supabase Client Error: Intentando acceder a 'supabase.${String(prop)}' pero las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están configuradas.`
            );
        }
    });
} else {
    client = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = client;
