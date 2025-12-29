import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, configStatus } from './env';

// Lazy initialization: Only create client if config is valid
let _supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
    if (!configStatus.isValid) {
        throw new Error(
            '❌ Supabase client not available: Missing or invalid environment configuration. ' +
            `Missing keys: ${configStatus.missingKeys.join(', ')}`
        );
    }

    if (!_supabaseClient) {
        _supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    }

    return _supabaseClient;
};

// Export a Proxy that throws helpful errors on usage if config invalid
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getSupabaseClient();
        const value = client[prop as keyof SupabaseClient];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});
