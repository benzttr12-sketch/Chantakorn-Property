import React from 'react';
import Link from 'next/link';
import { Search, PhoneCall, MessageCircle } from 'lucide-react';

export default function ContactCTA() {
  return (
    <section className="py-20 bg-navy-950 text-white relative overflow-hidden">
      {/* Decorative Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900 via-navy-950 to-navy-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="flex items-center justify-center space-x-2 text-xs font-bold text-gold-400 uppercase tracking-widest mb-4">
          <span>บริการด้วยใจ ให้คำปรึกษาฟรี</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
          กำลังมองหาอสังหาริมทรัพย์?
        </h2>

        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          ให้เราช่วยคุณค้นหาทรัพย์ที่เหมาะกับคุณ <br className="hidden sm:inline" />
          ทีมงานพร้อมตอบคำถาม แนะนำทำเล และพาชมสถานที่จริงทุกวัน
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/properties"
            className="px-8 py-3.5 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-sm sm:text-base rounded-xl shadow-lg hover:shadow-gold-500/25 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>ค้นหาทรัพย์</span>
          </Link>

          <Link
            href="/contact"
            className="px-8 py-3.5 bg-navy-800/90 hover:bg-navy-800 text-white hover:text-gold-300 border border-white/20 hover:border-gold-400/50 font-semibold text-sm sm:text-base rounded-xl transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"
          >
            <PhoneCall className="w-4 h-4 text-gold-400" />
            <span>ติดต่อเรา</span>
          </Link>

          <a
            href="https://lin.ee/NMSe28T3"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm sm:text-base rounded-xl transition-all transform hover:-translate-y-0.5 flex items-center space-x-2 shadow-md"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>คุยไลน์กับเรา</span>
          </a>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          โทรสอบถามได้ที่: <a href="tel:0816040097" className="text-white font-semibold hover:text-gold-400">081-604-0097</a> | 
          LINE: <span className="text-gold-400 font-medium">Official Account</span>
        </div>
      </div>
    </section>
  );
}
