import { useState } from "react";
import { FileText, Map, Calendar, Layers, HelpCircle, FileSearch, Loader2, Download, Copy, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const contentTypes = [
  {
    id: "lecture-notes",
    icon: FileText,
    title: "Lecture Notes",
    description: "Generate comprehensive study notes",
    color: "text-primary",
  },
  {
    id: "roadmap",
    icon: Map,
    title: "Learning Roadmap",
    description: "Create a structured learning path",
    color: "text-success",
  },
  {
    id: "timetable",
    icon: Calendar,
    title: "Study Timetable",
    description: "Build a personalized study schedule",
    color: "text-accent",
  },
  {
    id: "project",
    icon: Layers,
    title: "Project Outline",
    description: "Plan your project structure",
    color: "text-primary",
  },
  {
    id: "mcqs",
    icon: HelpCircle,
    title: "Practice MCQs",
    description: "Generate practice questions",
    color: "text-success",
  },
  {
    id: "research",
    icon: FileSearch,
    title: "Research Paper",
    description: "Outline and structure your paper",
    color: "text-accent",
  },
];

const ContentGenerator = () => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { contentType: selectedType, topic, details, saveToLibrary },
      });

      if (error) throw error;

      setGeneratedContent(data.content);
      toast.success(saveToLibrary ? "Content generated and saved to library!" : "Content generated successfully!");
    } catch (error: any) {
      console.error("Error generating content:", error);
      
      // Check if it's an authentication error
      if (error.message?.includes("Unauthorized") || error.message?.includes("401")) {
        toast.error("Your session has expired. Please sign in again.");
        setTimeout(() => {
          window.location.href = "/auth";
        }, 2000);
      } else {
        toast.error(error.message || "Failed to generate content");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  const selectedContentType = contentTypes.find((t) => t.id === selectedType);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold mb-2">Content Generator</h1>
          <p className="text-muted-foreground">Choose what type of content you'd like to generate</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contentTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
                onClick={() => setSelectedType(type.id)}
              >
                <CardHeader>
                  <div className="mb-4">
                    <type.icon className={`h-12 w-12 ${type.color}`} />
                  </div>
                  <CardTitle className="text-xl">{type.title}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        <Dialog open={!!selectedType} onOpenChange={() => setSelectedType(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedContentType && <selectedContentType.icon className="h-5 w-5" />}
                Generate {selectedContentType?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedContentType?.description}
              </DialogDescription>
            </DialogHeader>

            {!generatedContent ? (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Subject *</Label>
                  <Input
                    id="topic"
                    placeholder="e.g., React Hooks, Machine Learning, Project Management"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">Additional Details (Optional)</Label>
                  <Textarea
                    id="details"
                    placeholder="Add any specific requirements, focus areas, or context..."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saveToLibrary"
                    checked={saveToLibrary}
                    onCheckedChange={(checked) => setSaveToLibrary(checked as boolean)}
                  />
                  <label
                    htmlFor="saveToLibrary"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Save to my library for later access
                  </label>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Content"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGeneratedContent("");
                      setTopic("");
                      setDetails("");
                    }}
                    className="ml-auto"
                  >
                    Generate New
                  </Button>
                </div>

                <div className="bg-muted p-6 rounded-lg max-h-[500px] overflow-y-auto">
                  <MarkdownRenderer content={generatedContent} className="text-sm" />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ContentGenerator;
