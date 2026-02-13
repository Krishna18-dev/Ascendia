import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoMetadata(videoId: string, apiKey: string) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
  );
  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;
  const item = data.items[0];
  return {
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    duration: item.contentDetails.duration,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url,
  };
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0') + (parseInt(match[3] || '0') > 0 ? 1 : 0);
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "Unknown";
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    // Try fetching from a public transcript endpoint
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    
    // Extract captions track URL from the page
    const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
    if (!captionMatch) return null;
    
    const captionData = JSON.parse(`[${captionMatch[1]}]`);
    const track = captionData.find((t: any) => t.languageCode === 'en') || captionData[0];
    if (!track?.baseUrl) return null;
    
    const captionRes = await fetch(track.baseUrl + '&fmt=json3');
    const captionJson = await captionRes.json();
    
    if (!captionJson.events) return null;
    
    const segments = captionJson.events
      .filter((e: any) => e.segs)
      .map((e: any) => {
        const time = Math.floor((e.tStartMs || 0) / 1000);
        const mins = Math.floor(time / 60);
        const secs = time % 60;
        const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const text = e.segs.map((s: any) => s.utf8).join('').trim();
        return text ? `[${timestamp}] ${text}` : '';
      })
      .filter(Boolean);
    
    return segments.join('\n');
  } catch (e) {
    console.error('Transcript fetch error:', e);
    return null;
  }
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

    const { url, includeExecutionPlan, saveToLibrary } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL. Please provide a valid YouTube video link." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch metadata
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    let metadata: any = null;
    if (YOUTUBE_API_KEY) {
      metadata = await fetchVideoMetadata(videoId, YOUTUBE_API_KEY);
    }
    
    if (!metadata) {
      return new Response(JSON.stringify({ error: "Could not fetch video information. The video may be private or unavailable." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check duration limit (2 hours)
    const durationMinutes = parseDuration(metadata.duration);
    if (durationMinutes > 120) {
      return new Response(JSON.stringify({ error: "Video is too long (over 2 hours). Please choose a shorter video." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch transcript
    const transcript = await fetchTranscript(videoId);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const videoContext = transcript 
      ? `Video Transcript:\n${transcript}`
      : `Video Description (no transcript available):\n${metadata.description}`;

    let systemPrompt = `You are an expert note-taking assistant that generates comprehensive, structured study notes from YouTube videos. Your notes must be detailed, actionable, and formatted in clean Markdown.`;

    let userPrompt = `Generate structured notes for this YouTube video:

**Title:** ${metadata.title}
**Channel:** ${metadata.channel}
**Duration:** ${formatDuration(metadata.duration)}

${videoContext}

Format the output EXACTLY like this structure:

# 📌 ${metadata.title}
**${metadata.channel}** | ${formatDuration(metadata.duration)}

## 🔹 Quick Summary
Write a concise 2-3 sentence summary of the video content.

## 🧠 Key Concepts
- List the main concepts/ideas covered
- Each as a bullet point with brief explanation

## 📝 Detailed Notes
Break down the content section by section with detailed explanations. Use subheadings for each major topic.

## 💻 Code Examples
(If the video is technical, include relevant code snippets with proper syntax highlighting. If not technical, write "No code examples in this video.")

## ⏱ Important Timestamps
List key moments with timestamps in format:
- **00:02:15** – Topic Name
- **00:05:30** – Another Topic

## ✅ Action Plan
Create a step-by-step executable plan on how to apply what was learned:
1. Step one
2. Step two
3. etc.`;

    if (includeExecutionPlan) {
      userPrompt += `

Additionally, generate a detailed execution plan:

## 🎯 Goal Breakdown
Break the learning objectives into measurable goals.

## 📅 7-Day Learning Plan
Day-by-day plan to master the content.

## 🛠 Required Tools
List all tools, software, or resources needed.

## 📚 Recommended Practice Tasks
Specific exercises to practice what was learned.

## 🔁 Revision Strategy
How to review and retain the knowledge.

## 🧪 Mini Project Suggestion
A small project to apply the knowledge practically.

## 📊 Self-Evaluation Checklist
- [ ] Checklist items to verify understanding
- [ ] Include specific knowledge checks`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content generated");

    // Save to library if requested
    if (saveToLibrary && user) {
      await supabaseClient.from('saved_content').insert({
        user_id: user.id,
        content_type: 'video-notes',
        topic: metadata.title,
        content,
        metadata: { videoId, channel: metadata.channel, duration: metadata.duration, url, includeExecutionPlan }
      });
    }

    // Update study stats
    if (user) {
      await supabaseClient.rpc('upsert_daily_stats', {
        p_user_id: user.id,
        p_study_minutes: Math.max(5, Math.floor(durationMinutes / 4)),
        p_courses: 0
      });
    }

    return new Response(JSON.stringify({
      content,
      metadata: {
        title: metadata.title,
        channel: metadata.channel,
        duration: formatDuration(metadata.duration),
        thumbnail: metadata.thumbnail,
        videoId,
        hasTranscript: !!transcript,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in youtube-notes:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
