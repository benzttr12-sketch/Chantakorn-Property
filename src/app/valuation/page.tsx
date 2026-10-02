'use client';

import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Calculator, 
  FileText, 
  CheckCircle2, 
  TrendingUp,
  Award,
  ChevronRight,
  PhoneCall
} from 'lucide-react';
import AutoPinLandsMapsValuation from '@/components/landsmaps/AutoPinLandsMapsValuation';

export default function ValuationPage() {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col font-sans">
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white py-12 sm:py-16 px-4 relative overflow-hidden border-b border-gold-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px] opacity-15"></div>
          
          <div className="max-w-7xl mx-auto relative z-10 space-y-4 text-center sm:text-left">
            {/* Breadcrumb */}
            <div className="flex items-center justify-center sm:justify-start space-x-2 text-xs text-gray-400">
              <Link href="/" className="hover:text-gold-400 transition-colors">หน้าแรก</Link>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gold-400 font-medium">ประเมินราคา & DOL LandsMaps</span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-gold-400" />
                  <span>เชื่อมโยงฐานข้อมูลกรมที่ดิน & กรมธนารักษ์ (DOL LandsMaps Verified)</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  ระบบประเมินราคา & ตรวจสอบรูปแปลงโฉนด <span className="text-gold-400">หาดใหญ่–สงขลา</span>
                </h1>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  ปักหมุดพิกัดเพื่อดึงราคาประเมินทุนทรัพย์ราชการ คำนวณภาษีและค่าธรรมเนียมโอน ณ สำนักงานที่ดิน พร้อมเปิดดูรูปแปลงโฉนดที่ดินจริงบนระบบ DOL LandsMaps กรมที่ดิน ได้ทันที
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <a
                  href="https://landsmaps.dol.go.th"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-gold-300 font-bold text-xs border border-gold-400/40 flex items-center justify-center space-x-2 transition-all shadow-sm"
                >
                  <ExternalLink className="w-4 h-4 text-gold-400" />
                  <span>เปิดเว็บกรมที่ดิน landsmaps.dol.go.th</span>
                </a>
                <Link
                  href="/sell"
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-600 hover:to-amber-700 text-navy-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ฝากขายอสังหาฯ ฟรี</span>
                </Link>
              </div>
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 text-left">
              <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <div className="text-[11px] text-gray-400">ครอบคลุมพื้นที่</div>
                <div className="text-sm font-bold text-white mt-0.5">16 อำเภอ จ.สงขลา</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <div className="text-[11px] text-gray-400">ฐานข้อมูลราคาประเมิน</div>
                <div className="text-sm font-bold text-gold-400 mt-0.5">กรมธนารักษ์ รอบปี 2566–2569</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <div className="text-[11px] text-gray-400">การเชื่อมต่อระวางโฉนด</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">DOL LandsMaps Direct Link</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <div className="text-[11px] text-gray-400">ประมาณการค่าใช้จ่าย</div>
                <div className="text-sm font-bold text-white mt-0.5">ค่าธรรมเนียม & ภาษีโอนครบวงจร</div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Auto-Pin & Valuation Tool */}
        <section className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <AutoPinLandsMapsValuation />
        </section>

        {/* Why DOL LandsMaps Matters (Educational & Trust Building) */}
        <section className="bg-white py-12 px-4 border-t border-surface-border">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="text-xs font-bold text-gold-600 uppercase tracking-wider">
                TRANSPARENT REAL ESTATE
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950">
                ทำไมต้องตรวจสอบรูปแปลงที่ดิน & ราคาประเมินราชการ?
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Chantakorn Property ยึดมั่นในความโปร่งใส ลูกค้าและผู้ซื้อสามารถตรวจสอบข้อมูลรูปแปลง ขนาดที่ดินจริง และราคาประเมินทุนทรัพย์ได้ล่วงหน้า
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-extrabold text-navy-950 text-base">
                  ตรวจสอบรูปแปลงและทางเข้า-ออก
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  เช็คให้แน่ใจว่าที่ดินติดทางสาธารณประโยชน์ รูปแปลงที่ดินตรงกับเอกสารสิทธิ์ ไม่มีปัญหาที่ดินตาบอดหรือการรุกล้ำแนวเขต
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-extrabold text-navy-950 text-base">
                  คำนวณงบประมาณและภาษีโอนแม่นยำ
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  รู้ค่าใช้จ่ายล่วงหน้า ทั้งค่าธรรมเนียมการโอน 2%, ภาษีเงินได้หัก ณ ที่จ่าย และอากรแสตมป์หรือภาษีธุรกิจเฉพาะ ก่อนเดินทางไปสำนักงานที่ดิน
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-extrabold text-navy-950 text-base">
                  ประเมินศักยภาพการลงทุนและสินเชื่อ
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  เปรียบเทียบราคาเสนอขายในตลาดกับราคาประเมินทุนทรัพย์ของกรมธนารักษ์ เพื่อวางแผนกู้ธนาคารหรือขอวงเงินรับขายฝาก-จำนอง
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
