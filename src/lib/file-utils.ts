export async function generateBufferHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export function validateBufferMagicBytes(buffer: ArrayBuffer): boolean {
    const bytes = new Uint8Array(buffer.slice(0, 4));
    // PDF Magic Bytes: %PDF (0x25 0x50 0x44 0x46)
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export function bufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Optimized file processor: reads file ONCE and generates all needed artifacts.
 */
export async function processFile(file: File): Promise<{
    hash: string;
    base64: string;
    isValidPdf: boolean;
}> {
    // Read once as ArrayBuffer (needed for Hash and MagicBytes)
    const arrayBuffer = await file.arrayBuffer();

    // 1. Validate
    const isValidPdf = validateBufferMagicBytes(arrayBuffer);

    // 2. Hash
    const hash = await generateBufferHash(arrayBuffer);

    // 3. Base64
    const base64 = await bufferToBase64(arrayBuffer);

    return { hash, base64, isValidPdf };
}
