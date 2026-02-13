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
    // For PDF: extract readable ASCII text (simplified extraction)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (fileType === 'application/pdf') {
      // Extract text between stream markers and readable content
      const readable = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .split('\n')
        .filter(line => line.trim().length > 3 && !/^[%\/\[\]<>{}()]+$/.test(line.trim()))
        .join('\n')
        .substring(0, 15000);
      return readable;
    }
    return text.substring(0, 15000);
  }

  // For DOCX: extract text from XML content
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const xmlText = text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return xmlText.substring(0, 15000);
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === "start") {
      let resumeText = "";
      if (resumeBase64 && resumeFileType) {
        resumeText = extractTextFromBase64(resumeBase64, resumeFileType);
      }

      const questionCounts: Record<string, number> = { easy: 5, medium: 6, hard: 7 };
      const numQuestions = questionCounts[difficulty] || 6;

      const systemPrompt = `You are an expert technical interviewer.

The candidate has applied for the role: ${jobRole}

${resumeText ? `Here is the candidate's resume text:\n${resumeText}\n\nBased STRICTLY on:
- Skills mentioned in the resume
- Projects listed
- Technologies used
- Experience level
- Education background

Generate ${numQuestions} interview questions at ${difficulty} difficulty.` : `Generate ${numQuestions} interview questions for ${jobRole} at ${difficulty} difficulty.`}

For each question:
- Provide the interview question
- Provide a strong, realistic model answer tailored specifically to the resume content
- Keep answers aligned with candidate experience
- Avoid generic textbook answers
- Make questions practical and scenario-based when possible
- Reference specific technologies, projects, and skills from the resume

${resumeText ? `Also provide a brief resume analysis with:
- extractedSkills: array of key skills found
- experienceLevel: "Junior", "Mid", or "Senior" based on the resume
- strengths: array of 3 key strength areas` : ''}

Return response as JSON with this structure:
{
  "questions": [
    {
      "question": "Question text referencing resume content",
      "type": "technical | behavioral | scenario",
      "modelAnswer": "Strong tailored answer based on resume"
    }
  ]${resumeText ? `,
  "resumeAnalysis": {
    "extractedSkills": ["skill1", "skill2"],
    "experienceLevel": "Junior|Mid|Senior",
    "strengths": ["strength1", "strength2", "strength3"]
  }` : ''}
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate personalized interview questions for ${jobRole} at ${difficulty} level.` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);

      await supabaseClient.rpc('upsert_daily_stats', {
        p_user_id: user.id, p_study_minutes: 15, p_courses: 0
      });

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "evaluate") {
      const systemPrompt = `You are an experienced interviewer providing constructive feedback.
Analyze the candidate's answer and provide:
1. Strengths (what they did well)
2. Areas for improvement
3. A rating from 1-5
4. Specific suggestions for better answers

Be encouraging but honest. Focus on helping them improve.`;

      const messages = [{ role: "system", content: systemPrompt }, ...conversationHistory];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "openai/gpt-5-mini", messages, temperature: 0.7 }),
      });

      if (!response.ok) throw new Error(`AI Gateway error: ${response.status}`);

      const data = await response.json();
      const feedback = data.choices[0].message.content;

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
      const systemPrompt = `You are a senior interview coach providing final interview feedback.

Given the interview questions, the candidate's answers, and per-question feedback, provide a comprehensive final report in Markdown:

## Overall Performance
Brief overall assessment with a score out of 100.

## Strengths
- Key things the candidate did well

## Areas for Improvement
- Specific topics and skills to work on

## Topics to Revise
- Concrete topics the candidate should study

## ATS Score Estimate
Provide a simulated ATS compatibility score (0-100) based on keyword alignment with the role.

## Action Plan
- 3-5 specific next steps to improve

Be specific, encouraging, and actionable.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(conversationHistory) },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`AI Gateway error: ${response.status}`);
      const data = await response.json();

      return new Response(JSON.stringify({ feedback: data.choices[0].message.content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in interview-assistant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
