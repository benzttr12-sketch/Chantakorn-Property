'use client';

import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import AutoPinLandsMapsValuation from '@/components/landsmaps/AutoPinLandsMapsValuation';
import { LANDSMAPS_URL, TREASURY_APPRAISAL_URL } from '@/lib/landsmaps';

export default function AdminValuationPage() {
  return (
    <div className="space-y-6 sm:space-y-8 pb-20 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-surface-border bg-white p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gold-600 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gold-600" aria-hidden="true" />
              ค้นผ่านเว็บไซต์ทางการกรมที่ดิน & กรมธนารักษ์
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              แผนที่ที่ดิน & ประเมินราคา (หลังบ้าน)
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 max-w-2xl">
              เลือกทรัพย์เพื่อดูตำแหน่งจริงและปักหมุด ดูเส้นแดงจากข้อมูลเปิดกรมที่ดินในพื้นที่ที่มีข้อมูล หรือวาดและนำเข้าแนวเขตของทรัพย์ จากนั้นกรอกราคาประเมินที่ตรวจสอบจากกรมธนารักษ์เพื่อคำนวณมูลค่าที่ดิน พร้อมบันทึกแหล่งข้อมูลและวันที่ตรวจสอบ
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-blue-700">
              <a href={LANDSMAPS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">เว็บไซต์กรมที่ดิน LandsMaps <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
              <a href={TREASURY_APPRAISAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">เว็บไซต์ราคาประเมินกรมธนารักษ์ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-surface-border shadow-xs">
        <AutoPinLandsMapsValuation />
      </div>
    </div>
  );
}
