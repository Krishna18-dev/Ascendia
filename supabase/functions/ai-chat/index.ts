import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestGeminiWithRetry(messages: Array<{ role: string; content: string }>, apiKey: string) {
  const systemPrompt = `You are an AI Study Mentor — a friendly, knowledgeable, and encouraging learning companion. Your role is to help students understand concepts, solve problems, and improve their study skills.

Guidelines:
- Be conversational yet educational
- Break down complex topics into simple explanations
- Use examples, analogies, and real-world connections
- Encourage critical thinking
- Suggest study techniques when appropriate
- Use markdown formatting for better readability
- Include code examples with syntax highlighting when relevant
- Be supportive and motivating`;

  const geminiMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let lastStatus = 500;
  let lastBody = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
        }),
      }
    );

    if (response.ok) {
      return response.json();
    }

    lastStatus = response.status;
    lastBody = await response.text();
    console.error(`Gemini API error attempt ${attempt + 1}:`, response.status, lastBody);

    if (response.status !== 429 || attempt === 2) {
      break;
    }

    await sleep(1200 * (attempt + 1));
  }

  return { errorStatus: lastStatus, errorBody: lastBody };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user ?? null;

    const { messages } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    if (!GEMINI_API_KEY.startsWith("AIza")) {
      throw new Error("Invalid GEMINI_API_KEY format. Keys must start with 'AIza'.");
    }

    const data = await requestGeminiWithRetry(messages, GEMINI_API_KEY);

    if (data?.errorStatus) {
      if (data.errorStatus === 429) {
        return new Response(
          JSON.stringify({ error: "The AI service is busy right now. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Gemini API error: ${data.errorStatus}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("No content generated from Gemini API");

    if (user) {
      await supabaseClient.rpc('upsert_daily_stats', { p_user_id: user.id, p_study_minutes: 5, p_courses: 0 });
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
