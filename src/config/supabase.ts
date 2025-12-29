import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// env is already validated at startup by import.
// If we reach here, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are valid strings.

export const supabase: SupabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
