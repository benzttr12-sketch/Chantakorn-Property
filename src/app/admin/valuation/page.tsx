'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import AutoPinLandsMapsValuation from '@/components/landsmaps/AutoPinLandsMapsValuation';

export default function AdminValuationPage() {
  return (
    <div className="space-y-6 sm:space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Page Title & Banner */}
      <div className="rounded-3xl border border-surface-border bg-white p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gold-600 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gold-600" />
              เชื่อมโยงฐานข้อมูลกรมที่ดิน & กรมธนารักษ์ (DOL LandsMaps Verified)
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              ระบบประเมินราคาที่ดิน & ปักหมุดโฉนดอัตโนมัติ (หลังบ้าน)
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 max-w-2xl">
              ดึงราคาประเมินทุนทรัพย์ราชการกรมธนารักษ์ คำนวณภาษีและค่าธรรมเนียมโอน ณ สำนักงานที่ดิน พร้อมเปิดดูรูปแปลงระวางโฉนดที่ดินจริงบนระบบ DOL LandsMaps ได้โดยตรงจากในระบบจัดการหลังบ้าน
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Auto-Pin & Valuation Tool */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-surface-border shadow-xs">
        <AutoPinLandsMapsValuation />
      </div>
    </div>
  );
}
