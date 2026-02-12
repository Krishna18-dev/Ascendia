import { useState, useRef } from "react";
import { Youtube, Loader2, Copy, Check, Download, Save, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { motion, AnimatePresence } from "framer-motion";

const PROGRESS_STEPS = [
  "Validating URL…",
  "Fetching video info…",
  "Extracting transcript…",
  "Cleaning data…",
  "Generating notes with AI…",
];

const VideoNotes = () => {
  const [url, setUrl] = useState("");
  const [includeExecutionPlan, setIncludeExecutionPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [notes, setNotes] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const isValidYouTubeUrl = (input: string) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.test(input);
  };

  const generateNotes = async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL.");
      return;
    }
    if (!isValidYouTubeUrl(url)) {
      setError("Invalid YouTube URL. Please paste a valid link (e.g. https://youtube.com/watch?v=...)");
      return;
    }

    setError(null);
    setNotes(null);
    setMetadata(null);
    setIsLoading(true);
    setProgressStep(0);

    // Simulate progress steps
    const interval = setInterval(() => {
      setProgressStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("youtube-notes", {
        body: { url, includeExecutionPlan, saveToLibrary: false },
      });

      clearInterval(interval);

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setNotes(data.content);
      setMetadata(data.metadata);
      setTimeout(() => notesRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      setError(err.message || "Failed to generate notes. Please try again.");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setProgressStep(0);
    }
  };

  const handleCopy = () => {
    if (!notes) return;
    navigator.clipboard.writeText(notes);
    setCopied(true);
    toast({ title: "Copied!", description: "Notes copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!notes) return;
    const blob = new Blob([notes], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${metadata?.title || "video-notes"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: "Downloaded!", description: "Notes saved as Markdown file." });
  };

  const handleSave = async () => {
    if (!notes || !user) {
      toast({ title: "Sign in required", description: "Please sign in to save notes.", variant: "destructive" });
      return;
    }
    try {
      const { error: saveError } = await supabase.from("saved_content").insert({
        user_id: user.id,
        content_type: "video-notes",
        topic: metadata?.title || "YouTube Video Notes",
        content: notes,
        metadata: { videoId: metadata?.videoId, channel: metadata?.channel, url },
      });
      if (saveError) throw saveError;
      toast({ title: "Saved!", description: "Notes saved to your library." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Youtube className="h-8 w-8 text-destructive" />
          Video Notes Generator
        </h1>
        <p className="text-muted-foreground">
          Paste a YouTube link and get AI-generated structured study notes instantly.
        </p>
      </motion.div>

      {/* Input Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); }}
                className="flex-1 h-12"
                disabled={isLoading}
              />
              <Button onClick={generateNotes} disabled={isLoading} size="lg" className="shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {isLoading ? "Generating…" : "Generate Notes"}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="execution-plan"
                checked={includeExecutionPlan}
                onCheckedChange={setIncludeExecutionPlan}
                disabled={isLoading}
              />
              <Label htmlFor="execution-plan" className="text-sm cursor-pointer">
                Generate Execution Plan (7-day plan, practice tasks, mini project, etc.)
              </Label>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress Steps */}
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {PROGRESS_STEPS.map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 text-sm transition-colors ${
                        i < progressStep ? "text-primary" : i === progressStep ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {i < progressStep ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : i === progressStep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-30" />
                      )}
                      <span>{step}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Metadata */}
      {metadata && !isLoading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              {metadata.thumbnail && (
                <div className="sm:w-64 shrink-0">
                  <img src={metadata.thumbnail} alt={metadata.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 space-y-1">
                <h3 className="font-semibold text-lg">{metadata.title}</h3>
                <p className="text-sm text-muted-foreground">{metadata.channel} • {metadata.duration}</p>
                {!metadata.hasTranscript && (
                  <p className="text-xs text-destructive/80">⚠ No transcript available – notes were generated from the video description.</p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Notes Output */}
      {notes && !isLoading && (
        <motion.div ref={notesRef} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Generated Notes</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                {user && (
                  <Button variant="outline" size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={notes} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default VideoNotes;
