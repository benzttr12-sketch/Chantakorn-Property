'use client';

import { useId, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';

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

export default function PropertyFormProgress({ items, overallPercentage, requiredPassedCount, totalRequired, recommendedPassedCount, totalRecommended, onScrollToSection }: PropertyFormProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const checklistId = useId();
  const missing = items.filter(item => item.isRequired && !item.isValid);
  const complete = missing.length === 0;
  const progress = Math.max(0, Math.min(100, overallPercentage));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">{complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-gold-700" />}<div><h2 className="text-sm font-semibold text-navy-950">{complete ? 'ข้อมูลจำเป็นครบ พร้อมบันทึก' : `ยังขาดข้อมูลจำเป็น ${missing.length} รายการ`}</h2><p className="mt-1 text-xs text-slate-500">จำเป็น {requiredPassedCount}/{totalRequired} · ข้อมูลเสริม {recommendedPassedCount}/{totalRecommended}</p></div></div>
          <button type="button" aria-expanded={expanded} aria-controls={checklistId} onClick={() => setExpanded(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">{expanded ? 'ย่อรายการตรวจสอบ' : 'ดูรายการตรวจสอบ'}<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
        </div>
        <div className="flex items-center gap-3"><div role="progressbar" aria-label="ความสมบูรณ์ของข้อมูลทรัพย์" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${complete ? 'bg-emerald-500' : 'bg-gold-500'}`} style={{ width: `${progress}%` }} /></div><span className="text-xs font-semibold tabular-nums text-slate-500">{progress}%</span></div>
        {missing[0] && <button type="button" onClick={() => onScrollToSection(missing[0].targetElementId)} className="inline-flex min-h-11 items-center gap-2 text-left text-xs font-medium text-navy-950">ไปกรอก: {missing[0].label}<ArrowRight className="h-4 w-4 shrink-0" /></button>}
      </div>
      <div id={checklistId} hidden={!expanded} className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
        <p className="mb-3 text-xs text-slate-500">เลือกหัวข้อเพื่อไปยังช่องกรอก</p>
        <div className="grid gap-2 sm:grid-cols-2">{items.map(item => {
          const passed = item.isValid && !item.isWarning;
          return <button type="button" key={item.id} onClick={() => onScrollToSection(item.targetElementId)} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-gold-400">{passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${item.isRequired && !item.isValid ? 'text-red-500' : 'text-gold-600'}`} />}<span className="min-w-0 flex-1"><span className="block text-xs font-medium text-navy-950">{item.label}<span className="ml-2 font-normal text-slate-400">{passed ? 'ครบแล้ว' : item.isRequired && !item.isValid ? 'จำเป็น' : 'แนะนำ'}</span></span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.message}</span>{item.currentValuePreview && <span className="mt-1 block break-words text-xs text-slate-400">{item.currentValuePreview}</span>}</span></button>;
        })}</div>
      </div>
    </section>
  );
}
