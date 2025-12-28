import { readFile } from 'fs/promises';
import { config } from 'dotenv';
import { AIService } from '../services/ai.service';
import { logger } from '../services/logger';

// Load environment variables from .env file
config();

/**
 * Integration test script to verify that the AI service and schemas
 * can handle a real PDF document without crashes.
 * 
 * Run with: npx tsx src/scripts/test-real-pdf.ts
 */

async function testRealPdf() {
    console.log('🔍 Testing AI Service with real PDF: MEMO_P2.pdf\n');

    const pdfPath = '/Users/raulgomezmoya/Downloads/Documentos/MEMO_P2.pdf';

    try {
        // 1. Read the PDF file
        console.log('📄 Reading PDF file...');
        const pdfBuffer = await readFile(pdfPath);
        const base64Content = pdfBuffer.toString('base64');
        console.log(`✅ PDF loaded (${(pdfBuffer.length / 1024).toFixed(2)} KB)\n`);

        // 2. Get API key from environment
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('VITE_GEMINI_API_KEY not found in environment');
        }

        // 3. Initialize AI Service
        console.log('🤖 Initializing AI Service...');
        const aiService = new AIService(apiKey);
        console.log('✅ AI Service ready\n');

        // 4. Analyze the document
        console.log('🧠 Analyzing document with AI...');
        const startTime = Date.now();

        const result = await aiService.analyzePdfContent(base64Content, (thinking) => {
            console.log(`   💭 ${thinking}`);
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Analysis completed in ${duration}s\n`);

        // 5. Display results
        console.log('📊 ANALYSIS RESULTS:');
        console.log('==================\n');

        console.log('📋 Datos Generales:');
        console.log(`   - Título: ${result.datosGenerales.titulo}`);
        console.log(`   - Presupuesto: ${result.datosGenerales.presupuesto} ${result.datosGenerales.moneda}`);
        console.log(`   - Plazo: ${result.datosGenerales.plazoEjecucionMeses} meses`);
        console.log(`   - Órgano: ${result.datosGenerales.organoContratacion}`);
        console.log(`   - CPVs: ${result.datosGenerales.cpv.join(', ') || 'N/A'}\n`);

        console.log('🎯 Criterios de Adjudicación:');
        console.log(`   - Subjetivos: ${result.criteriosAdjudicacion.subjetivos.length}`);
        console.log(`   - Objetivos: ${result.criteriosAdjudicacion.objetivos.length}\n`);

        console.log('⚠️  Restricciones y Riesgos:');
        console.log(`   - Kill Criteria: ${result.restriccionesYRiesgos.killCriteria.length}`);
        console.log(`   - Riesgos identificados: ${result.restriccionesYRiesgos.riesgos.length}`);
        console.log(`   - Penalizaciones: ${result.restriccionesYRiesgos.penalizaciones.length}\n`);

        console.log('✅ TEST PASSED: Document processed successfully!\n');

        // 6. Show any logs from the logger (errors, warnings)
        const logs = (logger as any).getState?.().logs || [];
        if (logs.length > 0) {
            console.log('📝 Logger Entries:');
            logs.forEach((log: any) => {
                console.log(`   [${log.level}] ${log.message}`);
            });
        }

        return result;

    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        console.error('Error:', error);

        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }

        // Show logger errors
        const logs = (logger as any).getState?.().logs || [];
        if (logs.length > 0) {
            console.log('\n📝 Logger Entries (with errors):');
            logs.forEach((log: any) => {
                console.log(`   [${log.level}] ${log.message}`);
                if (log.data) {
                    console.log('   Data:', JSON.stringify(log.data, null, 2));
                }
            });
        }

        process.exit(1);
    }
}

// Run the test
testRealPdf().then(() => {
    console.log('🎉 Integration test completed successfully!');
    process.exit(0);
}).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
