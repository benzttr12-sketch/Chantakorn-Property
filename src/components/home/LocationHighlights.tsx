'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image, { StaticImageData } from 'next/image';
import { MapPin, ArrowUpRight, ArrowLeft, ArrowRight, Compass, Check } from 'lucide-react';
import { LOCATIONS } from '@/data/locations';
import { fetchProperties } from '@/lib/store/properties-store';
import {
  hatyaiCityLandmark,
  songkhlaSamilaMermaid,
  sadaoBorderTown,
  khuanlangAirportGateway,
  khlonghaeFloatingMarket,
  banphruPruPark,
} from '@/assets/images';

const LOCATIONS_TO_EXPLORE = LOCATIONS.slice(0, 6);

const LOCATION_IMAGE_MAP: Record<string, StaticImageData> = {
  'hatyai-central': hatyaiCityLandmark,
  'mueang-songkhla': songkhlaSamilaMermaid,
  'sadao-border': sadaoBorderTown,
  'khuan-lang': khuanlangAirportGateway,
  'khlong-hae': khlonghaeFloatingMarket,
  'ban-phru': banphruPruPark,
};

const LANDMARK_NAME_MAP: Record<string, string> = {
  'hatyai-central': 'เขาคอหงส์ · หาดใหญ่',
  'mueang-songkhla': 'หาดสมิหลา · เมืองสงขลา',
  'sadao-border': 'ด่านสะเดา · ด่านนอก',
  'khuan-lang': 'ท่าอากาศยานหาดใหญ่ · ควนลัง',
  'khlong-hae': 'ตลาดน้ำคลองแห',
  'ban-phru': 'สวนสาธารณะพรุค้างคาว · บ้านพรุ',
};

const NEIGHBORHOOD_SEARCH: Record<string, string> = {
  'khuan-lang': 'ควนลัง',
  'khlong-hae': 'คลองแห',
  'ban-phru': 'บ้านพรุ',
};

function locationHref(location: typeof LOCATIONS[number]) {
  const params = new URLSearchParams({ district: location.district });
  const neighborhood = NEIGHBORHOOD_SEARCH[location.id];
  if (neighborhood) params.set('q', neighborhood);
  return `/properties?${params.toString()}`;
}

export default function LocationHighlights() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [locationCounts, setLocationCounts] = useState<Record<string, number> | null>(null);
  const [countError, setCountError] = useState(false);
  const selected = LOCATIONS_TO_EXPLORE[selectedIndex];

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      try {
        const properties = await fetchProperties();
        const counts: Record<string, number> = {};
        LOCATIONS_TO_EXPLORE.forEach((location) => {
          const neighborhood = NEIGHBORHOOD_SEARCH[location.id];
          counts[location.id] = properties.filter((property) => {
            if (!property.district.toLowerCase().includes(location.district.toLowerCase())) return false;
            if (!neighborhood) return true;
            return [property.title, property.description, property.province, property.district, property.subdistrict]
              .some((value) => (value || '').toLowerCase().includes(neighborhood.toLowerCase()));
          }).length;
        });
        if (active) setLocationCounts(counts);
      } catch {
        if (active) setCountError(true);
      }
    }
    void loadCounts();
    return () => { active = false; };
  }, []);

  const selectedCount = locationCounts?.[selected.id];
  const countLabel = countError
    ? 'เปิดรายการเพื่อตรวจสอบทรัพย์'
    : selectedCount === undefined
      ? 'กำลังตรวจสอบรายการทรัพย์…'
      : selectedCount > 0
        ? `${selectedCount} รายการเผยแพร่ในทำเลนี้`
        : 'ยังไม่มีประกาศในทำเลนี้';

  function moveLocation(delta: number) {
    setSelectedIndex((current) => (current + delta + LOCATIONS_TO_EXPLORE.length) % LOCATIONS_TO_EXPLORE.length);
  }

  return (
    <section id="home-locations" aria-labelledby="home-locations-title" className="relative scroll-mt-28 border-b border-slate-200/80 bg-[#F7F8FA] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-gold-700">
              <Compass aria-hidden="true" className="h-4 w-4" />
              <span>EXPLORE THE NEIGHBORHOOD</span>
            </div>
            <h2 id="home-locations-title" className="text-balance text-3xl font-black tracking-tight text-navy-950 sm:text-4xl lg:text-5xl">
              เลือกย่าน แล้วสัมผัสบรรยากาศ
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              แตะเลือกทำเลเพื่อดูบรรยากาศและจุดเด่น ก่อนเปิดรายการทรัพย์ในย่านที่สนใจ
            </p>
          </div>
          <Link
            href="/properties"
            className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 self-start rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-navy-900 outline-none hover:border-gold-400 hover:text-gold-700 focus-visible:ring-4 focus-visible:ring-gold-200 motion-safe:transition-colors md:self-auto"
          >
            <span>สำรวจทุกทำเล</span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-card lg:grid-cols-[minmax(0,1fr)_340px]">
          <div id="home-location-preview" role="region" aria-label="ตัวอย่างบรรยากาศทำเลที่เลือก" className="relative isolate min-h-[470px] overflow-hidden bg-navy-950 sm:min-h-[520px]">
            {LOCATIONS_TO_EXPLORE.map((location, index) => (
              <div
                key={location.id}
                aria-hidden={selectedIndex !== index}
                className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 motion-reduce:transition-none ${selectedIndex === index ? 'opacity-100' : 'opacity-0'}`}
              >
                <Image
                  src={LOCATION_IMAGE_MAP[location.id]}
                  alt={`บรรยากาศ${LANDMARK_NAME_MAP[location.id]}`}
                  fill
                  placeholder="blur"
                  sizes="(max-width: 1024px) 100vw, 65vw"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/25 to-navy-950/20" />

            <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3 sm:inset-x-8 sm:top-8">
              <span className="flex max-w-[75%] items-center gap-2 rounded-full border border-white/25 bg-navy-950/30 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-md">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-gold-300" />
                <span>{LANDMARK_NAME_MAP[selected.id]}</span>
              </span>
              <span aria-hidden="true" className="pt-2 text-xs font-medium tabular-nums text-white/80">
                {String(selectedIndex + 1).padStart(2, '0')} / {String(LOCATIONS_TO_EXPLORE.length).padStart(2, '0')}
              </span>
            </div>

            <div className="relative flex min-h-[470px] flex-col justify-end p-6 sm:min-h-[520px] sm:p-8 lg:p-10">
              <div className="mb-7 max-w-xl" aria-live="polite" aria-atomic="true">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gold-300">{selected.nameEn}</p>
                <h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{selected.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">{selected.description}</p>
                <p className="mt-4 text-xs font-medium text-gold-200">{countLabel}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href={locationHref(selected)}
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-gold-400 px-5 py-3 text-sm font-bold text-navy-950 outline-none hover:bg-gold-300 focus-visible:ring-4 focus-visible:ring-white/80 motion-safe:transition-colors"
                >
                  <span>ดูทรัพย์ใน{selected.name}</span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
                </Link>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="เลือกทำเลก่อนหน้า" onClick={() => moveLocation(-1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-navy-950/20 text-white outline-none hover:bg-white hover:text-navy-950 focus-visible:ring-4 focus-visible:ring-gold-300 motion-safe:transition-colors">
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="เลือกทำเลถัดไป" onClick={() => moveLocation(1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-navy-950/20 text-white outline-none hover:bg-white hover:text-navy-950 focus-visible:ring-4 focus-visible:ring-gold-300 motion-safe:transition-colors">
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 lg:p-7">
            <div className="mb-4 flex items-center justify-between gap-3 lg:mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-navy-800">เลือกทำเลที่สนใจ</p>
              <span className="text-[11px] text-slate-400">แตะเพื่อสำรวจ</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1" role="group" aria-label="ทำเลในหาดใหญ่และสงขลา">
              {LOCATIONS_TO_EXPLORE.map((location, index) => {
                const isSelected = selectedIndex === index;
                const count = locationCounts?.[location.id];
                return (
                  <button
                    type="button"
                    key={location.id}
                    aria-pressed={isSelected}
                    aria-controls="home-location-preview"
                    onClick={() => setSelectedIndex(index)}
                    className={`group flex min-h-[84px] items-center gap-3 rounded-2xl border p-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-gold-200 motion-safe:transition-colors lg:min-h-[72px] ${isSelected ? 'border-navy-800 bg-navy-800 text-white shadow-card' : 'border-slate-100 bg-slate-50 text-navy-950 hover:border-gold-300 hover:bg-gold-50'}`}
                  >
                    <span aria-hidden="true" className={`hidden shrink-0 text-[10px] font-medium tabular-nums sm:block ${isSelected ? 'text-gold-300' : 'text-slate-400'}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-snug sm:text-sm">{location.name}</span>
                      <span className={`mt-1 block text-[10px] leading-snug ${isSelected ? 'text-white/65' : 'text-slate-500'}`}>
                        {count !== undefined && count > 0 ? `${count} รายการเผยแพร่` : location.nameEn}
                      </span>
                    </span>
                    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-gold-400 text-navy-950' : 'text-slate-400'}`}>
                      {isSelected ? <Check className="h-3 w-3" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
