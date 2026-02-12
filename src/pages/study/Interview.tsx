import { useState } from "react";
import { Briefcase, Info, Loader2, ArrowRight, CheckCircle, ThumbsUp, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useSpeechToText, useTextToSpeech } from "@/hooks/useSpeech";

interface Question {
  question: string;
  type: string;
  hints: string[];
}

interface InterviewState {
  jobRole: string;
  difficulty: string;
  questions: Question[];
  currentQuestionIndex: number;
  answers: string[];
  feedback: string[];
  isComplete: boolean;
}

const Interview = () => {
  const [jobRole, setJobRole] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const { isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking } = useTextToSpeech();
  const { isListening, transcript, isSupported: sttSupported, startListening, stopListening } = useSpeechToText({
    onTranscript: (text) => setCurrentAnswer((prev) => (prev + " " + text).trim()),
  });

  const difficultyLevels = [
    { value: "easy", label: "Easy", description: "5 basic questions" },
    { value: "medium", label: "Medium", description: "6 standard questions" },
    { value: "hard", label: "Hard", description: "7 challenging questions" },
  ];

  const startInterview = async () => {
    if (!jobRole.trim()) {
      toast.error("Please enter a job role");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to start the interview");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "start",
            jobRole,
            difficulty,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start interview");
      }

      const data = await response.json();
      const questions = Array.isArray(data.questions) ? data.questions : [];
      setInterview({
        jobRole,
        difficulty,
        questions,
        currentQuestionIndex: 0,
        answers: [],
        feedback: [],
        isComplete: false,
      });
      toast.success("Interview started!");

      // Read first question aloud
      if (ttsSupported && questions.length > 0) {
        speak(questions[0].question);
      }
    } catch (error) {
      console.error("Error starting interview:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start interview");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    if (!interview) return;

    setEvaluating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to continue");
        return;
      }

      const currentQuestion = interview.questions[interview.currentQuestionIndex];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "evaluate",
            conversationHistory: [
              { role: "user", content: `Question: ${currentQuestion.question}\n\nCandidate's Answer: ${currentAnswer}` },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to evaluate answer");
      }

      const data = await response.json();
      
      const newAnswers = [...interview.answers, currentAnswer];
      const newFeedback = [...interview.feedback, data.feedback];
      const isLastQuestion = interview.currentQuestionIndex === interview.questions.length - 1;

      const nextIndex = isLastQuestion ? interview.currentQuestionIndex : interview.currentQuestionIndex + 1;

      setInterview({
        ...interview,
        answers: newAnswers,
        feedback: newFeedback,
        currentQuestionIndex: nextIndex,
        isComplete: isLastQuestion,
      });
      
      setCurrentAnswer("");
      setShowHints(false);
      toast.success(isLastQuestion ? "Interview complete!" : "Answer submitted!");

      // Read next question aloud
      if (!isLastQuestion && ttsSupported) {
        speak(interview.questions[nextIndex].question);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to evaluate answer");
    } finally {
      setEvaluating(false);
    }
  };

  const resetInterview = () => {
    stopSpeaking();
    setInterview(null);
    setCurrentAnswer("");
    setShowHints(false);
    setJobRole("");
  };

  if (!interview) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-center mb-4">
              <Briefcase className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Mock Interview</h1>
            <p className="text-muted-foreground">Practice your interview skills with AI-generated questions</p>
          </motion.div>

          <Card className="p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="jobRole">Job Role / Position *</Label>
                <Input
                  id="jobRole"
                  placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Difficulty Level</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {difficultyLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setDifficulty(level.value as any)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        difficulty === level.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-center">
                        <p className="font-semibold mb-1">{level.label}</p>
                        <p className="text-sm text-muted-foreground">{level.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">Interview Tips:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Take your time to think before answering</li>
                      <li>• Use specific examples from your experience</li>
                      <li>• Structure answers using the STAR method</li>
                      <li>• Use the 🎙️ mic button to speak your answers</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={!jobRole.trim() || loading}
                onClick={startInterview}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing Interview...
                  </>
                ) : (
                  <>
                    <span className="mr-2">▶</span>
                    Start Interview
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (interview.isComplete) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-6" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-4">Interview Complete!</h2>
            <p className="text-muted-foreground mb-8">
              Great job completing the mock interview for {interview.jobRole}
            </p>

            <div className="space-y-6 text-left">
              {interview.questions.map((q, index) => (
                <Card key={index} className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-primary">Q{index + 1}:</span>
                      <p className="flex-1">{q.question}</p>
                    </div>
                    <div className="pl-6 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>Your Answer:</strong> {interview.answers[index]}
                      </p>
                      <div className="bg-muted p-4 rounded-lg">
                        <MarkdownRenderer content={interview.feedback[index] || ""} className="text-sm" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <Button onClick={resetInterview} variant="outline" className="flex-1">
                Start New Interview
              </Button>
              <Button onClick={() => window.print()} className="flex-1">
                Print Results
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = interview.questions[interview.currentQuestionIndex];
  const progress = ((interview.currentQuestionIndex + 1) / interview.questions.length) * 100;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              Question {interview.currentQuestionIndex + 1} of {interview.questions.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {interview.jobRole} - {interview.difficulty}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={interview.currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {currentQuestion.type}
                    </span>
                    {ttsSupported && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => isSpeaking ? stopSpeaking() : speak(currentQuestion.question)}
                        title={isSpeaking ? "Stop reading" : "Read question aloud"}
                      >
                        {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold mb-4">{currentQuestion.question}</h2>
                </div>

                {showHints && currentQuestion.hints.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-primary/5 border border-primary/20 rounded-lg p-4"
                  >
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      Helpful Hints:
                    </p>
                    <ul className="space-y-1 text-sm">
                      {currentQuestion.hints.map((hint, i) => (
                        <li key={i} className="text-muted-foreground">• {hint}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {isListening && transcript && (
                  <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-muted-foreground animate-pulse">
                    🎙️ Listening: {transcript}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="answer">Your Answer</Label>
                  <Textarea
                    id="answer"
                    placeholder="Type your answer or use the mic button to speak..."
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    rows={8}
                  />
                </div>

                <div className="flex gap-3">
                  {sttSupported && (
                    <Button
                      variant={isListening ? "destructive" : "outline"}
                      onClick={isListening ? stopListening : startListening}
                      disabled={evaluating}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="mr-2 h-4 w-4" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Speak Answer
                        </>
                      )}
                    </Button>
                  )}
                  {!showHints && (
                    <Button
                      variant="outline"
                      onClick={() => setShowHints(true)}
                    >
                      Show Hints
                    </Button>
                  )}
                  <Button
                    onClick={submitAnswer}
                    disabled={evaluating || !currentAnswer.trim()}
                    className="ml-auto"
                  >
                    {evaluating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Interview;
