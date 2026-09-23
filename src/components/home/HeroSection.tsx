import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, PlusCircle, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import FloatingSearchBox from './FloatingSearchBox';

export default function HeroSection() {
  return (
    <section className="relative min-h-[660px] lg:min-h-[720px] flex flex-col justify-between pt-16 pb-12 lg:pt-24 lg:pb-20 overflow-hidden">
      {/* Background Photography with Luxury Depth */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85"
          alt="CHANTAKORN PROPERTY - Luxury Real Estate Agency Hat Yai Songkhla"
          fill
          priority
          className="object-cover object-center scale-105"
        />
        {/* Layered Luxury Scrims */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020812] via-[#020812]/85 to-[#0B192C]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-transparent to-black/40" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-grow flex flex-col justify-center">
        <div className="max-w-3xl">
          {/* Trust Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/10 border border-gold-400/40 text-gold-300 text-xs font-semibold mb-6 backdrop-blur-md shadow-lg">
            <Shield className="w-3.5 h-3.5 text-gold-400" />
            <span>นายหน้าอสังหาริมทรัพย์มืออาชีพที่ได้รับความไว้วางใจใน หาดใหญ่–สงขลา</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12] mb-5">
            ค้นหาอสังหาริมทรัพย์ที่ใช่ <br className="hidden sm:inline" />
            <span className="text-gold-gradient">
              เพื่ออนาคตของคุณ
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-normal mb-8 max-w-2xl">
            บ้านเดี่ยว ที่ดิน คอนโด ตึกแถว และบริการขายฝากในหาดใหญ่–สงขลา <br className="hidden sm:inline" />
            ครบวงจร ตรวจสอบเอกสารสิทธิ์ ดูแลทุกขั้นตอนจนถึงวันโอนกรรมสิทธิ์
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <Link
              href="/properties"
              className="px-8 py-4 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-sm rounded-xl shadow-xl hover:shadow-gold-500/30 flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Search className="w-4 h-4 text-navy-950 stroke-[2.5]" />
              <span>ค้นหาอสังหาริมทรัพย์</span>
            </Link>

            <Link
              href="/sell"
              className="px-8 py-4 bg-navy-900/90 hover:bg-navy-800 text-white hover:text-gold-300 border border-white/20 hover:border-gold-400/60 font-bold text-sm rounded-xl backdrop-blur-md flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
            >
              <PlusCircle className="w-4 h-4 text-gold-400" />
              <span>ฝากขาย / ขายฝากกับเรา</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-slate-200 pt-3 border-t border-white/15">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <span className="font-medium">คัดกรองทรัพย์คุณภาพ 100%</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <span className="font-medium">ประสานงานสินเชื่อ & กรมที่ดิน</span>
            </div>
            <div className="flex items-center space-x-2 col-span-2 sm:col-span-1">
              <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <span className="font-medium">บริการด้วยความจริงใจ</span>
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
