'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Trees, Building2, Store, TrendingUp, HandCoins, ArrowUpRight, Sparkles } from 'lucide-react';
import { fetchProperties } from '@/lib/store/properties-store';
import {
  catHatyaiLuxuryHouse,
  catHatyaiLuxuryCondo,
  catSongkhlaPrimeLand,
  catHatyaiShophouseCommercial,
  catHatyaiInvestmentApartment,
  catSongkhlaLandChanote,
} from '@/assets/images';

const CATEGORIES = [
  {
    name: 'บ้านเดี่ยว & พูลวิลล่า', type: 'house', purpose: 'พื้นที่สำหรับชีวิต',
    location: 'ม.อ. · คอหงส์ · หาดใหญ่',
    description: 'ค้นหาบ้านเดี่ยว ทาวน์โฮม และบ้านแฝด ในย่านที่เหมาะกับชีวิตของคุณ',
    icon: Home, image: catHatyaiLuxuryHouse,
  },
  {
    name: 'คอนโดมิเนียม', type: 'condo', purpose: 'ใช้ชีวิตใกล้เมือง',
    location: 'เซ็นทรัล · ม.อ. · หาดใหญ่',
    description: 'เลือกคอนโดใกล้สถานศึกษา แหล่งช้อปปิ้ง และเส้นทางการเดินทาง',
    icon: Building2, image: catHatyaiLuxuryCondo,
  },
  {
    name: 'ที่ดินแปลงสวย', type: 'land', purpose: 'เริ่มต้นสิ่งใหม่',
    location: 'สงขลา · หาดใหญ่',
    description: 'พื้นที่สำหรับสร้างบ้าน ทำธุรกิจ หรือวางแผนการลงทุนในอนาคต',
    icon: Trees, image: catSongkhlaPrimeLand,
  },
  {
    name: 'อาคารพาณิชย์ & ตึกแถว', type: 'commercial', purpose: 'ต่อยอดธุรกิจ',
    location: 'ย่านการค้า · หาดใหญ่',
    description: 'สำรวจพื้นที่ค้าขาย สำนักงาน และอาคารพาณิชย์ในทำเลธุรกิจ',
    icon: Store, image: catHatyaiShophouseCommercial,
  },
  {
    name: 'อสังหาฯ เพื่อการลงทุน', type: 'investment', purpose: 'มองหาโอกาส',
    location: 'หาดใหญ่ · สงขลา',
    description: 'อพาร์ตเมนต์ หอพัก และอาคารสำหรับผู้ที่กำลังมองหาทรัพย์ลงทุน',
    icon: TrendingUp, image: catHatyaiInvestmentApartment,
  },
  {
    name: 'ขายฝาก & เสริมสภาพคล่อง', type: 'consignment', purpose: 'วางแผนการเงิน',
    location: 'หาดใหญ่ · สงขลา',
    description: 'สำรวจทรัพย์ในหมวดขายฝาก และสอบถามรายละเอียดกับทีมงาน',
    icon: HandCoins, image: catSongkhlaLandChanote,
  },
];

export default function PropertyCategories() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      try {
        const properties = await fetchProperties();
        const map: Record<string, number> = {};
        properties.forEach((property) => {
          map[property.property_type] = (map[property.property_type] || 0) + 1;
        });
        if (active) setCounts(map);
      } catch {
        // Categories remain browsable when the published count cannot be loaded.
      }
    }
    void loadCounts();
    return () => { active = false; };
  }, []);

  return (
    <section id="home-categories" aria-labelledby="home-categories-title" className="relative scroll-mt-28 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-gold-700">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              <span>DISCOVER YOUR SPACE</span>
            </div>
            <h2 id="home-categories-title" className="text-balance text-3xl font-black tracking-tight text-navy-950 sm:text-4xl lg:text-5xl">
              แต่ละเป้าหมาย มีพื้นที่ที่ใช่
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              เริ่มจากประเภททรัพย์ที่คุณสนใจ แล้วค่อยค้นหาทำเลและรายละเอียดที่ลงตัว
            </p>
          </div>
          <div className="flex items-center gap-4 border-l-2 border-gold-400 pl-4 md:pb-1">
            <span aria-hidden="true" className="text-4xl font-light tabular-nums text-navy-950">06</span>
            <span className="text-sm leading-relaxed text-slate-500">ประเภททรัพย์<br /><span className="font-semibold text-navy-800">เลือกสำรวจได้ทันที</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {CATEGORIES.map((category, index) => {
            const Icon = category.icon;
            const realCount = counts?.[category.type] || 0;
            return (
              <Link
                key={category.type}
                href={`/properties?type=${category.type}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm outline-none hover:border-gold-400 hover:shadow-card-hover focus-visible:border-gold-500 focus-visible:ring-4 focus-visible:ring-gold-200 motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-reduce:transition-none"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-navy-950">
                  <Image
                    src={category.image}
                    alt={`ภาพประกอบหมวด${category.name}`}
                    fill
                    placeholder="blur"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none"
                    referrerPolicy="no-referrer"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-navy-950/15" />
                  <span aria-hidden="true" className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-navy-950/40 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="absolute bottom-4 left-5 text-xs font-medium text-white/90">{category.location}</span>
                  <span className="absolute right-4 top-5 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold text-navy-900">{category.purpose}</span>
                </div>
                <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6">
                  <div className="mb-3 flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700 group-hover:bg-gold-100 group-focus-visible:bg-gold-100 motion-safe:transition-colors">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="pt-1 text-lg font-bold leading-snug text-navy-950 sm:text-xl">{category.name}</h3>
                  </div>
                  <p className="mb-5 text-sm leading-relaxed text-slate-500">{category.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">{realCount > 0 ? `${realCount} รายการเผยแพร่` : 'สำรวจรายการในหมวดนี้'}</span>
                    <span className="flex items-center gap-2 text-xs font-bold text-navy-800 group-hover:text-gold-700 group-focus-visible:text-gold-700">
                      <span>เลือกดู</span>
                      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white group-hover:border-gold-400 group-hover:bg-gold-400 group-hover:text-navy-950 group-focus-visible:border-gold-400 group-focus-visible:bg-gold-400 motion-safe:transition-colors">
                        <ArrowUpRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
