// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://licitacion-ai-pro.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];

export function getCorsHeaders(req?: Request): Record<string, string> {
    const origin = req?.headers.get('origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
}

// Backward-compatible export for existing code
export const corsHeaders = getCorsHeaders();
