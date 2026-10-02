'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Copy, 
  Check, 
  Loader2, 
  Wand2, 
  Flame, 
  Crown, 
  Share2, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  FileText,
  RotateCcw,
  Tag,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';
import { PropertyType, PropertyStatus } from '@/lib/types';
import { useSpeechRecognition } from '@/lib/use-speech-recognition';

export interface PropertySpecsForAI {
  title?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  price?: number | string;
  district?: string;
  subdistrict?: string;
  address?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  parking?: number | string;
  landSize?: number | string;
  usableArea?: number | string;
  furniture?: string;
  facingDirection?: string;
  features?: string[];
  landmarks?: string[];
  agentName?: string;
  agentPhone?: string;
  agentLine?: string;
  agentFacebook?: string;
}

interface SmartDescriptionGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  specs: PropertySpecsForAI;
  currentDescription?: string;
  onApplyDescription: (text: string, mode: 'replace' | 'append') => void;
  onApplyTitle?: (title: string) => void;
}

type ToneType = 'luxury' | 'high_converting' | 'social_media' | 'investor';

export default function SmartDescriptionGeneratorModal({
  isOpen,
  onClose,
  specs,
  currentDescription = '',
  onApplyDescription,
  onApplyTitle,
}: SmartDescriptionGeneratorModalProps) {
  const [tone, setTone] = useState<ToneType>('high_converting');
  const [customHighlights, setCustomHighlights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Speech Recognition for Hands-free Voice Dictation
  const {
    isListening: isVoiceListening,
    isSupported: isVoiceSupported,
    interimTranscript: voiceInterimText,
    errorMessage: voiceError,
    language: voiceLang,
    toggleListening: toggleVoiceListening,
    setLanguage: setVoiceLang,
  } = useSpeechRecognition({
    lang: 'th-TH',
    continuous: true,
    interimResults: true,
    onFinalText: (finalSegment) => {
      if (finalSegment.trim()) {
        setCustomHighlights((prev) => {
          const sep = prev && !prev.endsWith(' ') && !prev.endsWith(',') ? ', ' : '';
          return prev + sep + finalSegment.trim();
        });
      }
    },
  });

  // Result state
  const [generatedData, setGeneratedData] = useState<{
    headline?: string;
    description?: string;
    keyPoints?: string[];
    socialCaption?: string;
    hashtags?: string[];
    source?: string;
  } | null>(null);

  const [activeResultTab, setActiveResultTab] = useState<'full' | 'social' | 'keypoints'>('full');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai/generate-property-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...specs,
          tone,
          customHighlights: customHighlights.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถสร้างคำบรรยายได้');
      }

      setGeneratedData(data);
      setActiveResultTab('full');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleApply = (mode: 'replace' | 'append') => {
    if (!generatedData?.description) return;
    onApplyDescription(generatedData.description, mode);
    onClose();
  };

  const handleApplyTitleOnly = () => {
    if (generatedData?.headline && onApplyTitle) {
      onApplyTitle(generatedData.headline);
    }
  };

  const tones: { id: ToneType; label: string; icon: any; desc: string; badge: string }[] = [
    {
      id: 'high_converting',
      label: 'เน้นปิดการขาย (High-Converting)',
      icon: Flame,
      desc: 'กระตุ้นการตัดสินใจ ชูจุดเด่นและความคุ้มค่า ชวนนัดชมทันที',
      badge: 'แนะนำ',
    },
    {
      id: 'luxury',
      label: 'พรีเมียมหรูหรา (Luxury & Exclusive)',
      icon: Crown,
      desc: 'ภาษาไพเราะ สง่างาม เน้นภาพลักษณ์ชีวิตที่ดี และสถาปัตยกรรม',
      badge: 'บ้านหรู/วิลล่า',
    },
    {
      id: 'social_media',
      label: 'โพสต์โซเชียล & LINE (Social Ready)',
      icon: Share2,
      desc: 'อ่านง่ายบนมือถือ มีอิโมจิแบ่งหัวข้อสวยงาม คัดลอกลง Facebook/LINE ได้ทันที',
      badge: 'แชร์ไว',
    },
    {
      id: 'investor',
      label: 'สำหรับนักลงทุน (Investor Yield)',
      icon: TrendingUp,
      desc: 'เน้นกระแสเงินสด ค่าเช่า ใกล้มหาวิทยาลัย/รพ. และโอกาสทำกำไร',
      badge: 'คอนโด/หอพัก',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center text-navy-950 shadow-md">
              <Sparkles className="w-5 h-5 text-navy-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  AI Smart Description Generator
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-400 text-navy-950">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                เขียนคำบรรยายทรัพย์ภาษาไทยระดับมืออาชีพ ดึงดูดสายตา และกระตุ้นยอดขายอัตโนมัติ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Quick Specs Overview Snapshot */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-600 flex flex-wrap items-center gap-y-1.5 gap-x-3">
            <span className="font-bold text-navy-950 flex items-center">
              <FileText className="w-3.5 h-3.5 text-gold-600 mr-1" />
              ข้อมูลสเปกปัจจุบัน:
            </span>
            <span>ทำเล: <strong>{specs.district || 'หาดใหญ่'}</strong></span>
            <span>สถานะ: <strong>{specs.status === 'rent' ? 'ให้เช่า' : 'ขาย'}</strong></span>
            {Number(specs.price) > 0 && (
              <span>ราคา: <strong className="text-gold-700">{Number(specs.price).toLocaleString()} ฿</strong></span>
            )}
            {Number(specs.bedrooms) > 0 && <span>{specs.bedrooms} นอน</span>}
            {Number(specs.bathrooms) > 0 && <span>{specs.bathrooms} น้ำ</span>}
            {Number(specs.landSize) > 0 && <span>{specs.landSize} ตร.ว.</span>}
            {Number(specs.usableArea) > 0 && <span>{specs.usableArea} ตร.ม.</span>}
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-bold text-navy-950 mb-2 flex items-center space-x-1.5">
              <span>1. เลือกโทนการเขียน (Copywriting Tone)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {tones.map((t) => {
                const Icon = t.icon;
                const isSelected = tone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-navy-950 text-white border-navy-950 shadow-md ring-2 ring-gold-400/40'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-gold-400 text-navy-950' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-gold-300' : 'text-navy-950'}`}>
                          {t.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {t.badge}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-1 leading-relaxed ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        {t.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Highlights with Hands-free Voice Dictation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-navy-950 flex items-center space-x-1.5">
                <span>2. จุดเน้นพิเศษเพิ่มเติม (Optional)</span>
              </label>

              {isVoiceSupported && (
                <div className="flex items-center space-x-2">
                  {/* Language switch */}
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setVoiceLang('th-TH')}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        voiceLang === 'th-TH' ? 'bg-navy-950 text-gold-400' : 'text-slate-500 hover:text-navy-950'
                      }`}
                    >
                      🇹🇭 TH
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceLang('en-US')}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        voiceLang === 'en-US' ? 'bg-navy-950 text-gold-400' : 'text-slate-500 hover:text-navy-950'
                      }`}
                    >
                      🇺🇸 EN
                    </button>
                  </div>

                  {/* Mic Dictate Toggle */}
                  <button
                    type="button"
                    onClick={toggleVoiceListening}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      isVoiceListening
                        ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-300'
                        : 'bg-gold-50 hover:bg-gold-100 text-navy-950 border border-gold-300'
                    }`}
                    title="กดแล้วพูดเพื่อเพิ่มจุดเด่นด้วยเสียงอัตโนมัติ"
                  >
                    {isVoiceListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>กำลังฟังเสียง... (กดหยุด)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-gold-700" />
                        <span>🎙️ พูดใส่จุดเด่น (Voice Dictate)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={customHighlights}
                onChange={(e) => setCustomHighlights(e.target.value)}
                placeholder="เช่น บ้านสร้างใหม่มือหนึ่ง, ฟรีค่าโอน, แถมแอร์ 3 เครื่อง, เจ้าของย้ายไปต่างจังหวัด..."
                className={`w-full bg-slate-50 border rounded-xl p-3 text-xs text-navy-950 outline-none focus:bg-white focus:ring-2 focus:ring-gold-500 transition-all ${
                  isVoiceListening ? 'border-rose-400 ring-2 ring-rose-200' : 'border-slate-200'
                }`}
              />
            </div>

            {/* Live Dictation Wave & Interim preview */}
            {isVoiceListening && (
              <div className="mt-2 p-2.5 bg-navy-950 text-white rounded-xl border border-gold-500/40 text-xs flex items-center justify-between space-x-2 animate-fadeIn">
                <div className="flex items-center space-x-2 min-w-0">
                  <Volume2 className="w-4 h-4 text-gold-400 animate-pulse shrink-0" />
                  <span className="text-[11px] text-slate-300">
                    {voiceInterimText ? (
                      <strong className="text-gold-300">{voiceInterimText}</strong>
                    ) : (
                      <span className="italic text-slate-400">กำลังฟังเสียงพูดของคุณ... พูดคำหรือประโยคได้เลย</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-0.5 shrink-0">
                  <span className="w-1 h-3 bg-gold-400 rounded-full animate-pulse" />
                  <span className="w-1 h-5 bg-gold-300 rounded-full animate-pulse" />
                  <span className="w-1 h-2 bg-gold-400 rounded-full animate-pulse" />
                </div>
              </div>
            )}

            {voiceError && (
              <p className="text-[11px] text-rose-600 mt-1">⚠️ {voiceError}</p>
            )}
          </div>

          {/* Generate Button */}
          <div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-gold-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-navy-950" />
                  <span>AI กำลังวิเคราะห์สเปกและร่างคำบรรยายทรัพย์...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-navy-950 stroke-[2.5]" />
                  <span>{generatedData ? '✨ สร้างคำบรรยายใหม่ (Regenerate)' : '✨ ให้ AI ร่างคำบรรยายทันที'}</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Result Preview */}
          {generatedData && (
            <div className="border border-gold-300/80 rounded-2xl overflow-hidden bg-white shadow-sm space-y-4 p-4 sm:p-5">
              {/* Result Header & Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-navy-950">ผลลัพธ์คำบรรยายจาก AI</span>
                  {generatedData.source && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                      {generatedData.source}
                    </span>
                  )}
                </div>

                {/* Sub tabs */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('full')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeResultTab === 'full' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-navy-950'
                    }`}
                  >
                    คำบรรยายเต็ม
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('social')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeResultTab === 'social' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-navy-950'
                    }`}
                  >
                    แคปชันโซเชียล
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('keypoints')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeResultTab === 'keypoints' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-navy-950'
                    }`}
                  >
                    จุดเด่นย่อ
                  </button>
                </div>
              </div>

              {/* Headline Suggestion Bar */}
              {generatedData.headline && (
                <div className="bg-gold-50/70 p-3 rounded-xl border border-gold-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-gold-900 block sm:inline mr-2">📌 พาดหัวแนะนำ:</span>
                    <span className="text-navy-950 font-semibold">{generatedData.headline}</span>
                  </div>
                  {onApplyTitle && (
                    <button
                      type="button"
                      onClick={handleApplyTitleOnly}
                      className="text-[11px] font-bold text-navy-950 hover:text-gold-700 bg-white hover:bg-gold-100 px-2.5 py-1 rounded-lg border border-gold-300 shadow-2xs self-start sm:self-auto transition-colors shrink-0"
                    >
                      ใช้เป็นชื่อประกาศ
                    </button>
                  )}
                </div>
              )}

              {/* Tab 1: Full Description */}
              {activeResultTab === 'full' && (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={10}
                      value={generatedData.description || ''}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-navy-950 leading-relaxed font-sans outline-none resize-none focus:bg-white focus:ring-1 focus:ring-gold-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedData.description || '', 'full')}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 hover:text-navy-950 rounded-lg border border-slate-200 shadow-xs text-[11px] font-bold flex items-center space-x-1"
                    >
                      {copiedTab === 'full' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Apply Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {currentDescription.trim() && (
                      <button
                        type="button"
                        onClick={() => handleApply('append')}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
                      >
                        แทรกต่อท้ายข้อความเดิม
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApply('replace')}
                      className="px-5 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black rounded-xl shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-gold-400" />
                      <span>นำไปใส่ในช่องคำอธิบายทันที</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Social Caption */}
              {activeResultTab === 'social' && (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={8}
                      value={generatedData.socialCaption || ''}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-navy-950 leading-relaxed font-sans outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedData.socialCaption || '', 'social')}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 hover:text-navy-950 rounded-lg border border-slate-200 shadow-xs text-[11px] font-bold flex items-center space-x-1"
                    >
                      {copiedTab === 'social' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอกโพสต์</span>
                        </>
                      )}
                    </button>
                  </div>

                  {generatedData.hashtags && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {generatedData.hashtags.map((h, i) => (
                        <span key={i} className="text-gold-700 bg-gold-50 px-2 py-0.5 rounded-md font-mono text-[11px]">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Key Points */}
              {activeResultTab === 'keypoints' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    {generatedData.keyPoints?.map((kp, i) => (
                      <div key={i} className="flex items-start space-x-2 text-xs text-navy-950 font-medium">
                        <span className="text-gold-600 font-bold">•</span>
                        <span>{kp}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedData.keyPoints?.join('\n') || '', 'keypoints')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1 ml-auto"
                  >
                    {copiedTab === 'keypoints' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>คัดลอกสรุปจุดเด่น</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>คำบรรยายถูกปรับแต่งให้เข้ากับบริบทหาดใหญ่–สงขลา พร้อมช่องทางติดต่อถูกต้อง</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
