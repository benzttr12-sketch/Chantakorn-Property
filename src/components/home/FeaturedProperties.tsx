'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Building, Home, Trees, Store } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { Property } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';

const FILTER_TABS = [
  { id: 'all', label: 'ทั้งหมด', icon: null },
  { id: 'house', label: 'บ้านเดี่ยว / ทาวน์โฮม', icon: Home },
  { id: 'condo', label: 'คอนโดมิเนียม', icon: Building },
  { id: 'land', label: 'ที่ดิน', icon: Trees },
  { id: 'commercial', label: 'อาคารพาณิชย์', icon: Store },
];

export default function FeaturedProperties() {
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProperties() {
      try {
        const all = await fetchProperties();
        setAllProperties(all);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'โหลดข้อมูลทรัพย์ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }
    loadProperties();
  }, []);

  const displayedProperties = useMemo(() => {
    let filtered = allProperties;
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.property_type === activeCategory);
    }
    // Prioritize featured properties
    const featured = filtered.filter(p => p.featured);
    const nonFeatured = filtered.filter(p => !p.featured);
    return [...featured, ...nonFeatured].slice(0, 6);
  }, [allProperties, activeCategory]);

  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA] border-y border-slate-200/80 relative">
      {error && <p role="alert" className="mx-auto max-w-5xl rounded-2xl bg-red-50 p-4 text-sm text-red-700 mb-6">{error}</p>}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-gold-700 uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" />
              <span>HANDPICKED EXCLUSIVE PORTFOLIO</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-950 tracking-tight text-balance">
              อสังหาริมทรัพย์คัดสรรพิเศษ
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2.5 max-w-2xl leading-relaxed">
              ทรัพย์เด่นทำเลทองในหาดใหญ่และสงขลา คัดกรองและตรวจสอบความถูกต้องของโฉนดแล้ว 100%
            </p>
          </div>

          <Link
            href="/properties"
            className="inline-flex items-center space-x-2 text-xs sm:text-sm font-bold text-navy-950 hover:text-gold-600 transition-colors group self-start md:self-auto bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs hover:border-gold-300"
          >
            <span>สำรวจอสังหาฯ ทั้งหมด</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform text-gold-500" />
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-10 no-scrollbar">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-navy-950 text-gold-400 border-navy-950 shadow-md ring-1 ring-gold-400/30'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                }`}
              >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-gold-400' : 'text-slate-500'}`} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 6 Property Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl h-[420px] animate-pulse border border-slate-200 shadow-sm" />
            ))}
          </div>
        ) : displayedProperties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <p className="text-slate-500 text-sm">ไม่พบอสังหาริมทรัพย์ในหมวดหมู่นี้ในขณะนี้</p>
            <button
              onClick={() => setActiveCategory('all')}
              className="mt-4 px-5 py-2 bg-navy-950 text-gold-400 font-bold text-xs rounded-xl"
            >
              ดูรายการทั้งหมด
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayedProperties.map((prop) => (
              <PropertyCard
                key={prop.id}
                id={prop.id}
                title={prop.title}
                type={prop.property_type}
                status={prop.status}
                price={prop.price}
                location={prop.address || `${prop.district}, ${prop.province}`}
                district={prop.district}
                province={prop.province}
                coverImage={prop.cover_image}
                images={prop.images}
                bedrooms={prop.bedrooms}
                bathrooms={prop.bathrooms}
                landSize={prop.land_size}
                usableArea={prop.usable_area}
                featured={prop.featured}
                video_url={prop.video_url}
                slug={prop.slug}
                createdAt={prop.created_at}
                facingDirection={prop.facing_direction}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
