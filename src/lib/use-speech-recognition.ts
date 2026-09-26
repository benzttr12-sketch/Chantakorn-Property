'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Define SpeechRecognition types for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (finalTranscript: string, interimTranscript: string) => void;
  onFinalText?: (textSegment: string) => void;
}

export function useSpeechRecognition({
  lang = 'th-TH',
  continuous = true,
  interimResults = true,
  onResult,
  onFinalText,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState(lang);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(false);

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as IWindow;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognitionClass));
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const win = window as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage('เบราว์เซอร์นี้ไม่รองรับระบบสั่งการด้วยเสียง (Web Speech API)');
      return;
    }

    setErrorMessage(null);
    isManuallyStoppedRef.current = false;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = currentLang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';

          if (result.isFinal) {
            final += text;
            if (onFinalText) {
              onFinalText(text);
            }
          } else {
            interim += text;
          }
        }

        if (final) {
          setTranscript((prev) => {
            const separator = prev && !prev.endsWith(' ') && !final.startsWith(' ') ? ' ' : '';
            const newTotal = prev + separator + final;
            return newTotal;
          });
        }

        setInterimTranscript(interim);

        if (onResult) {
          onResult(final, interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('กรุณาอนุญาตการใช้งานไมโครโฟนในเบราว์เซอร์เพื่อเริ่มพิมพ์ด้วยเสียง');
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Keep listening or silent
        } else if (event.error === 'network') {
          setErrorMessage('เกิดปัญหาการเชื่อมต่อเครือข่ายสำหรับระบบแปลงเสียงเป็นข้อความ');
          setIsListening(false);
        } else {
          setErrorMessage(`เกิดข้อผิดพลาด: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (!isManuallyStoppedRef.current && continuous) {
          // Restart if continuous and not manually stopped
          try {
            recognition.start();
            return;
          } catch {
            // ignore
          }
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Error starting speech recognition:', err);
      setErrorMessage(err.message || 'ไม่สามารถเปิดระบบรับเสียงได้');
      setIsListening(false);
    }
  }, [continuous, currentLang, interimResults, onFinalText, onResult]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  }, []);

  const changeLanguage = useCallback((newLang: string) => {
    setCurrentLang(newLang);
    if (isListening && recognitionRef.current) {
      stopListening();
      setTimeout(() => {
        startListening();
      }, 200);
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    errorMessage,
    language: currentLang,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setLanguage: changeLanguage,
  };
}
