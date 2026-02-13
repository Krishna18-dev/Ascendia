import { useState, useRef } from "react";
import {
  Briefcase, Info, Loader2, ArrowRight, CheckCircle, Mic, MicOff,
  Volume2, VolumeX, Upload, FileText, Eye, EyeOff, AlertCircle, Star,
  BarChart3, Target
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useSpeechToText, useTextToSpeech } from "@/hooks/useSpeech";

interface Question {
  question: string;
  type: string;
  modelAnswer: string;
}

interface ResumeAnalysis {
  extractedSkills: string[];
  experienceLevel: string;
  strengths: string[];
}

interface InterviewState {
  jobRole: string;
  difficulty: string;
  questions: Question[];
  currentQuestionIndex: number;
  answers: string[];
  feedback: string[];
  isComplete: boolean;
  resumeAnalysis?: ResumeAnalysis;
}

const Interview = () => {
  const [jobRole, setJobRole] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [finalFeedback, setFinalFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking } = useTextToSpeech();
  const { isListening, transcript, isSupported: sttSupported, startListening, stopListening } = useSpeechToText({
    onTranscript: (text) => setCurrentAnswer((prev) => (prev + " " + text).trim()),
  });

  const difficultyLevels = [
    { value: "easy", label: "Easy", description: "5 basic questions", color: "text-green-500" },
    { value: "medium", label: "Medium", description: "6 mixed questions", color: "text-yellow-500" },
    { value: "hard", label: "Hard", description: "7 deep questions", color: "text-red-500" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setResumeError("");
    if (!file) { setResumeFile(null); return; }
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!validTypes.includes(file.type)) {
      setResumeError("Only PDF, DOCX, or TXT files are supported.");
      setResumeFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File must be under 5MB.");
      setResumeFile(null);
      return;
    }
    setResumeFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const startInterview = async () => {
    if (!jobRole.trim()) { toast.error("Please enter a job role"); return; }
    if (!resumeFile) { toast.error("Please upload your resume"); setResumeError("Resume is required"); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in to start"); return; }

      const base64 = await fileToBase64(resumeFile);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "start",
            jobRole,
            difficulty,
            resumeBase64: base64,
            resumeFileType: resumeFile.type,
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
        resumeAnalysis: data.resumeAnalysis,
      });
      setRevealedAnswers(new Set());
      setFinalFeedback(null);
      toast.success("Interview started! Good luck 🎯");

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
    if (!currentAnswer.trim()) { toast.error("Please provide an answer"); return; }
    if (!interview) return;

    setEvaluating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in"); return; }

      const currentQuestion = interview.questions[interview.currentQuestionIndex];
      const isLastQuestion = interview.currentQuestionIndex === interview.questions.length - 1;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "evaluate",
            conversationHistory: [
              { role: "user", content: `Question: ${currentQuestion.question}\n\nModel Answer: ${currentQuestion.modelAnswer}\n\nCandidate's Answer: ${currentAnswer}` },
            ],
            ...(isLastQuestion && {
              sessionData: {
                role: interview.jobRole,
                difficulty: interview.difficulty,
                questions: interview.questions.map(q => q.question),
                answers: [...interview.answers, currentAnswer],
              },
            }),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to evaluate answer");
      const data = await response.json();

      const newAnswers = [...interview.answers, currentAnswer];
      const newFeedback = [...interview.feedback, data.feedback];
      const nextIndex = isLastQuestion ? interview.currentQuestionIndex : interview.currentQuestionIndex + 1;

      setInterview({
        ...interview,
        answers: newAnswers,
        feedback: newFeedback,
        currentQuestionIndex: nextIndex,
        isComplete: isLastQuestion,
      });
      setCurrentAnswer("");
      toast.success(isLastQuestion ? "Interview complete! 🎉" : "Answer submitted!");

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

  const generateFinalFeedback = async () => {
    if (!interview) return;
    setLoadingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "final-feedback",
            conversationHistory: {
              role: interview.jobRole,
              difficulty: interview.difficulty,
              questions: interview.questions.map((q, i) => ({
                question: q.question,
                modelAnswer: q.modelAnswer,
                candidateAnswer: interview.answers[i],
                feedback: interview.feedback[i],
              })),
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to generate feedback");
      const data = await response.json();
      setFinalFeedback(data.feedback);
    } catch (error) {
      toast.error("Failed to generate final feedback");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const toggleReveal = (index: number) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const resetInterview = () => {
    stopSpeaking();
    setInterview(null);
    setCurrentAnswer("");
    setRevealedAnswers(new Set());
    setFinalFeedback(null);
    setResumeFile(null);
    setJobRole("");
  };

  // ─── SETUP SCREEN ───
  if (!interview) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <motion.div className="mb-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-2xl bg-primary/10">
                <Briefcase className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">AI Mock Interview</h1>
            <p className="text-muted-foreground">Upload your resume for personalized, role-specific interview questions</p>
          </motion.div>

          <Card className="p-6 md:p-8 space-y-6">
            {/* Job Role */}
            <div className="space-y-2">
              <Label htmlFor="jobRole" className="flex items-center gap-1">
                Job Role / Position <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jobRole"
                placeholder="e.g., Full Stack Developer, Data Scientist"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
              />
            </div>

            {/* Resume Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Upload Resume <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  resumeFile
                    ? "border-primary/50 bg-primary/5"
                    : resumeError
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                {resumeFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{resumeFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(resumeFile.size / 1024).toFixed(1)} KB • Click to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload <span className="font-medium">PDF, DOCX, or TXT</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Max 5MB</p>
                  </div>
                )}
              </div>
              {resumeError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {resumeError}
                </p>
              )}
            </div>

            {/* Difficulty */}
            <div className="space-y-3">
              <Label>Difficulty Level</Label>
              <div className="grid grid-cols-3 gap-3">
                {difficultyLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setDifficulty(level.value as any)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      difficulty === level.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className={`font-semibold text-sm ${difficulty === level.value ? "text-primary" : ""}`}>
                      {level.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-muted/50 border border-border rounded-xl p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold">How it works</p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>• AI analyzes your resume and generates tailored questions</li>
                    <li>• Use 🎙️ mic button to speak your answers</li>
                    <li>• Reveal model answers after answering each question</li>
                    <li>• Get comprehensive feedback at the end</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!jobRole.trim() || !resumeFile || loading}
              onClick={startInterview}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Resume & Generating Questions...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Start Interview
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ─── COMPLETE SCREEN ───
  if (interview.isComplete) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6 md:p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Interview Complete!</h2>
            <p className="text-muted-foreground mb-4">
              {interview.jobRole} • {interview.difficulty} difficulty • {interview.questions.length} questions
            </p>

            {/* Resume Analysis Summary */}
            {interview.resumeAnalysis && (
              <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Resume Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Experience Level</p>
                    <Badge variant="secondary">{interview.resumeAnalysis.experienceLevel}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Key Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {interview.resumeAnalysis.extractedSkills.slice(0, 6).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Strengths</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {interview.resumeAnalysis.strengths.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {!finalFeedback && (
              <Button onClick={generateFinalFeedback} disabled={loadingFeedback} className="mb-6">
                {loadingFeedback ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Final Report...</>
                ) : (
                  <><Star className="mr-2 h-4 w-4" /> Generate Performance Report</>
                )}
              </Button>
            )}

            {finalFeedback && (
              <div className="text-left bg-muted/30 rounded-xl p-6 mb-6">
                <MarkdownRenderer content={finalFeedback} />
              </div>
            )}
          </Card>

          {/* Q&A Review */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Question Review</h3>
            {interview.questions.map((q, index) => (
              <Card key={index} className="p-5 space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">Q{index + 1}</Badge>
                  <p className="font-medium flex-1">{q.question}</p>
                </div>
                <div className="pl-8 space-y-2">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                    <p className="text-sm">{interview.answers[index]}</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                    <p className="text-xs font-medium text-primary mb-1">Model Answer</p>
                    <p className="text-sm">{q.modelAnswer}</p>
                  </div>
                  {interview.feedback[index] && (
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Feedback</p>
                      <MarkdownRenderer content={interview.feedback[index]} className="text-sm" />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-4">
            <Button onClick={resetInterview} variant="outline" className="flex-1">Start New Interview</Button>
            <Button onClick={() => window.print()} className="flex-1">Print Results</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERVIEW IN PROGRESS ───
  const currentQuestion = interview.questions[interview.currentQuestionIndex];
  const progress = ((interview.currentQuestionIndex + 1) / interview.questions.length) * 100;
  const isRevealed = revealedAnswers.has(interview.currentQuestionIndex);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              Question {interview.currentQuestionIndex + 1} of {interview.questions.length}
            </span>
            <span className="text-sm text-muted-foreground">{interview.jobRole}</span>
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
            <Card className="p-6 md:p-8 space-y-5">
              {/* Question */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{currentQuestion.type}</Badge>
                  {ttsSupported && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isSpeaking ? stopSpeaking() : speak(currentQuestion.question)}
                    >
                      {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <h2 className="text-xl font-semibold">{currentQuestion.question}</h2>
              </div>

              {/* Listening indicator */}
              {isListening && transcript && (
                <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm animate-pulse">
                  🎙️ Listening: {transcript}
                </div>
              )}

              {/* Answer input */}
              <div className="space-y-2">
                <Label htmlFor="answer">Your Answer</Label>
                <Textarea
                  id="answer"
                  placeholder="Type your answer or use the mic button to speak..."
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Reveal Model Answer */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleReveal(interview.currentQuestionIndex)}
                  className="gap-2"
                >
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {isRevealed ? "Hide Model Answer" : "Reveal Model Answer"}
                </Button>
                <AnimatePresence>
                  {isRevealed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 bg-primary/5 border border-primary/10 rounded-lg p-4"
                    >
                      <p className="text-xs font-medium text-primary mb-2">Model Answer</p>
                      <p className="text-sm">{currentQuestion.modelAnswer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {sttSupported && (
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    onClick={isListening ? stopListening : startListening}
                    disabled={evaluating}
                  >
                    {isListening ? <><MicOff className="mr-2 h-4 w-4" /> Stop</> : <><Mic className="mr-2 h-4 w-4" /> Speak</>}
                  </Button>
                )}
                <Button
                  onClick={submitAnswer}
                  disabled={evaluating || !currentAnswer.trim()}
                  className="ml-auto"
                >
                  {evaluating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating...</>
                  ) : interview.currentQuestionIndex === interview.questions.length - 1 ? (
                    <><CheckCircle className="mr-2 h-4 w-4" /> Finish Interview</>
                  ) : (
                    <>Next <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Interview;
