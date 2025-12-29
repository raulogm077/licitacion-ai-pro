// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "npm:@google/generative-ai@^0.21.0";

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
    // 2. Parse Body
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
      throw new Error("Server Misconfiguration: GEMINI_API_KEY not set in Supabase Secrets");
    }

    // 5. Dual Model Logic - Pro as Primary (most powerful), Flash as Fallback
    const PRIMARY_MODEL = "gemini-pro-latest";
    const FALLBACK_MODEL = "gemini-flash-latest";

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

      const response = await result.response;
      return response.text();
    };

    let responseText = "";

    try {
      // Try Primary
      responseText = await generate(PRIMARY_MODEL);
    } catch (e: any) {
      console.error(`[Edge Primary Fail] Section: ${sectionKey}, Error: ${e.message}`);

      // Check for quota or other retryable errors
      const errStr = String(e);
      if (errStr.includes("429") || errStr.includes("Quota") || errStr.includes("500")) {
        console.warn(`[Edge] Retrying with Fallback (${FALLBACK_MODEL})...`);
        await new Promise(r => setTimeout(r, 1000));
        responseText = await generate(FALLBACK_MODEL);
      } else {
        throw new Error(`Primary Model Error: ${e.message}`);
      }
    }

    // 6. Return Result
    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[Edge Critical Error]`, error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack,
      hint: "Check Supabase Secrets for GEMINI_API_KEY and Ensure API Quota"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
