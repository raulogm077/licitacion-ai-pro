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

    // 5. Dual Model Logic - Pro as Primary, Flash as fallback, Lite as last resort
    const MODELS = [
      "gemini-pro-latest",
      "gemini-flash-latest",
      "gemini-2.0-flash-lite"
    ];

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
    let lastError: any = null;

    for (const modelName of MODELS) {
      try {
        responseText = await generate(modelName);
        lastError = null;
        break; // Success!
      } catch (e: any) {
        lastError = e;
        console.error(`[Edge Fail] Model: ${modelName}, Section: ${sectionKey}, Error: ${e.message}`);

        const errStr = String(e);
        if (errStr.includes("429") || errStr.includes("Quota") || errStr.includes("500")) {
          console.warn(`[Edge] Retrying with next model in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        } else {
          throw e; // Non-retryable error
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    // 6. Return Result
    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const isQuota = String(error).includes("429") || String(error).includes("Quota");
    console.error(`[Edge Critical Error]`, error);

    return new Response(JSON.stringify({
      error: error.message,
      isQuota,
      hint: isQuota ? "Google API Quota exceeded. Please wait or use a paid key." : "Check Supabase Secrets or Document Content."
    }), {
      status: isQuota ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
