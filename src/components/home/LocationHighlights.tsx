import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';
import { LOCATIONS } from '@/data/locations';

export default function LocationHighlights() {
  return (
    <section className="py-16 md:py-24 bg-surface-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-gold-600 uppercase tracking-widest bg-gold-50 px-3.5 py-1 rounded-full border border-gold-200">
            พื้นที่ให้บริการ
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950 mt-3 mb-3">
            อสังหาริมทรัพย์ในหาดใหญ่–สงขลา
          </h2>
          <p className="text-brand-muted text-sm sm:text-base">
            สำรวจทรัพย์ในทำเลยอดนิยม ศูนย์กลางการค้า สถาบันการศึกษา และแหล่งที่อยู่อาศัยคุณภาพ
          </p>
        </div>

        {/* 6 Location Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LOCATIONS.map((loc) => (
            <Link
              key={loc.id}
              href={`/properties?district=${encodeURIComponent(loc.name)}`}
              className="group relative h-56 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover border border-surface-border transition-all duration-300 transform hover:-translate-y-1 block"
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
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-transparent group-hover:via-navy-950/50 transition-colors" />

              {/* Content Box */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                <div className="flex items-center space-x-1 text-gold-400 text-xs font-medium mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{loc.nameEn}</span>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-white group-hover:text-gold-300 transition-colors">
                    {loc.name}
                  </h3>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-gold-500 group-hover:text-navy-950 transition-all">
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <p className="text-xs text-gray-300 mt-2 line-clamp-1">
                  {loc.description}
                </p>

                <div className="mt-2 text-xs font-semibold text-gold-300">
                  {loc.propertyCount} ทรัพย์ที่เปิดขาย/ให้เช่า
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
