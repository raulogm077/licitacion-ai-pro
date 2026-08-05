/**
 * Extracción local del texto de un documento — el oráculo de verificación.
 *
 * `docs/adr/ADR-003`, Fase 2. Hasta ahora el pipeline **nunca veía el contenido
 * de los PDFs**: los subía a OpenAI y preguntaba. Sin el texto en nuestro lado
 * no existe forma de comprobar que una `evidence.quote` esté realmente en el
 * documento, y de ahí salieron seis análisis de los mismos dos ficheros con
 * seis licitaciones distintas, cada una con su cita literal de apoyo.
 *
 * Este módulo no sustituye el parseo de OpenAI: el documento sigue yendo a la
 * Files API igual que antes. Lo que aporta es **algo contra lo que contrastar**.
 * De ahí las dos reglas que gobiernan todo lo de abajo:
 *
 * 1. **Nunca lanza.** El análisis del usuario no puede morir porque el oráculo
 *    falle. Un fallo aquí degrada la verificación, no el producto.
 * 2. **No saber y saber que no están son cosas distintas.** Un PDF escaneado
 *    sin OCR produce texto vacío; eso no convierte ninguna cita en falsa. Solo
 *    un texto completo permite afirmar que una cita no aparece — ver
 *    `absenceIsConclusive`, que es donde vive esa distinción.
 */
import { extractText, getDocumentProxy } from 'npm:unpdf@1.4.0';
import { DOCUMENT_TEXT_MAX_CHARS, DOCUMENT_TEXT_TIMEOUT_MS } from './config.ts';
import { callWithTimeout } from './utils/timeout.ts';

export const DOCUMENT_TEXT_STATUSES = ['extracted', 'truncated', 'empty', 'unsupported', 'failed'] as const;

export type DocumentTextStatus = (typeof DOCUMENT_TEXT_STATUSES)[number];

export interface DocumentTextExtraction {
    /**
     * - `extracted`: texto completo del documento.
     * - `truncated`: se alcanzó el tope; tenemos un prefijo y el resto se ignora.
     * - `empty`: se parseó bien y no hay texto (escaneo sin OCR).
     * - `unsupported`: no tenemos parser para este tipo (p. ej. `.docx`).
     * - `failed`: el parser falló o agotó el tiempo.
     */
    status: DocumentTextStatus;
    text: string;
    charCount: number;
    pageCount: number | null;
    /** Por qué no hay texto utilizable. Solo se rellena cuando algo fue mal. */
    reason?: string;
}

/**
 * ¿Que una cita **no** aparezca en este texto permite declararla fabricada?
 *
 * Esta función es la razón de ser del vocabulario de estados, y la única
 * autorizada a responder a esa pregunta. La Fase 3 traduce:
 *
 * - `true`  → una cita ausente es `not_found` (afirmamos que es falsa).
 * - `false` → una cita ausente es `unverifiable` (no lo sabemos).
 *
 * Solo `extracted` es concluyente. `truncated` no lo es porque la cita podría
 * vivir en la parte que no leímos, y confundir «no está en lo que miré» con «no
 * está» sería exactamente el error de los contadores de `ARCHITECTURE.md` §8.24
 * trasladado al terreno de la evidencia.
 *
 * Encontrar la cita sí es concluyente en todos los estados: si está, está.
 */
export function absenceIsConclusive(status: DocumentTextStatus): boolean {
    return status === 'extracted';
}

type DocumentKind = 'pdf' | 'plain-text' | 'unsupported';

function classifyDocument(fileName: string, mimeType?: string): DocumentKind {
    const type = (mimeType || '').toLowerCase();
    const name = fileName.toLowerCase();

    if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'plain-text';
    return 'unsupported';
}

function describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function finish(text: string, pageCount: number | null, maxChars: number): DocumentTextExtraction {
    // Un escaneo devuelve espacios y saltos de línea, no cadena vacía: la
    // ausencia de texto se juzga sobre el contenido, no sobre la longitud bruta.
    if (text.trim().length === 0) {
        return {
            status: 'empty',
            text: '',
            charCount: 0,
            pageCount,
            reason: 'El documento no contiene texto extraíble (probable escaneo sin OCR)',
        };
    }

    if (text.length > maxChars) {
        return {
            status: 'truncated',
            text: text.slice(0, maxChars),
            charCount: maxChars,
            pageCount,
            reason: `El texto supera el tope de ${maxChars} caracteres; se conserva el prefijo`,
        };
    }

    return { status: 'extracted', text, charCount: text.length, pageCount };
}

async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number | null }> {
    // Copia deliberada. pdf.js toma posesión del buffer que recibe y puede
    // dejarlo separado (`detached`); el llamante sigue necesitando esos mismos
    // bytes para subir el fichero a OpenAI justo después.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return {
        text: typeof text === 'string' ? text : (text as string[]).join('\n'),
        pageCount: typeof totalPages === 'number' ? totalPages : null,
    };
}

/**
 * Extrae el texto de un documento. **Nunca lanza**: cualquier fallo se devuelve
 * como estado, porque perder el oráculo no puede tumbar el análisis del usuario.
 */
export async function extractDocumentText(
    bytes: Uint8Array,
    fileName: string,
    mimeType?: string,
    options: { maxChars?: number; timeoutMs?: number } = {}
): Promise<DocumentTextExtraction> {
    const maxChars = options.maxChars ?? DOCUMENT_TEXT_MAX_CHARS;
    const timeoutMs = options.timeoutMs ?? DOCUMENT_TEXT_TIMEOUT_MS;
    const kind = classifyDocument(fileName, mimeType);

    if (kind === 'unsupported') {
        return {
            status: 'unsupported',
            text: '',
            charCount: 0,
            pageCount: null,
            reason: `No hay extractor de texto para ${fileName}`,
        };
    }

    try {
        if (kind === 'plain-text') {
            const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            return finish(text, null, maxChars);
        }

        const { text, pageCount } = await callWithTimeout(
            extractPdfText(bytes),
            timeoutMs,
            `Extracción de texto (${fileName})`
        );
        return finish(text, pageCount, maxChars);
    } catch (error) {
        const reason = describeError(error);
        console.warn(`[DocumentText] No se pudo extraer texto de ${fileName}: ${reason}`);
        return { status: 'failed', text: '', charCount: 0, pageCount: null, reason };
    }
}
