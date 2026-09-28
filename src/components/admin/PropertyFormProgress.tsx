'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Image as ImageIcon,
  MapPin,
  Coins,
  FileText,
  UserCheck,
  Maximize2
} from 'lucide-react';

export interface FormValidationItem {
  id: string;
  fieldKey: string;
  targetElementId: string;
  label: string;
  isRequired: boolean;
  isValid: boolean;
  isWarning?: boolean;
  message: string;
  currentValuePreview?: string;
}

interface PropertyFormProgressProps {
  items: FormValidationItem[];
  overallPercentage: number;
  requiredPassedCount: number;
  totalRequired: number;
  recommendedPassedCount: number;
  totalRecommended: number;
  onScrollToSection: (elementId: string) => void;
}

export default function PropertyFormProgress({
  items,
  overallPercentage,
  requiredPassedCount,
  totalRequired,
  recommendedPassedCount,
  totalRecommended,
  onScrollToSection,
}: PropertyFormProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const allRequiredPassed = requiredPassedCount === totalRequired;
  const missingRequiredItems = items.filter(item => item.isRequired && !item.isValid);

  // Gradient color based on percentage
  const getProgressBarColor = () => {
    if (overallPercentage === 100) return 'from-emerald-500 via-teal-500 to-emerald-400';
    if (overallPercentage >= 80) return 'from-emerald-500 via-gold-500 to-emerald-400';
    if (overallPercentage >= 50) return 'from-gold-500 via-amber-500 to-gold-400';
    return 'from-rose-500 via-amber-500 to-gold-500';
  };

  const getStatusBadge = () => {
    if (overallPercentage === 100) {
      return {
        bg: 'bg-emerald-100 border-emerald-300 text-emerald-900',
        text: 'ข้อมูลสมบูรณ์แบบ 100% พร้อมเผยแพร่ทันที',
        icon: Sparkles
      };
    }
    if (allRequiredPassed) {
      return {
        bg: 'bg-teal-100 border-teal-300 text-teal-900',
        text: 'ข้อมูลจำเป็นครบแล้ว สามารถบันทึกได้ (แนะนำเพิ่มข้อมูลเสริม)',
        icon: ShieldCheck
      };
    }
    return {
      bg: 'bg-amber-100 border-amber-300 text-amber-900',
      text: `ยังขาดข้อมูลจำเป็นอีก ${missingRequiredItems.length} รายการ`,
      icon: AlertCircle
    };
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden transition-all duration-300">
      {/* Top Banner: Progress Bar & Key Indicators */}
      <div className="p-5 sm:p-6 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-gold-400 uppercase tracking-wider mb-1">
                <Zap className="w-3.5 h-3.5 text-gold-400" />
                <span>REAL-TIME FORM VALIDATION & COMPLETION</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>ความสมบูรณ์ของข้อมูลทรัพย์สิน</span>
                <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-full bg-white/15 text-gold-300 border border-white/20">
                  {overallPercentage}%
                </span>
              </h2>
            </div>

            {/* Quick Status Pill */}
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 self-start sm:self-auto ${statusBadge.bg}`}>
              <StatusIcon className="w-4 h-4 flex-shrink-0" />
              <span>{statusBadge.text}</span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span>ความคืบหน้าของฟอร์ม</span>
              <span className="font-mono font-bold text-white text-sm">{overallPercentage}%</span>
            </div>
            <div className="w-full bg-navy-800/90 h-3 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r ${getProgressBarColor()} shadow-md`}
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>

          {/* Summary Counters & Fast Jump */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
              <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                <span className={`w-2 h-2 rounded-full ${allRequiredPassed ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-slate-300">ข้อมูลบังคับ:</span>
                <span className="font-bold text-white">
                  {requiredPassedCount}/{totalRequired}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                <span className="w-2 h-2 rounded-full bg-gold-400" />
                <span className="text-slate-300">ข้อมูลเสริมแนะนำ:</span>
                <span className="font-bold text-white">
                  {recommendedPassedCount}/{totalRecommended}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {missingRequiredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => onScrollToSection(missingRequiredItems[0].targetElementId)}
                  className="px-3 py-1 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-lg text-xs transition-all shadow-sm flex items-center space-x-1 cursor-pointer active:scale-95"
                >
                  <span>กรอกส่วนที่ยังขาด: {missingRequiredItems[0].label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-3 py-1 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-lg text-xs transition-all border border-white/20 flex items-center space-x-1 cursor-pointer"
              >
                <span>{isExpanded ? 'ย่อรายการตรวจสอบ' : 'ดูรายละเอียดทุกช่อง'}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Checklist Details */}
      {isExpanded && (
        <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-200 pb-2">
            <span>รายการตรวจสอบข้อมูลทรัพย์สิน (Real-time Checklist)</span>
            <span>คลิกที่รายการเพื่อเลื่อนไปยังช่องกรอกทันที</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => {
              const isOk = item.isValid;
              const isWarn = item.isWarning;

              let iconColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
              let badgeText = 'ผ่าน';
              let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

              if (!isOk) {
                if (item.isRequired) {
                  iconColor = 'text-rose-600 bg-rose-100 border-rose-200';
                  badgeText = 'จำเป็น';
                  badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                } else {
                  iconColor = 'text-amber-600 bg-amber-100 border-amber-200';
                  badgeText = 'แนะนำ';
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                }
              } else if (isWarn) {
                iconColor = 'text-amber-600 bg-amber-100 border-amber-200';
                badgeText = 'พอใช้';
                badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onScrollToSection(item.targetElementId)}
                  className={`text-left p-3 rounded-xl border transition-all flex items-start space-x-3 cursor-pointer group bg-white hover:shadow-md ${
                    isOk && !isWarn
                      ? 'border-slate-200 hover:border-emerald-300'
                      : item.isRequired
                      ? 'border-rose-200 bg-rose-50/30 hover:border-rose-400'
                      : 'border-amber-200 bg-amber-50/30 hover:border-amber-400'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColor}`}>
                    {isOk && !isWarn ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-navy-950 group-hover:text-gold-700 transition-colors truncate">
                        {item.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border flex-shrink-0 ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    <p className={`text-[11px] leading-relaxed line-clamp-1 ${
                      isOk && !isWarn ? 'text-slate-500' : item.isRequired ? 'text-rose-600 font-medium' : 'text-amber-700'
                    }`}>
                      {item.message}
                    </p>

                    {item.currentValuePreview && (
                      <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        {item.currentValuePreview}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
