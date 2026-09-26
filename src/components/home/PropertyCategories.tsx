'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Trees, Building2, Store, TrendingUp, HandCoins, ArrowRight, Sparkles } from 'lucide-react';
import { fetchProperties } from '@/lib/store/properties-store';
import {
  villaModernEstate,
  penthouseLivingRoom,
  hatyaiCitySkyline,
  coastalSongkhlaVilla,
  heroLuxuryMansion
} from '@/assets/images';

export default function PropertyCategories() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadCounts() {
      try {
        const props = await fetchProperties();
        const map: Record<string, number> = {};
        props.forEach((p) => {
          map[p.property_type] = (map[p.property_type] || 0) + 1;
        });
        setCounts(map);
      } catch {
        // Fallback
      }
    }
    loadCounts();
  }, []);

  const categories = [
    {
      name: 'บ้านเดี่ยว & พูลวิลล่า',
      type: 'house',
      description: 'บ้านเดี่ยว ทาวน์โฮม บ้านแฝด โซน ม.อ. คอหงส์ กาญจนวนิช และสนามบินหาดใหญ่',
      icon: Home,
      image: villaModernEstate,
    },
    {
      name: 'คอนโดมิเนียมหรู',
      type: 'condo',
      description: 'คอนโดพร้อมอยู่ ใกล้ ม.อ. หาดใหญ่ เซ็นทรัล และศูนย์กลางไลฟ์สไตล์การเดินทาง',
      icon: Building2,
      image: penthouseLivingRoom,
    },
    {
      name: 'ที่ดินแปลงสวย',
      type: 'land',
      description: 'ที่ดินเปล่าถมแล้ว ติดถนนใหญ่ แปลงสร้างบ้านเดี่ยว หรือจัดสรรเพื่อการลงทุน',
      icon: Trees,
      image: coastalSongkhlaVilla,
    },
    {
      name: 'อาคารพาณิชย์ & ตึกแถว',
      type: 'commercial',
      description: 'ตึกแถวทำเลทอง ค้าขายได้ทันที โซนตลาดกิมหยง และถนน 30 เมตร',
      icon: Store,
      image: hatyaiCitySkyline,
    },
    {
      name: 'อสังหาฯ เพื่อการลงทุน',
      type: 'investment',
      description: 'อพาร์ตเมนต์ หอพัก และอาคารพร้อมผู้เช่า กระแสเงินสดมั่นคง Yield สูง',
      icon: TrendingUp,
      image: heroLuxuryMansion,
    },
    {
      name: 'ขายฝาก & จำนองด่วน',
      type: 'consignment',
      description: 'บริการจัดหาเงินทุนถูกกฎหมาย ดอกเบี้ยต่ำ อนุมัติไว ทำสัญญา ณ กรมที่ดิน',
      icon: HandCoins,
      image: villaModernEstate,
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-gold-700 uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            <span>DISCOVER BY PROPERTY TYPE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-950 tracking-tight text-balance">
            เลือกชมตามประเภทอสังหาริมทรัพย์
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-2.5 leading-relaxed">
            ครอบคลุมทุกความต้องการ ทั้งการอยู่อาศัยระดับพรีเมียมและการลงทุนที่สร้างผลตอบแทนสม่ำเสมอ
          </p>
        </div>

        {/* Categories Grid (6 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const realCount = counts[cat.type] || 0;
            return (
              <Link
                key={cat.name}
                href={`/properties?type=${cat.type}`}
                className="group relative h-80 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl border border-slate-200/80 hover:border-gold-400/60 transition-all duration-500 transform hover:-translate-y-1.5 block bg-navy-950"
              >
                {/* Background Image */}
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  placeholder="blur"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-108 transition-transform duration-700 ease-out opacity-85 group-hover:opacity-95"
                  referrerPolicy="no-referrer"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-[#020812]/50 to-transparent group-hover:via-[#020812]/40 transition-colors" />

                {/* Live Count Pill (Unboxed text / subtle tag) */}
                {realCount > 0 && (
                  <div className="absolute top-5 right-5 z-10">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-semibold rounded-lg border border-white/20">
                      {realCount} รายการ
                    </span>
                  </div>
                )}

                {/* Card Content */}
                <div className="absolute inset-0 p-7 flex flex-col justify-end z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-gold-300 mb-3.5 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all duration-300 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-gold-300 transition-colors">
                      {cat.name}
                    </h3>
                    <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 mt-2 line-clamp-2 font-normal leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
