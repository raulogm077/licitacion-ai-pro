// Allowed origins for CORS
const ALLOWED_ORIGINS = ['https://licitacion-ai-pro.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];

function isAllowedOrigin(origin: string): boolean {
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    // Allow Vercel preview deployments for this project
    if (/^https:\/\/licitacion-ai-[\w-]+\.vercel\.app$/.test(origin)) return true;
    return false;
}

export function getCorsHeaders(req?: Request): Record<string, string> {
    const origin = req?.headers.get('origin') || '';
    const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        Vary: 'Origin',
    };
}
