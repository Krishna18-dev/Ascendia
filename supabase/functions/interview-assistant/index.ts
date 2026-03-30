import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractTextFromBase64(base64: string, fileType: string): string {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  if (fileType === 'text/plain' || fileType === 'application/pdf') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (fileType === 'application/pdf') {
      return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n')
        .split('\n').filter(line => line.trim().length > 3 && !/^[%\/\[\]<>{}()]+$/.test(line.trim()))
        .join('\n').substring(0, 15000);
    }
    return text.substring(0, 15000);
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000);
}

async function callGemini(systemPrompt: string, userPrompt: string, apiKey: string, jsonMode = false) {
  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    if (response.status === 429) {
      throw { status: 429, message: "Rate limit exceeded. Please try again later." };
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("No content generated from Gemini API");
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) console.error('Auth error:', authError.message);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, jobRole, difficulty, resumeBase64, resumeFileType, conversationHistory, sessionData } = await req.json();
    console.log("Interview assistant:", { action, jobRole, difficulty });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    if (action === "start") {
      let resumeText = "";
      if (resumeBase64 && resumeFileType) {
        resumeText = extractTextFromBase64(resumeBase64, resumeFileType);
      }

      const questionCounts: Record<string, number> = { easy: 5, medium: 6, hard: 7 };
      const numQuestions = questionCounts[difficulty] || 6;

      const systemPrompt = `You are an expert technical interviewer. The candidate has applied for: ${jobRole}

${resumeText ? `Resume:\n${resumeText}\n\nGenerate ${numQuestions} interview questions at ${difficulty} difficulty based on the resume.` : `Generate ${numQuestions} interview questions for ${jobRole} at ${difficulty} difficulty.`}

For each question provide the question, type (technical/behavioral/scenario), and a strong model answer.
${resumeText ? `Also provide resumeAnalysis with extractedSkills, experienceLevel, and strengths.` : ''}

Return JSON:
{
  "questions": [{ "question": "...", "type": "technical|behavioral|scenario", "modelAnswer": "..." }]${resumeText ? `,
  "resumeAnalysis": { "extractedSkills": [], "experienceLevel": "Junior|Mid|Senior", "strengths": [] }` : ''}
}`;

      const content = await callGemini(systemPrompt, `Generate personalized interview questions for ${jobRole} at ${difficulty} level.`, GEMINI_API_KEY, true);

      await supabaseClient.rpc('upsert_daily_stats', { p_user_id: user.id, p_study_minutes: 15, p_courses: 0 });

      return new Response(JSON.stringify(JSON.parse(content)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "evaluate") {
      const systemPrompt = `You are an experienced interviewer providing constructive feedback.
Analyze the candidate's answer and provide:
1. Strengths
2. Areas for improvement
3. A rating from 1-5
4. Specific suggestions
Be encouraging but honest.`;

      const userPrompt = JSON.stringify(conversationHistory);
      const feedback = await callGemini(systemPrompt, userPrompt, GEMINI_API_KEY);

      if (sessionData) {
        const score = Math.floor(Math.random() * 30) + 70;
        const { error: saveError } = await supabaseClient.from('interview_sessions').insert({
          user_id: user.id, role: sessionData.role, difficulty: sessionData.difficulty,
          questions: sessionData.questions, answers: sessionData.answers,
          feedback: { summary: feedback }, score
        });

        if (!saveError) {
          const { count } = await supabaseClient.from('interview_sessions')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id);
          if (count === 1) {
            const { data: achievement } = await supabaseClient.from('achievements')
              .select('id').eq('name', 'Interview Ready').maybeSingle();
            if (achievement) await supabaseClient.from('user_achievements')
              .insert({ user_id: user.id, achievement_id: achievement.id });
          }
          if (count === 5) {
            const { data: achievement } = await supabaseClient.from('achievements')
              .select('id').eq('name', 'Interview Expert').maybeSingle();
            if (achievement) await supabaseClient.from('user_achievements')
              .insert({ user_id: user.id, achievement_id: achievement.id });
          }
        }
      }

      return new Response(JSON.stringify({ feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "final-feedback") {
      const systemPrompt = `You are a senior interview coach providing final feedback in Markdown:
## Overall Performance
## Strengths
## Areas for Improvement
## Topics to Revise
## ATS Score Estimate
## Action Plan
Be specific, encouraging, and actionable.`;

      const feedback = await callGemini(systemPrompt, JSON.stringify(conversationHistory), GEMINI_API_KEY);

      return new Response(JSON.stringify({ feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error?.status === 429) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Error in interview-assistant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
