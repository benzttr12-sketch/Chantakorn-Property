'use client';

import React, { useMemo, useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  Search, 
  MessageCircle, 
  Lightbulb, 
  ShieldCheck,
  Building,
  Landmark,
  FileCheck,
  Scale
} from 'lucide-react';
import { CURATED_FAQS } from '@/lib/faq-data';
import type { FAQCategory } from '@/lib/faq-types';

const CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด', icon: HelpCircle },
  { id: 'buying', label: 'ซื้อบ้าน & คอนโด', icon: Building },
  { id: 'selling', label: 'ฝากขาย & ค่าโอน', icon: FileCheck },
  { id: 'loans', label: 'สินเชื่อธนาคาร', icon: Landmark },
  { id: 'consignment', label: 'ขายฝาก & จำนอง', icon: Scale },
  { id: 'legal', label: 'โฉนด & กฎหมาย', icon: ShieldCheck },
] as const;

export default function RealEstateFAQ() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(CURATED_FAQS[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return CURATED_FAQS.filter(item =>
      (activeCategory === 'all' || item.category === activeCategory) &&
      (!query || [item.question, item.answer, item.tag].some(value => value.toLowerCase().includes(query)))
    );
  }, [activeCategory, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedId(previous => previous === id ? null : id);
  };

  return (
    <section className="py-20 bg-slate-50 relative overflow-hidden" id="real-estate-faq">
      {/* Background Ambience */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-navy-900/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gold-100/80 border border-gold-300 text-navy-950 text-xs font-bold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5 text-gold-600" />
            <span>สาระน่ารู้เรื่องอสังหาริมทรัพย์</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-navy-950 tracking-tight leading-tight">
            คำถามที่พบบ่อยเกี่ยวกับอสังหาฯ <br className="hidden sm:inline" />
            <span className="text-gold-600 font-serif italic">หาดใหญ่ – สงขลา</span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
            ไขข้อข้องใจเรื่องการซื้อ ขาย เช่า กู้สินเชื่อบ้าน และการขายฝากถูกต้องตามกฎหมาย 
            รวบรวมคำถามและคำแนะนำโดยทีมงาน Chantakorn Property
          </p>

        </div>

        {/* Categories and keyword search */}
        <div className="space-y-4 mb-8">
          {/* Category Pills */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery('');
                    setExpandedId(CURATED_FAQS.find(item => cat.id === 'all' || item.category === cat.id)?.id ?? null);
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

          {/* Search input */}
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="ค้นหาคำถามที่พบบ่อย"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาตามหัวข้อ เช่น โฉนด, กู้บ้าน, ขายฝาก, ม.อ., ค่าโอน..."
                className="w-full pl-10 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-navy-950 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-gold-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ล้าง
                </button>
              )}
            </div>

          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="max-w-3xl mx-auto space-y-3.5">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-navy-950">ไม่พบคำถามที่ตรงกับคำค้นหา &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-500">
                ลองใช้คำค้นอื่น เลือกหมวดหมู่ทั้งหมด หรือติดต่อทีมงานทาง LINE ด้านล่าง
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
                    type="button"
                    id={`${faq.id}-question`}
                    onClick={() => toggleAccordion(faq.id)}
                    aria-controls={`${faq.id}-answer`}
                    className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer focus:outline-hidden"
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
                    <div id={`${faq.id}-answer`} role="region" aria-labelledby={`${faq.id}-question`} className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-700 leading-relaxed border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                      <div className="whitespace-pre-line text-slate-800">
                        {faq.answer}
                      </div>

                      {faq.tip && (
                        <div className="p-3.5 bg-linear-to-r/srgb from-amber-50 to-gold-50/60 rounded-xl border border-gold-200 flex items-start space-x-2.5 text-xs text-amber-950">
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

        <div className="max-w-3xl mx-auto mt-12 bg-linear-to-br/srgb from-navy-950 via-navy-900 to-navy-950 rounded-3xl p-6 sm:p-8 text-white border border-gold-500/20 shadow-xl">
          <h3 className="text-xl sm:text-2xl font-black text-white">
            ยังมีข้อสงสัยเรื่องอสังหาฯ หาดใหญ่–สงขลา?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            ติดต่อทีมงาน Chantakorn Property เพื่อปรึกษาเรื่องเอกสารสิทธิ์ สินเชื่อ หรือการนัดชมทรัพย์
          </p>
          <a
            href="https://lin.ee/NMSe28T3"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>ปรึกษาทีมงานทาง LINE Official</span>
          </a>
        </div>
      </div>
    </section>
  );
}
