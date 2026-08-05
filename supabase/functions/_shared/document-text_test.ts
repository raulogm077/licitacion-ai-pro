/**
 * Tests del oráculo de verificación (ADR-003 Fase 2).
 *
 * Lo que se fija aquí no es «sabe leer PDFs» sino la disciplina que hace útil al
 * oráculo: no lanzar nunca, y no confundir «no hay texto» con «la cita no está».
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { absenceIsConclusive, DOCUMENT_TEXT_STATUSES, extractDocumentText } from './document-text.ts';

/**
 * Constructor mínimo de PDF. Se prefiere a un fixture en base64 porque el
 * contenido de cada caso queda legible: un PDF con texto y otro cuya única
 * página es un rectángulo —el escaneo sin OCR— se distinguen leyendo el test.
 */
function buildPdf(pageStreams: string[]): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => objects.push(body);

    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontId = 1;
    const contentIds = pageStreams.map((stream) => add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
    const pagesId = objects.length + pageStreams.length + 1;
    const kidIds = contentIds.map((contentId) =>
        add(
            `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
                `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
        )
    );
    const pagesRef = add(
        `<< /Type /Pages /Count ${kidIds.length} /Kids [${kidIds.map((id) => `${id} 0 R`).join(' ')}] >>`
    );
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object, index) => {
        offsets.push(body.length);
        body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        body += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return new TextEncoder().encode(body);
}

const PLIEGO_REAL =
    'BT /F1 11 Tf 40 780 Td 14 TL ' +
    '(Expediente DDT 163/2026 Suministro de una solucion para Contratacion de Clientes) Tj T* ' +
    '(El presupuesto base de licitacion asciende a 8.587.086,00 euros IVA excluido.) Tj ET';

/** Página válida sin un solo operador de texto: el escaneo sin OCR. */
const SOLO_UN_RECTANGULO = '0.5 g 100 100 300 400 re f';

Deno.test('extrae el texto de un PDF digital', async () => {
    const result = await extractDocumentText(buildPdf([PLIEGO_REAL]), 'pliego.pdf', 'application/pdf');

    assertEquals(result.status, 'extracted');
    assertEquals(result.pageCount, 1);
    assert(result.text.includes('DDT 163/2026'), `no se recuperó el expediente: ${result.text}`);
    assert(result.text.includes('8.587.086,00'), 'no se recuperó el importe');
    assertEquals(result.charCount, result.text.length);
});

// ─── No saber ≠ saber que no está ────────────────────────────────────────────
//
// Es la distinción entera de la fase. Un escaneo sin OCR no aporta texto, y de
// ahí NO se sigue que las citas del modelo sean falsas: se sigue que no podemos
// comprobarlas. Colapsar los dos casos repetiría, sobre la evidencia, el error
// de los contadores de ingesta de `ARCHITECTURE.md` §8.24.

Deno.test('un escaneo sin OCR es "empty", no un fallo, y no permite acusar a ninguna cita', async () => {
    const result = await extractDocumentText(buildPdf([SOLO_UN_RECTANGULO]), 'escaneo.pdf', 'application/pdf');

    assertEquals(result.status, 'empty');
    assertEquals(result.text, '');
    assertEquals(result.pageCount, 1, 'el PDF se parseó bien: el problema es el contenido, no el fichero');
    assert(!absenceIsConclusive(result.status), 'sin texto no se puede declarar fabricada ninguna cita');
});

Deno.test('absenceIsConclusive solo es cierto con el texto completo', () => {
    for (const status of DOCUMENT_TEXT_STATUSES) {
        assertEquals(
            absenceIsConclusive(status),
            status === 'extracted',
            `${status} no puede autorizar un veredicto de cita fabricada`
        );
    }
});

Deno.test('un texto recortado conserva el prefijo y deja de ser concluyente', async () => {
    const result = await extractDocumentText(buildPdf([PLIEGO_REAL]), 'pliego.pdf', 'application/pdf', {
        maxChars: 20,
    });

    assertEquals(result.status, 'truncated');
    assertEquals(result.charCount, 20);
    assertEquals(result.text.length, 20);
    assert(!absenceIsConclusive(result.status), 'la cita podría vivir en la parte que no leímos');
});

Deno.test('unos bytes que no son un PDF fallan sin lanzar', async () => {
    const result = await extractDocumentText(new TextEncoder().encode('esto no es un PDF'), 'roto.pdf');

    assertEquals(result.status, 'failed');
    assertEquals(result.text, '');
    assert(result.reason && result.reason.length > 0, 'un fallo tiene que decir por qué');
});

Deno.test('un formato sin extractor se declara "unsupported", no vacío', async () => {
    const result = await extractDocumentText(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'anexo.docx');

    assertEquals(result.status, 'unsupported');
    assert(!absenceIsConclusive(result.status));
});

Deno.test('un .txt se lee directamente', async () => {
    const result = await extractDocumentText(new TextEncoder().encode('Anexo I: criterios'), 'anexo.txt', 'text/plain');

    assertEquals(result.status, 'extracted');
    assertEquals(result.text, 'Anexo I: criterios');
    assertEquals(result.pageCount, null);
});

// ─── El buffer del llamante sigue sirviendo ──────────────────────────────────
//
// pdf.js toma posesión del buffer que recibe y puede dejarlo separado. El worker
// extrae el texto de los mismos bytes que sube a OpenAI acto seguido, así que un
// buffer separado aquí significaría subir un fichero vacío sin que nada falle.

Deno.test('extraer texto no inutiliza los bytes que el llamante va a subir', async () => {
    const bytes = buildPdf([PLIEGO_REAL]);
    const originalLength = bytes.byteLength;
    const originalHead = bytes.slice(0, 8);

    await extractDocumentText(bytes, 'pliego.pdf', 'application/pdf');

    // Un buffer separado responde 0 a `byteLength` y devuelve vacío al cortarlo,
    // así que estas dos aserciones cubren el caso sin depender de `Blob`.
    assertEquals(bytes.byteLength, originalLength, 'el buffer quedó separado: la subida a OpenAI iría vacía');
    assertEquals(Array.from(bytes.slice(0, 8)), Array.from(originalHead));
});
