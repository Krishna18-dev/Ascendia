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
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`);
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
  const h = parseInt(match[1] || '0'), m = parseInt(match[2] || '0'), s = parseInt(match[3] || '0');
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
    if (!captionMatch) return null;
    const captionData = JSON.parse(`[${captionMatch[1]}]`);
    const track = captionData.find((t: any) => t.languageCode === 'en') || captionData[0];
    if (!track?.baseUrl) return null;
    const captionRes = await fetch(track.baseUrl + '&fmt=json3');
    const captionJson = await captionRes.json();
    if (!captionJson.events) return null;
    return captionJson.events
      .filter((e: any) => e.segs)
      .map((e: any) => {
        const time = Math.floor((e.tStartMs || 0) / 1000);
        const mins = Math.floor(time / 60), secs = time % 60;
        const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const text = e.segs.map((s: any) => s.utf8).join('').trim();
        return text ? `[${timestamp}] ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
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
      return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    let metadata: any = null;
    if (YOUTUBE_API_KEY) metadata = await fetchVideoMetadata(videoId, YOUTUBE_API_KEY);
    if (!metadata) {
      return new Response(JSON.stringify({ error: "Could not fetch video information." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const durationMinutes = parseDuration(metadata.duration);
    if (durationMinutes > 120) {
      return new Response(JSON.stringify({ error: "Video is too long (over 2 hours)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transcript = await fetchTranscript(videoId);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const videoContext = transcript ? `Video Transcript:\n${transcript}` : `Video Description:\n${metadata.description}`;

    let userPrompt = `Generate structured notes for this YouTube video:
**Title:** ${metadata.title}
**Channel:** ${metadata.channel}
**Duration:** ${formatDuration(metadata.duration)}

${videoContext}

Format with: Quick Summary, Key Concepts, Detailed Notes, Code Examples (if technical), Important Timestamps, and Action Plan.`;

    if (includeExecutionPlan) {
      userPrompt += `\n\nAlso include: Goal Breakdown, 7-Day Learning Plan, Required Tools, Practice Tasks, Revision Strategy, Mini Project, Self-Evaluation Checklist.`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are an expert note-taking assistant that generates comprehensive, structured study notes from YouTube videos in clean Markdown." }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("No content generated");

    if (saveToLibrary && user) {
      await supabaseClient.from('saved_content').insert({
        user_id: user.id, content_type: 'video-notes', topic: metadata.title, content,
        metadata: { videoId, channel: metadata.channel, duration: metadata.duration, url, includeExecutionPlan }
      });
    }

    if (user) {
      await supabaseClient.rpc('upsert_daily_stats', { p_user_id: user.id, p_study_minutes: Math.max(5, Math.floor(durationMinutes / 4)), p_courses: 0 });
    }

    return new Response(JSON.stringify({
      content,
      metadata: { title: metadata.title, channel: metadata.channel, duration: formatDuration(metadata.duration), thumbnail: metadata.thumbnail, videoId, hasTranscript: !!transcript }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in youtube-notes:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
