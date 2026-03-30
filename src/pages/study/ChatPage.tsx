import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Mic, MicOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useSpeechToText } from "@/hooks/useSpeech";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI Study Companion. Ask me anything about your studies, career prep, or learning goals. I can help with study notes, roadmaps, practice questions, and interview prep!",
    },
  ]);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isListening, transcript, isSupported: sttSupported, startListening, stopListening } = useSpeechToText({
    onTranscript: (text) => setMessage((prev) => (prev + " " + text).trim()),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isTyping) return;

    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMessage] },
      });

      if (error) {
        const errorMessage = error.message || "Failed to send message";
        const isRateLimited = errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit");

        toast.error(
          isRateLimited
            ? "The AI is busy right now. Please wait a few seconds and try again."
            : errorMessage
        );

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: isRateLimited
              ? "The AI service is busy right now, so I couldn’t answer that yet. Please wait a few seconds and send your message again."
              : "I apologize, but I encountered an error. Please try again.",
          },
        ]);
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage = error?.message || "Failed to send message";
      const isRateLimited = errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit");

      toast.error(
        isRateLimited
          ? "The AI is busy right now. Please wait a few seconds and try again."
          : errorMessage
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isRateLimited
            ? "The AI service is busy right now, so I couldn’t answer that yet. Please wait a few seconds and send your message again."
            : "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestedQuestions = [
    "Create study notes for Python basics",
    "Generate a 3-month learning roadmap for web development",
    "Give me 10 practice MCQs on JavaScript",
    "Help me prepare for a software engineer interview",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-xl font-semibold">AI Study Companion</h1>
          </div>
          <p className="text-sm opacity-90">
            AI-Powered • Ask me anything about your studies, career prep, or learning goals
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              } animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === "user"
                    ? "bg-gradient-primary text-white"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} className="text-sm" />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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

          {messages.length === 1 && !isTyping && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(question)}
                  className="text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t bg-background">
        <div className="max-w-4xl mx-auto p-4">
          {isListening && transcript && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-muted-foreground animate-pulse">
              🎙️ {transcript}
            </div>
          )}
          <div className="flex gap-2">
            {sttSupported && (
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={isListening ? stopListening : startListening}
                disabled={isTyping}
                title={isListening ? "Stop recording" : "Start recording"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isTyping && handleSend()}
              placeholder="Ask me anything about your studies..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button onClick={handleSend} disabled={!message.trim() || isTyping}>
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
