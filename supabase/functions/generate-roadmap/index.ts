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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert learning advisor who creates personalized, structured learning roadmaps. 
Create a detailed ${timeframe}-month learning roadmap that helps the user achieve their goal.

Format your response as a JSON object with this structure:
{
  "title": "Learning Roadmap Title",
  "overview": "Brief overview of the learning journey (2-3 sentences)",
  "totalDuration": "${timeframe} months",
  "milestones": [
    {
      "month": 1,
      "title": "Phase Title",
      "description": "What will be learned in this phase",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "projects": ["Project 1", "Project 2"],
      "resources": ["Resource recommendation 1", "Resource recommendation 2"],
      "outcome": "What the learner will achieve by the end"
    }
  ],
  "weeklySchedule": {
    "hoursPerWeek": 10,
    "breakdown": {
      "theory": "40%",
      "practice": "40%", 
      "projects": "20%"
    }
  },
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "careerPaths": ["Career option 1", "Career option 2"]
}

Consider the user's current level when creating milestones. Ensure progression is logical and achievable.`;

    const userPrompt = `Create a ${timeframe}-month learning roadmap for:
Goal: ${goal}
Current Level: ${currentLevel}

Make it practical, actionable, and tailored to their current level. Include specific topics, projects, and resources.`;

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
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("Generated roadmap successfully");

    return new Response(
      JSON.stringify({ roadmap: JSON.parse(content) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-roadmap function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
