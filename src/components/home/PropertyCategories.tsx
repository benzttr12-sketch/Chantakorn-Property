'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Trees, Building2, Store, TrendingUp, HandCoins, ArrowRight } from 'lucide-react';
import { fetchProperties } from '@/lib/store/properties-store';

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
      name: 'บ้าน',
      type: 'house',
      description: 'บ้านเดี่ยว ทาวน์โฮม บ้านแฝด โซนหาดใหญ่และสงขลา',
      icon: Home,
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'ที่ดิน',
      type: 'land',
      description: 'ที่ดินเปล่าถมแล้ว ติดถนนใหญ่ แปลงสร้างบ้านหรือจัดสรร',
      icon: Trees,
      image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'คอนโด',
      type: 'condo',
      description: 'คอนโดพร้อมอยู่ใกล้มหาวิทยาลัยสงขลานครินทร์ และเซ็นทรัลหาดใหญ่',
      icon: Building2,
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'อาคารพาณิชย์',
      type: 'commercial',
      description: 'ตึกแถวและโฮมออฟฟิศทำเลค้าขาย ใจกลางย่านธุรกิจหาดใหญ่',
      icon: Store,
      image: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'อสังหาฯ เพื่อการลงทุน',
      type: 'investment',
      description: 'อพาร์ทเมนท์ หอพัก และอาคารพร้อมผู้เช่า ผลตอบแทนสม่ำเสมอ',
      icon: TrendingUp,
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'ขายฝาก / จำนอง',
      type: 'consignment',
      description: 'บริการจัดหาเงินทุนถูกกฎหมาย ดอกเบี้ยเป็นธรรม อนุมัติไว',
      icon: HandCoins,
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold mb-3">
            <span>หมวดหมู่อสังหาริมทรัพย์</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-navy-950 tracking-tight">
            ค้นหาอสังหาริมทรัพย์ตามประเภท
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-2">
            เลือกประเภทอสังหาริมทรัพย์ที่ตอบโจทย์การอยู่อาศัยและการลงทุนของคุณในหาดใหญ่–สงขลา
          </p>
        </div>

        {/* Categories Grid (6 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const realCount = counts[cat.type] || 0;
            return (
              <Link
                key={cat.name}
                href={`/properties?type=${cat.type}`}
                className="group relative h-64 rounded-3xl overflow-hidden shadow-md hover:shadow-2xl border border-slate-200/80 hover:border-gold-400/50 transition-all duration-300 transform hover:-translate-y-1 block"
              >
                {/* Background Image */}
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-[#020812]/50 to-transparent group-hover:via-[#020812]/60 transition-colors" />

                {/* Live Count Pill */}
                {realCount > 0 && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full border border-white/20 shadow-sm">
                      {realCount} รายการ
                    </span>
                  </div>
                )}

                {/* Card Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gold-400/20 backdrop-blur-md border border-gold-400/40 flex items-center justify-center text-gold-300 mb-3 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white group-hover:text-gold-300 transition-colors">
                      {cat.name}
                    </h3>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-1 font-normal">
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
