'use client';

import React from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  AlertCircle, 
  Globe, 
  Trash2, 
  Plus, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { useSpeechRecognition } from '@/lib/use-speech-recognition';

interface VoiceDictationBarProps {
  onAppendText: (text: string) => void;
  onReplaceText?: (text: string) => void;
  currentText?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  targetFieldName?: string;
}

export default function VoiceDictationBar({
  onAppendText,
  onReplaceText,
  currentText = '',
  placeholder = 'กดไมโครโฟนแล้วเริ่มพูดบรรยายรายละเอียดทรัพย์...',
  className = '',
  compact = false,
  targetFieldName = 'คำอธิบายทรัพย์',
}: VoiceDictationBarProps) {
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    errorMessage,
    language,
    toggleListening,
    resetTranscript,
    setLanguage,
  } = useSpeechRecognition({
    lang: 'th-TH',
    continuous: true,
    interimResults: true,
    onFinalText: (finalSegment) => {
      if (finalSegment.trim()) {
        onAppendText(finalSegment.trim());
      }
    },
  });

  if (!isSupported) {
    return null; // Gracefully hide or show subtle unsupported note if browser lacks Web Speech API
  }

  return (
    <div className={`rounded-2xl border transition-all ${
      isListening
        ? 'bg-gradient-to-r from-navy-950 via-slate-900 to-navy-950 border-gold-500 shadow-lg shadow-gold-500/10 text-white'
        : 'bg-slate-50/90 hover:bg-slate-100/90 border-slate-200/80 text-slate-700'
    } ${compact ? 'p-2' : 'p-3'} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Mic Button & Status Indicator */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={toggleListening}
            className={`relative flex items-center justify-center rounded-xl transition-all cursor-pointer font-bold ${
              compact ? 'w-8 h-8 text-xs' : 'px-3 py-2 text-xs space-x-2'
            } ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md animate-pulse ring-4 ring-rose-500/30'
                : 'bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 shadow-xs active:scale-95'
            }`}
            title={isListening ? 'กดเพื่อหยุดการพิมพ์ด้วยเสียง' : 'กดเพื่อเริ่มพูดพิมพ์ด้วยเสียง (Hands-free Voice Dictation)'}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 animate-bounce" />
                {!compact && <span>กำลังฟังเสียง... (กดหยุด)</span>}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 stroke-[2.5]" />
                {!compact && <span>🎙️ พิมพ์ด้วยเสียง (Voice Dictate)</span>}
              </>
            )}
          </button>

          {/* Audio Wave Indicator when listening */}
          {isListening && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-white/10 rounded-lg backdrop-blur-xs">
              <span className="w-1 h-3 bg-gold-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-5 bg-gold-300 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-2 bg-gold-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '75ms' }} />
              <span className="text-[11px] font-bold text-gold-300 ml-1">Live Dictating...</span>
            </div>
          )}

          {!isListening && !compact && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              พูดบรรยายลงใน{targetFieldName}ได้ทันที ไม่ต้องพิมพ์มือ
            </span>
          )}
        </div>

        {/* Right: Language switch & quick actions */}
        <div className="flex items-center space-x-1.5 text-xs">
          {/* Language Selector */}
          <div className="inline-flex rounded-lg bg-white/80 border border-slate-200 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setLanguage('th-TH')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                language === 'th-TH'
                  ? 'bg-navy-950 text-gold-400 shadow-2xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              🇹🇭 ไทย
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en-US')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                language === 'en-US'
                  ? 'bg-navy-950 text-gold-400 shadow-2xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              🇺🇸 EN
            </button>
          </div>

          {/* If there is interim transcript or active listening */}
          {transcript && (
            <button
              type="button"
              onClick={resetTranscript}
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
              title="ล้างประวัติเสียงที่พูดรอบนี้"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Interim Transcript Display Bar */}
      {isListening && (
        <div className="mt-2.5 pt-2 border-t border-white/10 text-xs text-slate-200">
          <div className="flex items-start space-x-2">
            <Volume2 className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-400">เสียงที่ระบบกำลังตรวจจับได้แบบเรียลไทม์:</p>
              <p className="font-semibold text-white text-xs mt-0.5 bg-black/30 p-2 rounded-xl border border-white/10 min-h-[32px] flex items-center">
                {interimTranscript ? (
                  <span className="text-gold-300 animate-pulse">{interimTranscript}</span>
                ) : (
                  <span className="text-slate-500 italic">กำลังรอฟังเสียง... พูดได้เลยครับ</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-2 p-2 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center space-x-1.5">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
