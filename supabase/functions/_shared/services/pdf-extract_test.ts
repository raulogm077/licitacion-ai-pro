import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractPdfText } from './pdf-extract.ts';

const repoPdf = new URL('../../../../memo_p2.pdf', import.meta.url);

Deno.test('extractPdfText reads text and page count from a real PDF', async () => {
    const bytes = await Deno.readFile(repoPdf);
    const result = await extractPdfText(bytes);

    assertEquals(result.extractionFailed, false);
    assert(result.pageCount >= 1, `expected at least 1 page, got ${result.pageCount}`);
    assert(result.text.length > 0, 'expected non-empty extracted text');
    assert(result.text.includes('PLIEGO'), `expected pliego text, got: ${result.text.slice(0, 80)}`);
});

Deno.test('extractPdfText does not flag a short single-page PDF as scanned', async () => {
    const bytes = await Deno.readFile(repoPdf);
    const result = await extractPdfText(bytes);

    // memo_p2.pdf is a 1-page stub: low text volume but not image-only.
    // The scanned heuristic requires >= 2 pages, so it must not trip here.
    assertEquals(result.looksScanned, false);
});

Deno.test('extractPdfText never throws on invalid input', async () => {
    const result = await extractPdfText(new Uint8Array([1, 2, 3, 4]));

    assertEquals(result.extractionFailed, true);
    assertEquals(result.text, '');
    assertEquals(result.pageCount, 0);
    assertEquals(result.looksScanned, false);
});
