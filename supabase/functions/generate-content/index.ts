import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: authData, error: authError } = await supabaseClient.auth.getUser()
    const user = authData?.user ?? null

    if (authError) {
      console.error('Error getting user in generate-content:', authError.message)
    }

    const { contentType, topic, details, saveToLibrary } = await req.json();
    console.log("Generating content:", { contentType, topic, details, saveToLibrary });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompts: Record<string, string> = {
      "lecture-notes": "You are an expert educator creating detailed lecture notes. Structure content with: 1) Introduction/Overview 2) Main Concepts (with definitions and explanations) 3) Key Examples 4) Important Points to Remember 5) Summary. Use clear headings, bullet points, and emphasize core concepts.",
      "roadmap": "You are a learning path designer. Create a step-by-step learning roadmap with: 1) Prerequisites 2) Beginner Level (weeks 1-4) 3) Intermediate Level (weeks 5-8) 4) Advanced Level (weeks 9-12) 5) Resources for each stage 6) Milestones and checkpoints. Format as a progressive journey.",
      "timetable": "You are a study schedule planner. Create a weekly timetable with: 1) Daily study sessions with specific times (e.g., 9:00 AM - 11:00 AM) 2) Topics for each session 3) Break times 4) Review sessions 5) Practice/Exercise time. Format as a realistic weekly schedule with time blocks.",
      "project": "You are a project design expert. Create a hands-on project plan with: 1) Project Goal/Objective 2) Required Tools/Technologies 3) Phase 1: Setup and Basic Structure 4) Phase 2: Core Features 5) Phase 3: Advanced Features 6) Phase 4: Testing and Refinement 7) Expected Outcomes. Focus on practical implementation steps.",
      "mcqs": "You are an assessment creator based on lecture notes. For each MCQ: 1) Start with the TOPIC/CONCEPT being tested 2) Question stem that tests understanding 3) Four options (A, B, C, D) 4) Mark the correct answer clearly 5) Provide detailed explanation 6) Difficulty level (Easy/Medium/Hard). Structure like lecture notes with clear topic headers for each question.",
      "research": "You are an academic research advisor. Create a research paper structure with: 1) Research Question/Thesis 2) Literature Review outline 3) Methodology section 4) Expected Findings/Analysis 5) Discussion points 6) Conclusion 7) Suggested References (at least 5). Format as an academic paper outline.",
    };

    const prompts: Record<string, string> = {
      "lecture-notes": `Create comprehensive lecture notes for teaching "${topic}". Include detailed explanations of all major concepts, provide examples, and highlight key takeaways. ${details ? `Focus on: ${details}` : "Cover all fundamental aspects."}`,
      "roadmap": `Design a complete learning roadmap for mastering "${topic}". Break it down into beginner, intermediate, and advanced stages with specific weekly goals, recommended resources, and practice milestones. ${details ? `Special focus: ${details}` : "Create a 12-week comprehensive plan."}`,
      "timetable": `Create a detailed weekly study timetable for "${topic}". Include specific time slots for each day, topics to cover in each session, break times, and review periods. Make it realistic and balanced. ${details ? `Considerations: ${details}` : "Assume 2-3 hours of daily study time."}`,
      "project": `Design a hands-on project for learning "${topic}". Include clear objectives, required tools, step-by-step implementation phases, and expected deliverables. Make it practical and implementable. ${details ? `Project requirements: ${details}` : "Create an intermediate-level project."}`,
      "mcqs": `Generate 10 MCQ-based practice questions for "${topic}" in lecture note format. For EACH question: 1) Write the TOPIC/CONCEPT as a heading 2) Write the question testing that concept 3) Provide 4 options (A, B, C, D) 4) Clearly mark the correct answer 5) Explain why it's correct in detail 6) Label difficulty (Easy/Medium/Hard). ${details ? `Focus areas: ${details}` : "Cover fundamental to advanced concepts systematically."}`,
      "research": `Create a research paper outline for "${topic}". Include research questions, methodology, expected analysis, and suggested academic references. Structure it as a formal academic paper. ${details ? `Research focus: ${details}` : "Create a comprehensive academic outline."}`,
    };

    const systemPrompt = systemPrompts[contentType] || "You are a helpful educational assistant.";
    const userPrompt = prompts[contentType] || `Create content about: ${topic}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content generated from AI API");
    }
    
    console.log("Content generated successfully");

    // Save to library if requested
    if (saveToLibrary && user) {
      const { error: saveError } = await supabaseClient
        .from('saved_content')
        .insert({
          user_id: user.id,
          content_type: contentType,
          topic,
          content,
          metadata: { details }
        })

      if (saveError) {
        console.error('Error saving content:', saveError)
      } else {
        // Check if this is user's first content - award achievement
        const { count } = await supabaseClient
          .from('saved_content')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (count === 1) {
          const { data: achievement } = await supabaseClient
            .from('achievements')
            .select('id')
            .eq('name', 'Content Creator')
            .maybeSingle()

          if (achievement) {
            await supabaseClient
              .from('user_achievements')
              .insert({ user_id: user.id, achievement_id: achievement.id })
          }
        }
      }
    } else if (saveToLibrary && !user) {
      console.warn('Save to library requested but no authenticated user; skipping save')
    }

    // Update study time statistics (assume 5 minutes per generation)
    if (user) {
      await supabaseClient.rpc('upsert_daily_stats', {
        p_user_id: user.id,
        p_study_minutes: 5,
        p_courses: 0
      })
    }

    return new Response(
      JSON.stringify({ content }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-content function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
