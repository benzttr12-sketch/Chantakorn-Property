'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Building2, Home, Trees, MapPin } from 'lucide-react';
import { catHatyaiLuxuryHouse, catHatyaiLuxuryCondo, catSongkhlaPrimeLand } from '@/assets/images';

const SCENES = [
  { id: 'house', label: 'บ้าน', icon: Home, image: catHatyaiLuxuryHouse, title: 'พื้นที่ของทุกความสุข', description: 'บ้านเดี่ยวและทาวน์โฮม สำหรับทุกจังหวะชีวิต', action: 'ค้นหาบ้านที่ใช่' },
  { id: 'land', label: 'ที่ดิน', icon: Trees, image: catSongkhlaPrimeLand, title: 'เริ่มต้นฝันบนที่ดินของคุณ', description: 'สำรวจที่ดินสำหรับสร้างบ้านหรือวางแผนอนาคต', action: 'สำรวจที่ดิน' },
  { id: 'condo', label: 'คอนโด', icon: Building2, image: catHatyaiLuxuryCondo, title: 'ชีวิตเมืองในแบบคุณ', description: 'ค้นหาคอนโดในทำเลที่เดินทางสะดวก', action: 'ค้นหาคอนโด' },
] as const;

export default function HomeMoodSelector() {
  const [selected, setSelected] = useState(0);
  const scene = SCENES[selected];

  return (
    <div className="home-mood-card relative min-w-0 rounded-[2rem] border border-white/20 bg-white/5 p-3 shadow-2xl backdrop-blur-sm sm:p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
        <span className="text-xs font-medium tracking-wide text-white/80">เริ่มจากสิ่งที่คุณกำลังมองหา</span>
        <span aria-hidden="true" className="font-mono text-xs text-gold-300">0{selected + 1} / 03</span>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-navy-900 sm:aspect-[6/5]">
        <Image key={scene.id} src={scene.image} alt={`ภาพประกอบการค้นหา${scene.label}ในหาดใหญ่–สงขลา`} fill priority={selected === 0} sizes="(max-width: 1023px) 90vw, 42vw" placeholder="blur" className="home-scene-enter object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/15 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-navy-950/40 px-3 py-1.5 text-[11px] text-white backdrop-blur-md">
          <MapPin size={12} aria-hidden="true" className="text-gold-300" /> หาดใหญ่ · สงขลา
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div aria-live="polite" aria-atomic="true" className="min-h-[76px]">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gold-300">YOUR NEXT CHAPTER</p>
            <h2 className="text-xl font-semibold leading-snug text-white sm:text-2xl">{scene.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-200">{scene.description}</p>
          </div>
          <Link href={`/properties?type=${scene.id}`} className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-300">
            {scene.action}<ArrowUpRight size={16} aria-hidden="true" className="text-gold-300" />
          </Link>
        </div>
      </div>
      <div role="group" aria-label="เลือกประเภททรัพย์ที่สนใจ" className="mt-3 grid grid-cols-3 gap-2">
        {SCENES.map((item, index) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`home-mood-option flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 ${selected === index ? 'border-gold-300 bg-gold-300 text-navy-950' : 'border-white/15 bg-white/5 text-white hover:bg-white/15'}`}><Icon size={15} aria-hidden="true" />{item.label}</button>;
        })}
      </div>
      <p className="mt-3 px-2 text-[10px] leading-relaxed text-slate-300">ภาพบรรยากาศตามประเภททรัพย์ · ดูรายการและภาพจริงในหน้าค้นหา</p>
    </div>
  );
}
