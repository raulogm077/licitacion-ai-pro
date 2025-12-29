/**
 * Manual test script for OpenAI Provider
 * Run with: npx tsx scripts/test-openai-provider.ts
 */

import { llmFactory } from '../src/llm/llmFactory';

async function testOpenAIProvider() {
    console.log('🧪 Testing OpenAI Provider...\n');

    // 1. Check provider availability
    console.log('1️⃣ Checking provider availability...');
    const providers = llmFactory.listProviders();
    console.log('   Available providers:', providers);

    const openai = llmFactory.getProvider('openai');
    console.log('   OpenAI available:', openai.isAvailable());
    console.log('   OpenAI config valid:', openai.validateConfig());

    // 2. Get metadata
    console.log('\n2️⃣ Provider metadata:');
    const metadata = llmFactory.getMetadata('openai');
    console.log('   ', metadata);

    // 3. Test with minimal request
    console.log('\n3️⃣ Testing minimal analysis (this will make a real API call)...');
    console.log('   Note: This test is commented out to avoid accidental API costs.');
    console.log('   Uncomment the code below to test with real PDF.\n');

    /*
    // Uncomment to test with real API
    try {
        const testPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMyAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihUZXN0IFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAxNSAwMDAwMCBuCjAwMDAwMDAwNjQgMDAwMDAgbgowMDAwMDAwMTIxIDAwMDAwIG4KMDAwMDAwMDIxMCAwMDAwMCBuCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzAyCiUlRU9G';
        
        const result = await openai.analyzeSection({
            base64Content: testPdfBase64,
            systemPrompt: 'Eres un asistente que extrae información de licitaciones.',
            sectionPrompt: 'Extrae el título del documento.',
            sectionKey: 'informacionBasica'
        });
        
        console.log('   ✅ Analysis successful!');
        console.log('   Result:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error('   ❌ Error:', error.message);
        console.error('   Code:', error.code);
    }
    */

    console.log('\n✅ Manual verification complete!');
    console.log('\nNext steps:');
    console.log('1. Uncomment the test code above to verify with real API');
    console.log('2. Upload a PDF in the app and select OpenAI provider (once UI is ready)');
    console.log('3. Verify Gemini still works as default\n');
}

testOpenAIProvider().catch(console.error);
