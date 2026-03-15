import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const bodyText = await req.text();
    if (!bodyText) {
       throw new Error("Request body is empty");
    }

    const { thread_id, assistant_id, content } = JSON.parse(bodyText);

    if (!thread_id || !assistant_id || !content) {
      throw new Error("Missing required parameters: thread_id, assistant_id, content");
    }

    // Initialize streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Send heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
        writer.write(encoder.encode(`data: {"type": "heartbeat", "timestamp": ${Date.now()}}\n\n`));
    }, 15000);

    const cleanup = () => {
        clearInterval(heartbeatInterval);
        try {
            writer.close();
        } catch (e) {
            // ignore
        }
    };

    // Add user message to the thread
    await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: content,
    });

    // Run the agent and stream events
    const runStream = openai.beta.threads.runs.stream(thread_id, {
        assistant_id: assistant_id,
        // Enforce file_search behavior for Q&A
        instructions: "Please answer the user's question using only information found in the provided document (vector store). If the answer is not in the document, say 'No encontré información sobre eso en el pliego.'",
    });

    runStream.on("textDelta", (textDelta) => {
        if (textDelta.value) {
            writer.write(encoder.encode(`data: {"type": "agent_message", "content": ${JSON.stringify(textDelta.value)}}\n\n`));
        }
    });

    runStream.on("messageDone", (message) => {
        // Find text content
        const textContent = message.content.find((c) => c.type === "text");
        if (textContent && textContent.type === 'text') {
             writer.write(encoder.encode(`data: {"type": "complete", "message": ${JSON.stringify(textContent.text.value)}}\n\n`));
        }
    });

    runStream.on("end", () => {
        cleanup();
    });

    runStream.on("error", (error) => {
        writer.write(encoder.encode(`data: {"type": "error", "message": ${JSON.stringify((error as Error).message)}}\n\n`));
        cleanup();
    });

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

  } catch (error: unknown) {
    console.error("Error en chat-with-document:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
