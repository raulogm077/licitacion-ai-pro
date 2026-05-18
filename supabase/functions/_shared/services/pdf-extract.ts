/**
 * Local PDF text pre-pass.
 *
 * The pipeline delegates document reading to the OpenAI Files API + vector
 * store (file_search). That round-trip silently yields an empty extraction
 * for image-only / scanned PDFs. This module reads the PDF text locally
 * *before* the upload so the pipeline can detect an unreadable document and
 * surface a clear diagnostic instead of returning a blank analysis.
 *
 * It is intentionally defensive: any failure resolves to `extractionFailed`
 * and never throws, so a parser problem can never abort ingestion.
 */
import { SCANNED_PDF_CHARS_PER_PAGE_THRESHOLD } from '../config.ts';

export interface PdfTextExtraction {
    /** Merged plain text of the document (trimmed). Empty when unreadable. */
    text: string;
    /** Number of pages reported by the parser (0 when extraction failed). */
    pageCount: number;
    /** Average extractable characters per page. */
    charsPerPage: number;
    /** True when the document looks image-only (multi-page, near-zero text). */
    looksScanned: boolean;
    /** True when the PDF could not be parsed at all (corrupt / encrypted). */
    extractionFailed: boolean;
}

const EMPTY_EXTRACTION: PdfTextExtraction = {
    text: '',
    pageCount: 0,
    charsPerPage: 0,
    looksScanned: false,
    extractionFailed: true,
};

/**
 * Extract text from a PDF given its raw bytes. Never throws.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextExtraction> {
    try {
        // Dynamic import so a missing/incompatible parser degrades gracefully
        // instead of breaking the whole Edge Function at module load time.
        const { extractText, getDocumentProxy } = await import('npm:unpdf');
        const pdf = await getDocumentProxy(bytes);
        const extracted = await extractText(pdf, { mergePages: true });

        const rawText = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;
        const text = (rawText ?? '').trim();
        const pageCount = extracted.totalPages ?? 0;
        const charsPerPage = pageCount > 0 ? text.length / pageCount : text.length;

        // A 1-page stub with little text is not "scanned"; a multi-page PDF
        // with near-zero extractable text almost certainly is.
        const looksScanned = pageCount >= 2 && charsPerPage < SCANNED_PDF_CHARS_PER_PAGE_THRESHOLD;

        return { text, pageCount, charsPerPage, looksScanned, extractionFailed: false };
    } catch (error) {
        console.warn(
            '[pdf-extract] Local text extraction failed:',
            error instanceof Error ? error.message : String(error)
        );
        return { ...EMPTY_EXTRACTION };
    }
}
