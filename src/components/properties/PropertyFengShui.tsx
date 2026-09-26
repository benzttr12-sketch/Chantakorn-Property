'use client';

import React, { useState } from 'react';
import { 
  Compass, 
  Sparkles, 
  Wind, 
  Sun, 
  ShieldCheck, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Lightbulb, 
  Flame, 
  Droplets, 
  TreePine, 
  Coins, 
  Mountain
} from 'lucide-react';
import { Property, FengShuiAnalysis } from '@/lib/types';
import { calculateFengShui } from '@/lib/feng-shui';

interface PropertyFengShuiProps {
  property: Property;
  className?: string;
}

export default function PropertyFengShui({ property, className = '' }: PropertyFengShuiProps) {
  const [showTips, setShowTips] = useState(true);

  // คำนวณหรือดึงข้อมูลฮวงจุ้ยอัตโนมัติ
  const fengShui: FengShuiAnalysis = property.feng_shui || calculateFengShui(property.facing_direction, {
    lat: property.latitude,
    lng: property.longitude,
    propertyId: property.id,
    propertyType: property.property_type
  });

  const getElementIcon = (element: string) => {
    if (element.includes('ไฟ')) return <Flame className="w-4 h-4 text-rose-500" />;
    if (element.includes('น้ำ')) return <Droplets className="w-4 h-4 text-sky-500" />;
    if (element.includes('ไม้')) return <TreePine className="w-4 h-4 text-emerald-500" />;
    if (element.includes('ทอง')) return <Coins className="w-4 h-4 text-amber-500" />;
    if (element.includes('ดิน')) return <Mountain className="w-4 h-4 text-orange-600" />;
    return <Sparkles className="w-4 h-4 text-gold-500" />;
  };

  return (
    <div className={`bg-white rounded-2xl border border-surface-border shadow-card overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 p-6 text-white relative overflow-hidden">
        {/* Decorative gold shimmer overlay */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-gold-400 shadow-sm flex-shrink-0">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gold-400 bg-gold-950/60 px-2.5 py-0.5 rounded-full border border-gold-500/30">
                  ศาสตร์ฮวงจุ้ย & ชัยภูมิมงคล
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  คำนวณอัตโนมัติ
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                วิเคราะห์พลังงานทิศทรัพย์ {fengShui.direction}
              </h3>
            </div>
          </div>

          {/* Feng Shui Score Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-xl text-center shadow-inner">
            <span className="text-[10px] uppercase tracking-wider text-gray-300 block">คะแนนฮวงจุ้ย</span>
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-2xl sm:text-3xl font-black text-gold-400">{fengShui.score}</span>
              <span className="text-xs text-gray-300 font-medium">/100</span>
            </div>
          </div>
        </div>

        {/* Grade Banner */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-gold-400 flex-shrink-0" />
            <strong className="text-gold-300 font-bold">{fengShui.grade}</strong>
          </div>
          <div className="flex items-center space-x-2 bg-navy-800/80 px-3 py-1 rounded-lg border border-navy-700">
            {getElementIcon(fengShui.element)}
            <span className="font-semibold text-white">{fengShui.element}</span>
            <span className="text-gray-400 text-xs">({fengShui.degrees}°)</span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {/* Meaning & Summary */}
        <div className="bg-gold-50/50 border border-gold-200/70 rounded-xl p-4 sm:p-5">
          <div className="flex items-start space-x-3">
            <div className="w-7 h-7 rounded-lg bg-gold-100 text-gold-800 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
              ☯
            </div>
            <div className="text-xs sm:text-sm text-gray-800 space-y-1">
              <p className="font-bold text-navy-950 text-sm sm:text-base">
                {fengShui.meaning}
              </p>
              <p className="text-gray-600 leading-relaxed">
                {fengShui.summary}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Energy Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Wind Qi Energy */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-gold-300 transition-colors">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                  พลังงานลมธรรมชาติ (ชี่ลม)
                </h4>
                <span className="text-[11px] text-gray-500">ทิศทางลมมรสุมและการระบายอากาศ</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed pl-10.5">
              {fengShui.windEnergy}
            </p>
          </div>

          {/* 2. Sunlight & Yin-Yang */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-gold-300 transition-colors">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                  แสงสุริยัน & หยิน-หยาง
                </h4>
                <span className="text-[11px] text-gray-500">ทิศทางแดดเช้า-บ่ายและอุณหภูมิ</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed pl-10.5">
              {fengShui.sunEnergy}
            </p>
          </div>

          {/* 3. Suitable Occupants & Business */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-gold-300 transition-colors">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                  เกื้อหนุนบุคคล & ธุรกิจ
                </h4>
                <span className="text-[11px] text-gray-500">ผู้ที่อยู่อาศัยแล้วเจริญรุ่งเรือง</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1 pl-10.5">
              {fengShui.suitableFor.map((role, idx) => (
                <span 
                  key={idx}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* 4. Lucky Colors & Numbers */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-gold-300 transition-colors">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                  สีมงคล & เลขนำโชค
                </h4>
                <span className="text-[11px] text-gray-500">เฉดสีตกแต่งและตัวเลขดึงดูดทรัพย์</span>
              </div>
            </div>
            <div className="space-y-1.5 pl-10.5 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500">สีมงคล:</span>
                <span className="font-semibold text-navy-900">{fengShui.luckyColors.join(', ')}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500">เลขมงคลประจำทิศ:</span>
                <span className="font-bold text-gold-700 bg-gold-50 px-2 py-0.5 rounded border border-gold-200">
                  {fengShui.auspiciousNumbers}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Auspicious Highlights */}
        {fengShui.highlights && fengShui.highlights.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3">
              จุดเด่นชัยภูมิมงคลเฉพาะหลัง
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {fengShui.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2.5 text-xs text-gray-800 p-2.5 rounded-xl bg-gray-50/70 border border-gray-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Feng Shui Decor Tips */}
        {fengShui.auspiciousDecorTips && fengShui.auspiciousDecorTips.length > 0 && (
          <div className="border border-gold-200 rounded-xl overflow-hidden bg-gradient-to-b from-gold-50/40 to-white">
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="w-full p-4 flex items-center justify-between text-left text-navy-950 font-bold text-xs sm:text-sm hover:bg-gold-50/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-gold-600 flex-shrink-0" />
                <span>เคล็ดลับการจัดบ้านและตกแต่งเสริมสิริมงคล (Auspicious Tips)</span>
              </div>
              {showTips ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {showTips && (
              <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gold-100 text-xs text-gray-700">
                {fengShui.auspiciousDecorTips.map((tip, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="w-5 h-5 rounded-full bg-gold-100 text-gold-800 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Verified by Chantakorn Property Guarantee */}
        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center space-x-3 text-xs text-emerald-950">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <strong>ตรวจประเมินชัยภูมิศาสตร์โดย Chantakorn Property:</strong> ทำเลปลอดภัย ปลอดทางสามแพร่ง ไม่ติดสุสานหรือเสาไฟฟ้าแรงสูง โครงสร้างโปร่งโล่งเปิดรับทรัพย์ตามหลักภูมิศาสตร์และฮวงจุ้ยร่วมสมัย
          </div>
        </div>
      </div>
    </div>
  );
}
