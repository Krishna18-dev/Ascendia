import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Lightbulb, Target, Zap, Youtube, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI Study Mentor powered by Gemini. I can help you with project ideas, learning paths, tool recommendations, YouTube learning resources, and any questions you have. What would you like to work on today?",
      suggestions: [
        "Help me choose an AI tool for my project",
        "I need ideas for a school presentation",
        "What should I learn next?",
        "Find YouTube videos about React",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showYouTubeSearch, setShowYouTubeSearch] = useState(false);
  const [youtubeQuery, setYoutubeQuery] = useState("");
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMessage] },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.content,
        suggestions: [
          "Tell me more",
          "What's the next step?",
          "Can you explain that differently?",
        ],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Check if it's an authentication error
      if (error.message?.includes("Unauthorized") || error.message?.includes("401")) {
        toast.error("Your session has expired. Please sign in again.");
        // Redirect to auth page after a short delay
        setTimeout(() => {
          window.location.href = "/auth";
        }, 2000);
      } else {
        toast.error(error.message || "Failed to send message");
      }
      
      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleYouTubeSearch = async () => {
    if (!youtubeQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query: youtubeQuery, maxResults: 6 },
      });

      if (error) throw error;

      setYoutubeVideos(data.videos);
      
      if (data.videos.length === 0) {
        toast.info("No videos found. Try a different search term.");
      } else {
        toast.success(`Found ${data.videos.length} videos`);
      }
    } catch (error: any) {
      console.error("Error searching YouTube:", error);
      toast.error(error.message || "Failed to search YouTube");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.toLowerCase().includes("youtube")) {
      setShowYouTubeSearch(true);
    } else {
      setInput(suggestion);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span>AI Study Mentor • Powered by Gemini</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">
            Your Personal{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              AI Mentor
            </span>
          </h1>
          <p className="text-muted-foreground">
            Get personalized guidance, project ideas, YouTube learning resources, and instant help
          </p>
        </div>

        {/* Chat Container */}
        <Card className="flex flex-col h-[600px] shadow-lg">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === "user"
                      ? "bg-gradient-primary text-white"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <MarkdownRenderer content={message.content} className="text-sm" />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Suggestions */}
                  {message.suggestions && message.role === "assistant" && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium opacity-70">
                        Suggested prompts:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/40"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-muted rounded-2xl p-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/40 p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask me anything... (Shift+Enter for new line)"
                className="min-h-[60px] max-h-[120px] resize-none"
                disabled={isTyping}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                variant="gradient"
                size="icon"
                className="h-[60px] w-[60px] flex-shrink-0"
              >
                {isTyping ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="p-4 hover:shadow-md transition-all cursor-pointer group" onClick={() => setInput("Give me some creative project ideas")}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Get Project Ideas</h3>
                <p className="text-xs text-muted-foreground">
                  Brainstorm creative project concepts
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-all cursor-pointer group" onClick={() => setInput("What should I learn next for my career?")}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-glow/10 group-hover:bg-primary-glow/20 transition-colors">
                <Target className="h-5 w-5 text-primary-glow" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Learning Path</h3>
                <p className="text-xs text-muted-foreground">
                  Get personalized learning recommendations
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-all cursor-pointer group" onClick={() => setShowYouTubeSearch(true)}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <Youtube className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">YouTube Search</h3>
                <p className="text-xs text-muted-foreground">
                  Find educational videos on any topic
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* YouTube Search Section */}
        {showYouTubeSearch && (
          <Card className="mt-8 p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Youtube className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Search YouTube Learning Videos</h2>
            </div>
            
            <div className="flex gap-2 mb-6">
              <Input
                value={youtubeQuery}
                onChange={(e) => setYoutubeQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleYouTubeSearch()}
                placeholder="e.g., React tutorial, Machine Learning basics..."
                disabled={isSearching}
              />
              <Button onClick={handleYouTubeSearch} disabled={isSearching || !youtubeQuery.trim()}>
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {youtubeVideos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {youtubeVideos.map((video) => (
                  <a
                    key={video.id}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group border rounded-lg overflow-hidden hover:shadow-md transition-all"
                  >
                    <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" />
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default Chat;
