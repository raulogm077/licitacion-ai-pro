// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "npm:@google/generative-ai@0.1.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // 3. Parse Body
    const { base64Content, prompt, sectionKey } = await req.json();

    if (!base64Content || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields (base64Content, prompt)" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Secure API Key Access (Env Var)
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Server Misconfiguration: GEMINI_API_KEY not set");
    }

    // 5. Dual Model Logic
    const PRIMARY_MODEL = "gemini-2.0-flash-exp";
    const FALLBACK_MODEL = "gemini-1.5-flash";

    const genAI = new GoogleGenerativeAI(apiKey);

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const generate = async (modelName: string) => {
      console.log(`[Edge] Analyzing section '${sectionKey}' using model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
        safetySettings
      });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Content,
            mimeType: "application/pdf",
          },
        },
      ]);
      return result.response;
    };

    let responseText = "";

    try {
      // Try Primary
      const response = await generate(PRIMARY_MODEL);
      responseText = response.text();
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes("429") || errStr.includes("Quota exceeded")) {
        console.warn(`[Edge] rate limit on Primary (${PRIMARY_MODEL}). Switching to Fallback (${FALLBACK_MODEL})...`);

        // Wait 1s and retry with Fallback
        await new Promise(r => setTimeout(r, 1000));
        const responseFallback = await generate(FALLBACK_MODEL);
        responseText = responseFallback.text();
      } else {
        throw e; // Rethrow non-quota errors
      }
    }

    // 6. Return Result
    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[Edge Error]`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
