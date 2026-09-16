import React from 'react';
import Link from 'next/link';
import { PlusCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function SellPropertyCTA() {
  const benefits = [
    'ประเมินราคาตลาดและวางแผนการขายฟรี',
    'ทำการตลาดครอบคลุม ทั้งออนไลน์ โซเชียล และป้ายประกาศ',
    'คัดกรองผู้ซื้อที่มีศักยภาพและเครดิตพร้อม',
    'พาชมทรัพย์ เจรจาต่อรอง และดูแลสัญญาจนถึงวันโอน'
  ];

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-8 sm:p-12 lg:p-16 overflow-hidden shadow-xl border border-navy-800">
          {/* Decorative Gold Accent Lines */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 rounded-full bg-navy-800/40 blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-gold-400 uppercase tracking-widest bg-navy-800 px-3.5 py-1 rounded-full border border-gold-500/30 mb-4">
                บริการรับฝากขายอสังหาริมทรัพย์
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                มีบ้าน มีที่ดิน อยากขาย? <br />
                <span className="text-gold-400">ฝากทรัพย์กับเรา</span>
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
                ให้ Chantakorn Property ช่วยดูแลทรัพย์ของคุณ ด้วยฐานลูกค้าผู้ซื้อจริงในหาดใหญ่–สงขลา และทีมการตลาดมืออาชีพ ขายได้ไว ในราคาที่เหมาะสม
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {benefits.map((b) => (
                  <div key={b} className="flex items-center space-x-2.5 text-xs sm:text-sm text-gray-200">
                    <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/sell"
                className="inline-flex items-center space-x-2.5 px-8 py-4 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-sm sm:text-base rounded-xl shadow-lg hover:shadow-gold-500/20 transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-5 h-5 text-navy-950" />
                <span>ฝากขายกับ Chantakorn Property</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Right Card / Stat Snapshot */}
            <div className="lg:col-span-5 bg-navy-800/80 border border-gold-500/20 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
              <div className="text-center pb-6 border-b border-navy-700">
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  ผลงานการดูแลลูกค้า
                </span>
                <div className="text-4xl sm:text-5xl font-extrabold text-gold-400 mt-2">
                  98%
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  ความพึงพอใจของเจ้าของทรัพย์และผู้ซื้อ
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">45 วัน</div>
                  <div className="text-xs text-gray-400 mt-0.5">ระยะเวลาปิดการขายเฉลี่ย</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">100%</div>
                  <div className="text-xs text-gray-400 mt-0.5">ฟรีค่าการตลาดจนกว่าจะขายได้</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
