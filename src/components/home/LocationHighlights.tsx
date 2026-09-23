'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';
import { LOCATIONS } from '@/data/locations';
import { fetchProperties } from '@/lib/store/properties-store';

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
    <section className="py-16 md:py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold mb-3">
            <span>ทำเลศักยภาพ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-navy-950 tracking-tight">
            อสังหาริมทรัพย์ในหาดใหญ่–สงขลา
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-2">
            สำรวจทรัพย์ในทำเลยอดนิยม ศูนย์กลางการค้า สถาบันการศึกษา และแหล่งที่อยู่อาศัยคุณภาพ
          </p>
        </div>

        {/* 6 Location Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LOCATIONS.map((loc) => {
            const count = districtCounts[loc.district] || 0;
            return (
              <Link
                key={loc.id}
                href={`/properties?district=${encodeURIComponent(loc.name)}`}
                className="group relative h-60 rounded-3xl overflow-hidden shadow-md hover:shadow-2xl border border-slate-200/80 hover:border-gold-400/50 transition-all duration-300 transform hover:-translate-y-1 block"
              >
                {/* Location Image */}
                <Image
                  src={loc.image}
                  alt={loc.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020812] via-[#020812]/50 to-transparent group-hover:via-[#020812]/60 transition-colors" />

                {/* Content Box */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                  <div className="flex items-center space-x-1 text-gold-400 text-xs font-bold mb-1">
                    <MapPin className="w-3.5 h-3.5 text-gold-400" />
                    <span>{loc.nameEn}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-white group-hover:text-gold-300 transition-colors">
                      {loc.name}
                    </h3>
                    <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-gold-400 group-hover:text-navy-950 transition-all">
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-1.5 line-clamp-1 font-normal">
                    {loc.description}
                  </p>

                  <div className="mt-2 text-xs font-bold text-gold-300">
                    {count > 0 ? `${count} ทรัพย์ที่เปิดขายจริง` : 'สำรวจทำเลนี้'}
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
