import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, PlusCircle, ChevronRight, Award, ShieldCheck, Star } from 'lucide-react';
import FloatingSearchBox from './FloatingSearchBox';
import { hatyaiModernHouseHero } from '@/assets/images';

export default function HeroSection() {
  return (
    <section className="relative min-h-[740px] lg:min-h-[840px] flex flex-col justify-between pt-20 pb-16 lg:pt-28 lg:pb-24 overflow-hidden bg-navy-950">
      {/* Background Photography with Luxury Depth */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={hatyaiModernHouseHero}
          alt="CHANTAKORN PROPERTY - Luxury Modern House in Hat Yai Real Estate Agency"
          fill
          priority
          placeholder="blur"
          className="object-cover object-center scale-105 transform duration-1000 ease-out"
          referrerPolicy="no-referrer"
        />
        {/* Layered Luxury Scrims & Ambient Lighting */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020812]/95 via-[#020812]/80 to-[#0B192C]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-transparent to-black/60" />
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-grow flex flex-col justify-center">
        <div className="max-w-3xl">
          {/* Luxury Brand Kicker (No cheap pill enclosure - clean unboxed typography with separator) */}
          <div className="flex items-center space-x-2 text-xs font-semibold text-gold-400 tracking-wider uppercase mb-5">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            <span className="font-bold tracking-widest text-gold-300">CHANTAKORN PROPERTY</span>
            <span className="text-white/40">·</span>
            <span className="text-slate-200">ศูนย์กลางอสังหาริมทรัพย์ระดับพรีเมียม หาดใหญ่–สงขลา</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12] mb-6 text-balance">
            คัดสรรอสังหาริมทรัพย์ <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#F4E3BA] via-[#D4AF37] to-[#AA771C] bg-clip-text text-transparent">
              ระดับมาสเตอร์พีซ
            </span>
            <span className="text-white"> ในหาดใหญ่ – สงขลา</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-normal mb-8 max-w-2xl">
            บ้านเดี่ยว พูลวิลล่า คอนโดมิเนียมหรู ที่ดินแปลงสวย และบริการขายฝากดอกเบี้ยต่ำ <br className="hidden sm:inline" />
            ตรวจสอบความถูกต้องของโฉนด 100% พร้อมดูแลประสานสินเชื่อธนาคารจนถึงวันโอนกรรมสิทธิ์
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <Link
              href="/properties"
              className="px-8 py-4 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-sm rounded-xl shadow-xl hover:shadow-gold-500/30 flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <Search className="w-4 h-4 text-navy-950 stroke-[2.5]" />
              <span>สำรวจอสังหาฯ ทั้งหมด</span>
              <ChevronRight className="w-4 h-4 text-navy-950 transform group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              href="/sell"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white hover:text-gold-300 border border-white/25 hover:border-gold-400/60 font-bold text-sm rounded-xl backdrop-blur-md flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
            >
              <PlusCircle className="w-4 h-4 text-gold-400" />
              <span>ฝากขาย / ขายฝากกับเรา</span>
            </Link>
          </div>

          {/* Stat Counter Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-200 pt-6 border-t border-white/15">
            <div className="space-y-0.5">
              <div className="text-2xl sm:text-3xl font-black text-gold-300 tabular-nums">500+</div>
              <span className="text-[11px] text-slate-300 font-medium">ทรัพย์คุณภาพในพอร์ต</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl sm:text-3xl font-black text-gold-300 tabular-nums">99%</div>
              <span className="text-[11px] text-slate-300 font-medium">ยื่นกู้ผ่านฉลุย</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl sm:text-3xl font-black text-gold-300 tabular-nums">100%</div>
              <span className="text-[11px] text-slate-300 font-medium">โฉนดตรวจสอบแล้ว</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl sm:text-3xl font-black text-gold-300 tabular-nums">6 ธนาคาร</div>
              <span className="text-[11px] text-slate-300 font-medium">ดอกเบี้ยพิเศษพันธมิตร</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Search Panel Attached at Bottom */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-10">
        <FloatingSearchBox />
      </div>
    </section>
  );
}
