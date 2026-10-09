'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Building, Home, Trees, Store, MapPin, CalendarDays, Maximize, Bed, RotateCcw } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { propertyHref } from '@/components/properties/property-link';
import { Property } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';
import { formatThaiNumber, getPropertyTypeName } from '@/lib/utils';

const FILTER_TABS = [
  { id: 'all', label: 'ทั้งหมด', icon: null },
  { id: 'house', label: 'บ้าน / ทาวน์โฮม', icon: Home },
  { id: 'condo', label: 'คอนโด', icon: Building },
  { id: 'land', label: 'ที่ดิน', icon: Trees },
  { id: 'commercial', label: 'อาคารพาณิชย์', icon: Store },
];

function FeaturedCard({ property }: { property: Property }) {
  return (
    <PropertyCard
      id={property.id}
      title={property.title}
      type={property.property_type}
      status={property.status}
      price={property.price}
      location={property.address || `${property.district}, ${property.province}`}
      district={property.district}
      province={property.province}
      coverImage={property.cover_image}
      images={property.images}
      bedrooms={property.bedrooms}
      bathrooms={property.bathrooms}
      landSize={property.land_size}
      usableArea={property.usable_area}
      featured={property.featured}
      video_url={property.video_url}
      slug={property.slug}
      createdAt={property.created_at}
      facingDirection={property.facing_direction}
    />
  );
}

function PropertySpotlight({ property }: { property: Property }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
      <div className="min-w-0">
        <FeaturedCard property={property} />
      </div>
      <aside className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl bg-navy-950 p-7 text-white sm:p-10 lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-gold-400/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 rounded-full border border-gold-400/15" />
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-400/25 px-3 py-1.5 text-xs font-semibold text-gold-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {getPropertyTypeName(property.property_type)}ที่เปิดดูได้ตอนนี้
          </div>
          <h3 className="text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
            รู้จักทรัพย์นี้<br /><span className="text-gold-300">ให้มากขึ้น</span>
          </h3>
          <p className="mt-5 text-base font-semibold leading-relaxed text-slate-100">{property.title}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-slate-300">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            {[property.subdistrict, property.district, property.province].filter(Boolean).join(' · ')}
          </p>
          {(property.land_size > 0 || property.usable_area > 0 || property.bedrooms > 0) && (
            <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-4 border-y border-white/10 py-5">
              {property.land_size > 0 && (
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-xs text-slate-400"><Maximize aria-hidden="true" className="h-3.5 w-3.5" />พื้นที่ดิน</dt>
                  <dd className="text-base font-semibold text-white">{formatThaiNumber(property.land_size)} <span className="text-xs font-normal text-slate-300">ตร.ว.</span></dd>
                </div>
              )}
              {property.usable_area > 0 && (
                <div>
                  <dt className="mb-1 text-xs text-slate-400">พื้นที่ใช้สอย</dt>
                  <dd className="text-base font-semibold text-white">{formatThaiNumber(property.usable_area)} <span className="text-xs font-normal text-slate-300">ตร.ม.</span></dd>
                </div>
              )}
              {property.bedrooms > 0 && (
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-xs text-slate-400"><Bed aria-hidden="true" className="h-3.5 w-3.5" />ห้องนอน</dt>
                  <dd className="text-base font-semibold text-white">{property.bedrooms} <span className="text-xs font-normal text-slate-300">ห้อง</span></dd>
                </div>
              )}
            </dl>
          )}
        </div>
        <div className="relative mt-8">
          <p className="mb-5 max-w-sm text-sm leading-relaxed text-slate-300">ดูภาพ ทำเล และข้อมูลทรัพย์ให้ครบ แล้วส่งคำขอนัดชมในวันที่คุณสะดวก</p>
          <Link
            href={`${propertyHref(property)}#inquiry`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-300 px-5 py-3.5 text-sm font-bold text-navy-950 transition-colors hover:bg-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-navy-950 sm:w-auto"
          >
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            ส่งคำขอนัดชมทรัพย์นี้
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href={propertyHref(property)} className="mt-4 flex w-fit items-center gap-2 rounded text-xs font-semibold text-gold-200 underline decoration-gold-200/30 underline-offset-4 hover:decoration-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300">
            เปิดข้อมูลและภาพทรัพย์<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default function FeaturedProperties() {
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadProperties() {
      setLoading(true);
      setError('');
      try {
        const properties = await fetchProperties();
        if (active) setAllProperties(properties);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'โหลดข้อมูลทรัพย์ไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProperties();
    return () => { active = false; };
  }, [loadAttempt]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const property of allProperties) {
      counts.set(property.property_type, (counts.get(property.property_type) || 0) + 1);
    }
    counts.set('all', allProperties.length);
    return counts;
  }, [allProperties]);

  const displayedProperties = useMemo(() => {
    const filtered = activeCategory === 'all'
      ? allProperties
      : allProperties.filter(property => property.property_type === activeCategory);
    return [...filtered.filter(property => property.featured), ...filtered.filter(property => !property.featured)].slice(0, 6);
  }, [allProperties, activeCategory]);

  const totalMatches = categoryCounts.get(activeCategory) || 0;
  const activeLabel = FILTER_TABS.find(tab => tab.id === activeCategory)?.label || 'ทั้งหมด';

  return (
    <section id="home-properties" aria-labelledby="home-properties-title" className="relative scroll-mt-24 border-y border-slate-200/80 bg-[#FAFAFA] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-700">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              <span>EXPLORE YOUR NEXT CHAPTER</span>
            </div>
            <h2 id="home-properties-title" className="text-balance text-3xl font-black tracking-tight text-navy-950 sm:text-4xl lg:text-5xl">
              เริ่มต้นจากทรัพย์ที่ใช่
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              เลือกประเภทที่สนใจ เปิดดูภาพและรายละเอียด แล้วค่อยวางแผนนัดชมสถานที่จริง
            </p>
          </div>
          <Link href="/properties" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-navy-950 transition-colors hover:border-gold-300 hover:text-gold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-4 md:self-auto">
            ดูทรัพย์ทั้งหมด<ArrowRight aria-hidden="true" className="h-4 w-4 text-gold-600" />
          </Link>
        </div>

        <div role="group" aria-label="เลือกประเภททรัพย์" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {FILTER_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                aria-controls="home-property-results"
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 sm:text-sm ${isActive ? 'border-navy-950 bg-navy-950 text-gold-300 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-gold-300 hover:text-navy-950'}`}
              >
                {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 text-[11px] leading-5 ${isActive ? 'bg-white/10 text-gold-200' : 'bg-slate-100 text-slate-500'}`}>
                  {loading || error ? '—' : categoryCounts.get(tab.id) || 0}
                </span>
              </button>
            );
          })}
        </div>

        <div id="home-property-results" aria-busy={loading}>
          <p role="status" aria-live="polite" className="mb-6 text-xs leading-relaxed text-slate-500">
            {loading ? 'กำลังโหลดรายการทรัพย์…' : error ? 'ยังโหลดรายการทรัพย์ไม่ได้' : `${activeLabel} · ${totalMatches} รายการ${totalMatches > 6 ? ' · แสดง 6 รายการแรก' : ''}`}
          </p>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map(index => <div key={index} className="h-[420px] rounded-3xl border border-slate-200 bg-slate-100 motion-safe:animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-100 bg-white p-8 text-center">
              <p role="alert" className="text-sm text-red-700">{error}</p>
              <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />ลองโหลดอีกครั้ง
              </button>
            </div>
          ) : displayedProperties.length === 0 ? (
            <div key={activeCategory} className="home-results-enter rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center">
              <div aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-700"><Home className="h-5 w-5" /></div>
              <h3 className="text-lg font-bold text-navy-950">{activeCategory === 'all' ? 'ยังไม่มีรายการทรัพย์ที่เปิดเผยแพร่' : `ยังไม่มี${activeLabel}ในขณะนี้`}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{activeCategory === 'all' ? 'คุณสามารถสอบถามทำเลและประเภททรัพย์ที่สนใจกับทีมงานได้' : 'ลองดูประเภทอื่น หรือกลับไปดูรายการทั้งหมดที่มีอยู่'}</p>
              {activeCategory !== 'all' ? (
                <button type="button" onClick={() => setActiveCategory('all')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
                  ดูรายการทั้งหมด<ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : (
                <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">ปรึกษาทีมงาน<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              )}
            </div>
          ) : (
            <div key={activeCategory} className="home-results-enter">
              {displayedProperties.length === 1 ? <PropertySpotlight property={displayedProperties[0]} /> : (
                <div className={`grid gap-6 sm:grid-cols-2 lg:gap-8 ${displayedProperties.length > 2 ? 'lg:grid-cols-3' : ''}`}>
                  {displayedProperties.map(property => <FeaturedCard key={property.id} property={property} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
