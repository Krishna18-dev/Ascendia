import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, currentLevel, timeframe } = await req.json();
    console.log("Generating roadmap for:", { goal, currentLevel, timeframe });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert learning advisor who creates personalized, structured learning roadmaps. 
Create a detailed ${timeframe}-month learning roadmap. Return ONLY valid JSON with this structure:
{
  "title": "Learning Roadmap Title",
  "overview": "Brief overview (2-3 sentences)",
  "totalDuration": "${timeframe} months",
  "milestones": [
    {
      "month": 1,
      "title": "Phase Title",
      "description": "What will be learned",
      "topics": ["Topic 1", "Topic 2"],
      "projects": ["Project 1"],
      "resources": ["Resource 1"],
      "outcome": "What the learner achieves"
    }
  ],
  "weeklySchedule": {
    "hoursPerWeek": 10,
    "breakdown": { "theory": "40%", "practice": "40%", "projects": "20%" }
  },
  "skills": ["Skill 1", "Skill 2"],
  "careerPaths": ["Career 1", "Career 2"]
}`;

    const userPrompt = `Create a ${timeframe}-month learning roadmap for:
Goal: ${goal}
Current Level: ${currentLevel}
Make it practical and tailored to their level. Return ONLY valid JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("Generated roadmap successfully");

    return new Response(
      JSON.stringify({ roadmap: JSON.parse(content) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-roadmap:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
