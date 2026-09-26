'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image, { StaticImageData } from 'next/image';
import { MapPin, ArrowRight, Compass } from 'lucide-react';
import { LOCATIONS } from '@/data/locations';
import { fetchProperties } from '@/lib/store/properties-store';
import {
  hatyaiCitySkyline,
  coastalSongkhlaVilla,
  villaModernEstate,
  penthouseLivingRoom,
  heroLuxuryMansion
} from '@/assets/images';

const LOCATION_IMAGE_MAP: Record<string, StaticImageData> = {
  'hatyai-central': hatyaiCitySkyline,
  'mueang-songkhla': coastalSongkhlaVilla,
  'khuan-lang': villaModernEstate,
  'khlong-hae': penthouseLivingRoom,
  'ban-phru': heroLuxuryMansion,
  'sadao-border': hatyaiCitySkyline,
  'singhanakhon': coastalSongkhlaVilla,
  'rattaphum': villaModernEstate,
};

export default function LocationHighlights() {
  const [districtCounts, setDistrictCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadCounts() {
      try {
        const props = await fetchProperties();
        const map: Record<string, number> = {};
        props.forEach((p) => {
          if (p.district) {
            map[p.district] = (map[p.district] || 0) + 1;
          }
        });
        setDistrictCounts(map);
      } catch {
        // Fallback
      }
    }
    loadCounts();
  }, []);

  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA] border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-gold-700 uppercase tracking-widest mb-3">
              <Compass className="w-3.5 h-3.5 text-gold-600" />
              <span>PRIME LOCATIONS IN SONGKHLA</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-950 tracking-tight text-balance">
              ทำเลศักยภาพที่น่าจับตามอง
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2.5 max-w-2xl leading-relaxed">
              สำรวจอสังหาริมทรัพย์ในทำเลทองของหาดใหญ่–สงขลา ทั้งศูนย์กลางการแพทย์ มหาวิทยาลัย แหล่งช้อปปิ้ง และชายฝั่งทะเล
            </p>
          </div>

          <Link
            href="/properties"
            className="inline-flex items-center space-x-2 text-xs sm:text-sm font-bold text-navy-950 hover:text-gold-600 transition-colors group self-start md:self-auto bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs hover:border-gold-300"
          >
            <span>ดูทุกทำเลในสงขลา</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform text-gold-500" />
          </Link>
        </div>

        {/* Bento Grid: 2 Hero Cards + 4 Standard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {LOCATIONS.slice(0, 6).map((loc, idx) => {
            const count = districtCounts[loc.district] || 0;
            const isFeatured = idx === 0 || idx === 1;
            const localImg = LOCATION_IMAGE_MAP[loc.id] || hatyaiCitySkyline;

            return (
              <Link
                key={loc.id}
                href={`/properties?district=${encodeURIComponent(loc.name)}`}
                className={`group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl border border-slate-200/80 hover:border-gold-400/60 transition-all duration-500 transform hover:-translate-y-1.5 block bg-navy-950 ${
                  isFeatured ? 'h-80 sm:h-96' : 'h-72 sm:h-80'
                }`}
              >
                {/* Location Image */}
                <Image
                  src={localImg}
                  alt={loc.name}
                  fill
                  placeholder="blur"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-108 transition-transform duration-700 ease-out opacity-85 group-hover:opacity-95"
                  referrerPolicy="no-referrer"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-[#020812]/50 to-transparent group-hover:via-[#020812]/40 transition-colors" />

                {/* Top Badge */}
                <div className="absolute top-5 left-5 z-10">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg border border-white/20 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-gold-400" />
                    <span>{loc.nameEn}</span>
                  </span>
                </div>

                {count > 0 && (
                  <div className="absolute top-5 right-5 z-10">
                    <span className="px-3 py-1 bg-gold-400 text-navy-950 text-xs font-black rounded-lg shadow-md">
                      {count} ทรัพย์พร้อมโอน
                    </span>
                  </div>
                )}

                {/* Content Box */}
                <div className="absolute inset-0 p-6 sm:p-7 flex flex-col justify-end z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl sm:text-3xl font-black text-white group-hover:text-gold-300 transition-colors tracking-tight">
                      {loc.name}
                    </h3>
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-gold-400 group-hover:text-navy-950 transition-all shadow-md">
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 mt-2 line-clamp-2 font-normal leading-relaxed">
                    {loc.description}
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
