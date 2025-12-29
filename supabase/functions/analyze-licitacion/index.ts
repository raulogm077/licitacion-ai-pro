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

    // Try these models in order. 
    // Pro is most restricted, Flash has higher RPM.
    const MODELS = [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b"
    ];

    const genAI = new GoogleGenerativeAI(apiKey);

    const generate = async (modelName: string) => {
      console.log(`[Edge] Requesting '${sectionKey}' using ${modelName}`);
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
    let lastErr: any = null;

    for (const m of MODELS) {
      try {
        responseText = await generate(m);
        lastErr = null;
        break;
      } catch (e: any) {
        lastErr = e;
        const errStr = String(e);
        console.error(`[Edge Fail] ${m}: ${e.message}`);

        // Wait and try next if it's a server or rate error
        if (errStr.includes("429") || errStr.includes("Quota") || errStr.includes("500")) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        } else {
          throw e;
        }
      }
    }

    if (lastErr) throw lastErr;

    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errStr = String(error);
    const isQuota = errStr.includes("429") || errStr.includes("Quota");
    console.error(`[Edge Critical]`, error);

    return new Response(JSON.stringify({
      error: error.message || errStr,
      isQuota,
      hint: isQuota ? "Límite de Google AI Studio alcanzado. Verifica tu cuota diaria en AI Studio o usa una clave con facturación habilitada." : "Error inesperado en el servidor."
    }), {
      status: isQuota ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
