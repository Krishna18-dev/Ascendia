import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechOptions {
  onTranscript?: (text: string) => void;
  language?: string;
}

export const useSpeechToText = ({ onTranscript, language = "en-US" }: UseSpeechOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interim += t;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        onTranscript?.(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
  }, [language, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isListening, transcript, isSupported, startListening, stopListening };
};

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, isSupported, speak, stop };
};
