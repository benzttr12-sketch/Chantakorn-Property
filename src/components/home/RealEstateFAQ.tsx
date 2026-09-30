'use client';

import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  Sparkles, 
  Search, 
  MessageCircle, 
  Lightbulb, 
  CheckCircle2, 
  Send, 
  RefreshCw,
  ShieldCheck,
  Building,
  Landmark,
  FileCheck,
  Scale
} from 'lucide-react';
import type { FAQItem } from '@/lib/faq-types';

const CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด', icon: HelpCircle },
  { id: 'buying', label: 'ซื้อบ้าน & คอนโด', icon: Building },
  { id: 'selling', label: 'ฝากขาย & ค่าโอน', icon: FileCheck },
  { id: 'loans', label: 'สินเชื่อธนาคาร', icon: Landmark },
  { id: 'consignment', label: 'ขายฝาก & จำนอง', icon: Scale },
  { id: 'legal', label: 'โฉนด & กฎหมาย', icon: ShieldCheck },
];

export default function RealEstateFAQ() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshingAi, setRefreshingAi] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [faqError, setFaqError] = useState('');
  const [source, setSource] = useState<string>('curated-expert-database');

  // Custom AI Question State
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [askingAi, setAskingAi] = useState<boolean>(false);
  const [customAnswer, setCustomAnswer] = useState<FAQItem | null>(null);
  const [askError, setAskError] = useState<string>('');

  // Fetch FAQs dynamically
  const fetchFaqs = useCallback(async (cat: string, refreshWithGemini = false) => {
    if (refreshWithGemini) {
      setRefreshingAi(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(apiUrl('/api/ai/faq'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, refreshWithGemini }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'โหลดคำถามไม่สำเร็จ');
      setFaqError('');
      if (data.success && Array.isArray(data.faqs)) {
        setFaqs(data.faqs);
        setSource(data.source || '');
        // Auto-expand first item
        if (data.faqs.length > 0) {
          setExpandedId(prev => prev || data.faqs[0].id);
        }
      }
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : 'เชื่อมต่อ Gemini ไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshingAi(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs(activeCategory, false);
  }, [activeCategory, fetchFaqs]);

  const toggleAccordion = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Handle Asking Custom Real Estate Question to Gemini
  const handleAskCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || askingAi) return;

    setAskingAi(true);
    setAskError('');
    setCustomAnswer(null);

    try {
      const res = await fetch(apiUrl('/api/ai/faq'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customQuestion: customQuestion.trim() }),
      });
      const data = await res.json();
      if (data.success && data.faq) {
        setCustomAnswer(data.faq);
        setCustomQuestion('');
      } else {
        setAskError(data.error || 'ไม่สามารถรับคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      setAskError('เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI');
    } finally {
      setAskingAi(false);
    }
  };

  // Filter FAQs by search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(
      item =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  return (
    <section className="py-20 bg-slate-50 relative overflow-hidden" id="real-estate-faq">
      {/* Background Ambience */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-navy-900/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gold-100/80 border border-gold-300 text-navy-950 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-gold-600 animate-pulse" />
            <span>AI-POWERED REAL ESTATE KNOWLEDGE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-navy-950 tracking-tight leading-tight">
            คำถามที่พบบ่อยเกี่ยวกับอสังหาฯ <br className="hidden sm:inline" />
            <span className="text-gold-600 font-serif italic">หาดใหญ่ – สงขลา</span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
            ไขข้อข้องใจเรื่องการซื้อ ขาย เช่า กู้สินเชื่อบ้าน และการขายฝากถูกต้องตามกฎหมาย 
            ประมวลผลและตอบคำถามเชิงลึกด้วย <strong className="text-navy-950 font-bold">Gemini AI</strong> ร่วมกับข้อมูลมาตรฐานวิชาชีพของ Chantakorn Property
          </p>

          {/* AI Status Badge */}
          <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-slate-500">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">
              ขับเคลื่อนด้วย {source === 'gemini-3.8-flash' ? 'Google Gemini 3.8 Flash (Live Dynamic)' : 'ฐานข้อมูลผู้เชี่ยวชาญ & Gemini AI'}
            </span>
          </div>
        </div>

        {/* Controls Bar: Category Tabs & Gemini Refresh */}
        <div className="space-y-4 mb-8">
          {/* Category Pills */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery('');
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-navy-950 text-gold-400 shadow-md scale-102 border border-navy-900'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 hover:text-navy-950'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-gold-400' : 'text-slate-500'}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input & Dynamic Gemini AI Refresh Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาตามหัวข้อ เช่น โฉนด, กู้บ้าน, ขายฝาก, ม.อ., ค่าโอน..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-navy-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ล้าง
                </button>
              )}
            </div>

            <button
              onClick={() => fetchFaqs(activeCategory, true)}
              disabled={refreshingAi || loading}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-600 hover:to-gold-600 disabled:opacity-70 text-navy-950 text-xs font-bold rounded-xl shadow-xs hover:shadow-md flex items-center justify-center space-x-2 shrink-0 transition-all cursor-pointer"
              title="สืบค้นและสร้างคำถามใหม่แบบสดๆ ด้วย Gemini API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAi ? 'animate-spin' : ''}`} />
              <span>{refreshingAi ? 'กำลังวิเคราะห์ด้วย Gemini...' : 'ดึงคำถามใหม่ด้วย Gemini'}</span>
            </button>
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="max-w-3xl mx-auto space-y-3.5">
          {faqError && <p role="alert" className="text-red-600 p-3">{faqError}</p>}
          {loading && !refreshingAi ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse space-y-2">
                  <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                  <div className="h-3 bg-slate-100 rounded-md w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-navy-950">ไม่พบคำถามที่ตรงกับคำค้นหา &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-500">
                คุณสามารถพิมพ์คำถามนี้ในกล่องด้านล่าง เพื่อให้ Gemini AI ตอบให้คุณได้ทันทีครับ
              </p>
            </div>
          ) : (
            filteredFaqs.map(faq => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                    isExpanded ? 'border-gold-400 ring-1 ring-gold-400/30' : 'border-slate-200/90'
                  }`}
                >
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer focus:outline-none"
                    aria-expanded={isExpanded}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-navy-50 text-navy-900 border border-navy-200">
                          {faq.tag}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-navy-950 leading-snug">
                        {faq.question}
                      </h3>
                    </div>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'bg-gold-50 text-gold-600 rotate-180' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-700 leading-relaxed border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                      <div className="whitespace-pre-line text-slate-800">
                        {faq.answer}
                      </div>

                      {faq.tip && (
                        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-gold-50/60 rounded-xl border border-gold-200 flex items-start space-x-2.5 text-xs text-amber-950">
                          <Lightbulb className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <strong className="font-bold text-gold-900">คำแนะนำจากผู้เชี่ยวชาญ:</strong>{' '}
                            <span>{faq.tip}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Interactive Custom Question Box: Ask Gemini AI */}
        <div className="max-w-3xl mx-auto mt-12 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 rounded-3xl p-6 sm:p-8 text-white border border-gold-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-gold-400 uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span>ถามคำถามอสังหาฯ เฉพาะตัวกับ GEMINI AI</span>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                ยังมีข้อสงสัยเรื่องอื่นเกี่ยวกับอสังหาฯ หาดใหญ่–สงขลา?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                พิมพ์คำถามของคุณได้เลย ระบบ Gemini AI พร้อมตอบคำถามเรื่องข้อกฎหมาย ดอกเบี้ย และทำเลให้อย่างละเอียดทันที
              </p>
            </div>

            <form onSubmit={handleAskCustomQuestion} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={e => setCustomQuestion(e.target.value)}
                  placeholder="เช่น คนต่างชาติสามารถถือกรรมสิทธิ์คอนโดในหาดใหญ่ได้กี่เปอร์เซ็นต์? หรือ ค่ารังวัดที่ดินคิดอย่างไร?"
                  className="w-full pl-4 pr-28 py-3.5 bg-navy-800/90 border border-slate-700 focus:border-gold-400 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-400/40 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={askingAi || !customQuestion.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 disabled:opacity-50 text-navy-950 text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  {askingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังคิด...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>ถาม AI</span>
                    </>
                  )}
                </button>
              </div>

              {askError && (
                <p className="text-xs text-rose-400">{askError}</p>
              )}
            </form>

            {/* Display Custom AI Answer Result */}
            {customAnswer && (
              <div className="mt-4 p-5 bg-navy-800/95 border border-gold-400/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gold-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    คำตอบจาก Gemini AI (Chantakorn Expert Consultant)
                  </span>
                  <span className="text-[10px] text-slate-400 bg-navy-900 px-2 py-0.5 rounded-full border border-slate-700">
                    {customAnswer.tag}
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line border-l-2 border-gold-400 pl-3">
                  {customAnswer.answer}
                </div>

                {customAnswer.tip && (
                  <div className="text-xs text-gold-300 bg-gold-950/40 p-3 rounded-xl border border-gold-500/20 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
                    <span><strong>คำแนะนำเสริม:</strong> {customAnswer.tip}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Direct Help Link */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-white/10 text-slate-300">
              <span>ต้องการปรึกษาเคสเอกสารสิทธิ์เฉพาะตัว หรือพาชมทรัพย์จริง?</span>
              <a
                href="https://lin.ee/NMSe28T3"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
              >
                <MessageCircle className="w-4 h-4 fill-current text-emerald-400" />
                <span>ปรึกษาทีมงานทาง LINE Official (ตอบไว)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
