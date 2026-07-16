import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decodeAnalysisBase64, sanitizeStorageFilename, sha256Hex } from './durable-input.service.ts';

Deno.test('decodeAnalysisBase64 accepts plain values and data URLs', () => {
    assertEquals(new TextDecoder().decode(decodeAnalysisBase64('aG9sYQ==')), 'hola');
    assertEquals(new TextDecoder().decode(decodeAnalysisBase64('data:text/plain;base64,aG9sYQ==')), 'hola');
});

Deno.test('decodeAnalysisBase64 rejects malformed input', () => {
    assertThrows(() => decodeAnalysisBase64('%%%'), Error, 'formato base64 válido');
});

Deno.test('sanitizeStorageFilename strips path traversal and unsafe separators', () => {
    assertEquals(sanitizeStorageFilename('../../pliego final?.pdf'), 'pliego-final-.pdf');
});

Deno.test('sha256Hex returns a stable lowercase fingerprint', async () => {
    assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
