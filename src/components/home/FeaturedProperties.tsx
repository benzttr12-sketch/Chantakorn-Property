'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Building, Home, Trees, Store, RotateCcw } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { Property } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';

const FEATURED_LIMIT = 3;

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
    return [...filtered.filter(property => property.featured), ...filtered.filter(property => !property.featured)].slice(0, FEATURED_LIMIT);
  }, [allProperties, activeCategory]);

  const totalMatches = categoryCounts.get(activeCategory) || 0;
  const activeLabel = FILTER_TABS.find(tab => tab.id === activeCategory)?.label || 'ทั้งหมด';

  return (
    <section id="home-properties" aria-labelledby="home-properties-title" className="relative scroll-mt-24 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-properties-title" className="border-l-[3px] border-[#b99b62] pl-4 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">
            ทรัพย์แนะนำ
          </h2>
          <Link href="/properties" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-navy-950 transition-colors hover:border-gold-300 hover:text-gold-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-4 md:self-auto">
            ดูทรัพย์ทั้งหมด<ArrowRight aria-hidden="true" className="h-4 w-4 text-gold-600" />
          </Link>
        </div>

        <div id="home-categories" role="group" aria-label="เลือกประเภททรัพย์" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 sm:text-sm ${isActive ? 'border-navy-950 bg-navy-950 text-[#efe3cb] shadow-sm' : 'border-[#e4ded1] bg-white/75 text-slate-600 hover:border-gold-300 hover:text-navy-950'}`}
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
          <p role="status" aria-live="polite" className="mb-4 text-xs leading-relaxed text-slate-600">
            {loading ? 'กำลังโหลดรายการทรัพย์…' : error ? 'ยังโหลดรายการทรัพย์ไม่ได้' : `${activeLabel} · ${totalMatches} รายการ${totalMatches > FEATURED_LIMIT ? ` · แสดง ${FEATURED_LIMIT} รายการ` : ''}`}
          </p>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map(index => <div key={index} className="h-[420px] rounded-3xl border border-slate-200 bg-slate-100 motion-safe:animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-100 bg-white p-8 text-center">
              <p role="alert" className="text-sm text-red-700">{error}</p>
              <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />ลองโหลดอีกครั้ง
              </button>
            </div>
          ) : displayedProperties.length === 0 ? (
            <div key={activeCategory} className="home-results-enter rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center">
              <div aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-700"><Home className="h-5 w-5" /></div>
              <h3 className="text-lg font-bold text-navy-950">{activeCategory === 'all' ? 'ยังไม่มีรายการทรัพย์ที่เปิดเผยแพร่' : `ยังไม่มี${activeLabel}ในขณะนี้`}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{activeCategory === 'all' ? 'คุณสามารถสอบถามทำเลและประเภททรัพย์ที่สนใจกับทีมงานได้' : 'ลองดูประเภทอื่น หรือกลับไปดูรายการทั้งหมดที่มีอยู่'}</p>
              {activeCategory !== 'all' ? (
                <button type="button" onClick={() => setActiveCategory('all')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
                  ดูรายการทั้งหมด<ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : (
                <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-gold-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">ปรึกษาทีมงาน<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              )}
            </div>
          ) : (
            <div key={activeCategory} className="home-results-enter grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {displayedProperties.map(property => <FeaturedCard key={property.id} property={property} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
