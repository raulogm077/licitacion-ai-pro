
import dotenv from 'dotenv';
import { runWorkflow } from '../api/_lib/openaiWorkflow/runner';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('Starting debug runner...');

    // Mock input
    const input = {
        pdfBase64: "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmogCjw8CiAgL1R5cGUgL1BhZ2VzCiAgL01lZGlhQm94IFsgMCAwIDIwMCAyMDAgXQogIC9Db3VudCAxCiAgL0tpZHMgWyAzIDAgUiBdCj4+CmVuZG9iagoKMyAwIG9iago8PAogIC9UeXBlIC9QYWdlCiAgL1BhcmVudCAyIDAgUgogIC9SZXNvdXJjZXMgPDwKICAgIC9Gb250IDw8CiAgICAgIC9FMSA0IDAgUgogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmogCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTEKICAvQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKCjUgMCBvYmogCjw8IC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUIC9FMSAxMiBUZiAxMCAxMDAgVGQgKEhlbGxvIFdvcmxkKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MCAwMDAwMCBuIAowMDAwMDAwMTU3IDAwMDAwIG4gCjAwMDAwMDAyNTUgMDAwMDAgbiAKMDAwMDAwMDMzOCAwMDAwMCBuIAp0cmFpbGVyCjw8CiAgL1NpemUgNgogIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MzIKJSVFT0YK", // Tiny PDF "Hello World"
        readingMode: 'full' as const,
        hash: 'test-hash-12345',
        userId: 'test-user-id',
        filename: 'test.pdf'
    };

    try {
        console.log('Calling runWorkflow...');
        const result = await runWorkflow(input, {
            onProgress: (stage, message) => console.log(`[${stage}] ${message}`)
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error running workflow:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
    }
}

main();
