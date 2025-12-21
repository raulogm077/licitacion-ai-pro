import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LICITACION_PROMPT } from '../src/lib/ai-prompt';
import { cleanAndParseJson, LicitacionAIError } from '../src/lib/ai-utils';
import { createRateLimiter } from '../src/lib/rate-limit';
import { validateBase64Size } from '../src/lib/analysis-guards';

const MODEL_NAME = 'gemini-1.5-pro';
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const MAX_BASE64_LENGTH = 14 * 1024 * 1024;
const rateLimiter = createRateLimiter(60_000, 10);

async function verifyFirebaseToken(token: string) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID no configurado.');
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!response.ok) {
        throw new Error('Token inválido.');
    }

    const payload = await response.json() as { aud?: string; sub?: string };
    if (payload.aud !== projectId || !payload.sub) {
        throw new Error('Token inválido.');
    }

    return payload;
}

type AnalyzeRequest = {
    base64: string;
};

type VercelRequest = IncomingMessage & {
    body?: AnalyzeRequest;
    method?: string;
};

type VercelResponse = ServerResponse & {
    json: (body: unknown) => void;
    status: (statusCode: number) => VercelResponse;
};

function sendSse(res: VercelResponse, payload: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readRequestBody(req: VercelRequest): Promise<AnalyzeRequest | null> {
    if (req.body) {
        return req.body;
    }

    const chunks: Uint8Array[] = [];

    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    if (chunks.length === 0) {
        return null;
    }

    try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        return JSON.parse(raw) as AnalyzeRequest;
    } catch (error) {
        console.error('Invalid request body:', error);
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' });
        return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: 'Token de autenticación requerido.' });
        return;
    }

    let decodedToken;
    try {
        decodedToken = await verifyFirebaseToken(token);
    } catch (error) {
        console.error('Token inválido:', error);
        res.status(401).json({ error: 'Token inválido.' });
        return;
    }

    const rateKey = decodedToken.sub || req.socket.remoteAddress || 'anonymous';
    const rateStatus = rateLimiter.check(rateKey);
    if (!rateStatus.allowed) {
        res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
        return;
    }

    const contentLength = req.headers['content-length'];
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
        res.status(413).json({ error: 'El cuerpo de la solicitud es demasiado grande.' });
        return;
    }

    const body = await readRequestBody(req);
    const base64 = body?.base64;
    if (!base64) {
        res.status(400).json({ error: 'Contenido base64 requerido.' });
        return;
    }
    try {
        validateBase64Size(base64, MAX_BASE64_LENGTH);
    } catch (error) {
        res.status(413).json({ error: error instanceof Error ? error.message : 'Contenido inválido.' });
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    try {
        sendSse(res, { type: 'status', message: 'Iniciando análisis en el servidor...' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
            },
        });

        sendSse(res, { type: 'status', message: 'Enviando documento a IA...' });

        const streamResult = await model.generateContentStream([
            LICITACION_PROMPT,
            {
                inlineData: {
                    data: base64,
                    mimeType: 'application/pdf',
                },
            },
        ]);

        let fullText = '';
        const maxChars = 200_000;
        for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            if (fullText.length + chunkText.length > maxChars) {
                throw new Error('La respuesta del modelo excede el tamaño permitido.');
            }
            fullText += chunkText;
            if (chunkText.trim()) {
                sendSse(res, { type: 'chunk', message: chunkText });
            }
        }

        sendSse(res, { type: 'status', message: 'Validando respuesta de IA...' });

        const parsed = cleanAndParseJson(fullText);
        sendSse(res, { type: 'result', data: parsed });
        res.end();
    } catch (error) {
        console.error('Error en análisis:', error);
        const message = error instanceof LicitacionAIError
            ? error.message
            : error instanceof Error
                ? error.message
                : 'Error desconocido en análisis';
        sendSse(res, { type: 'error', message });
        res.end();
    }
}
