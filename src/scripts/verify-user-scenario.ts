import 'dotenv/config';
import { authService } from '../services/auth.service';
import { dbService } from '../services/db.service';
import { AIService } from '../services/ai.service';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Mock Browser globals

if (typeof window === 'undefined') {

    // @ts-expect-error
    global.window = {
        location: { origin: 'http://localhost:3000' } as unknown as Location
    };
}

async function runScenario() {
    const userEmail = "raulogm07@hotmail.com";
    const fileName = "memo_p2.pdf";
    const filePath = resolve(process.cwd(), fileName);

    console.log(`🚀 Iniciando Prueba de Usuario: ${userEmail}`);
    console.log(`📂 Documento: ${fileName}`);

    // step 1: Auth
    console.log(`\n🔐 Paso 1: Autenticación`);
    const { session } = await authService.getSession();

    if (session) {
        console.log(`✅ Sesión activa detectada para: ${session.user.email}`);
    } else {
        console.log(`⚠️ No hay sesión activa.`);
        console.log(`ℹ️ Intentando login (Simulado - Magic Link requiere interacción manual)...`);
        const { error } = await authService.signInWithMagicLink(userEmail);
        if (error) {
            console.error(`❌ Error solicitando magic link:`, error.message);
        } else {
            console.log(`✅ Magic Link enviado a ${userEmail}.`);
            console.log(`⚠️ NOTA: El script no puede continuar con el guardado en BD hasta que el usuario haga click en el email.`);
            console.log(`   Sin embargo, podemos probar el análisis de IA y mostrar los resultados.`);
        }
    }

    // step 2: Read File
    console.log(`\n📖 Paso 2: Lectura de Archivo`);
    let fileBuffer: Buffer;
    try {
        fileBuffer = await readFile(filePath);
        console.log(`✅ Archivo leído (${fileBuffer.length} bytes)`);

        // Validate Magic Bytes (Simulating Hook logic)
        const header = fileBuffer.subarray(0, 5).toString('ascii');
        if (header !== '%PDF-') {
            throw new Error("Invalid PDF Header");
        }
        console.log(`✅ Magic Bytes válidos: ${header}`);

    } catch (e) {
        console.error(`❌ Error leyendo archivo:`, e);
        return;
    }

    // Step 3: AI Analysis
    console.log(`\n🧠 Paso 3: Análisis con IA`);
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Falta VITE_GEMINI_API_KEY en .env");
        return;
    }

    const aiService = new AIService(apiKey);
    const base64 = fileBuffer.toString('base64');

    try {
        console.log("⏳ Enviando a Gemini...");
        const result = await aiService.analyzePdfContent(base64, (msg) => console.log(`   🤖 ${msg}`));

        console.log("\n✨ Resultado del Análisis:");
        console.log("----------------------------------------");
        console.log(`Título: ${result.datosGenerales.titulo}`);
        console.log(`Presupuesto: ${result.datosGenerales.presupuesto} ${result.datosGenerales.moneda}`);
        console.log(`Organo: ${result.datosGenerales.organoContratacion}`);
        console.log("----------------------------------------");

        // Step 4: Persistence
        console.log(`\n💾 Paso 4: Persistencia (BD)`);
        const hash = "test_hash_" + Date.now(); // Dummy hash

        await dbService.saveLicitacion(hash, fileName, result);
        console.log("✅ Guardado exitoso en Supabase!");

    } catch (err: unknown) {
        const error = err as Error;
        if (error.message.includes('Persistencia Bloqueada')) {
            console.log(`⚠️ ${error.message}`);
            console.log("👉 EL ANÁLISIS FUE CORRECTO, pero no se guardó por falta de login/permisos.");
        } else {
            console.error("❌ Error en el proceso:", err);
        }
    }
}

runScenario();
