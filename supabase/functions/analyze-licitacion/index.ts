// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "npm:@google/generative-ai@^0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Content, prompt, sectionKey } = await req.json();

    if (!base64Content || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Server Misconfiguration: GEMINI_API_KEY not set");
    }

    // Verified models for this API key 
    // Using widely available models
    const MODELS = [
      "gemini-1.5-flash",
      "gemini-2.0-flash-exp"
    ];

    const genAI = new GoogleGenerativeAI(apiKey);

    const generate = async (modelName: string) => {
      console.log(`[Edge-v6] Requesting '${sectionKey}' using ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Content, mimeType: "application/pdf" } },
      ]);

      const response = await result.response;
      return response.text();
    };

    let responseText = "";
    const errors: string[] = [];

    for (const m of MODELS) {
      try {
        responseText = await generate(m);
        break;
      } catch (e: unknown) {
        const errStr = String(e);
        const errObj = e instanceof Error ? e : new Error(errStr);
        console.error(`[Edge Fail] ${m}: ${errObj.message}`);
        errors.push(`${m}: ${errObj.message}`);

        // STOP if it's a client error (400) - Model works, input is bad (or valid rejection)
        if (errStr.includes("400") || errStr.includes("Bad Request")) {
          // If input is bad, no model will fix it. Throw immediately.
          throw e;
        }

        // Retry logic for quota or temporary server errors
        if (errStr.includes("429") || errStr.includes("Quota") || errStr.includes("500") || errStr.includes("503")) {
          console.warn(`[Edge] Retrying with next model in 1s...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        } else {
          // If it's a 404 or other, try next
          console.warn(`[Edge] Model failed with non-quota error. Trying next.`);
          continue;
        }
      }
    }

    if (!responseText) {
      throw new Error(`All models failed. Details: ${JSON.stringify(errors)}`);
    }

    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) { // Fix: was any
    const errStr = String(error);
    const errObj = error instanceof Error ? error : new Error(errStr);
    const isQuota = errStr.includes("429") || errStr.includes("Quota");
    console.error(`[Edge Critical]`, error);

    return new Response(JSON.stringify({
      error: errObj.message || errStr,
      isQuota,
      hint: isQuota ? "Límite de Google AI Studio alcanzado." : "Error en múltiples modelos de IA (ver detalles)."
    }), {
      status: isQuota ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
