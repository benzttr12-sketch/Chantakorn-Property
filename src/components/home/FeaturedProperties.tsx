'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { Property } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';

export default function FeaturedProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFeatured() {
      try {
        const all = await fetchProperties();
        // Take top 6 properties (prioritize featured: true)
        const featured = all.filter(p => p.featured);
        const nonFeatured = all.filter(p => !p.featured);
        const combined = [...featured, ...nonFeatured].slice(0, 6);
        setProperties(combined);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'โหลดข้อมูลทรัพย์ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-white border-y border-surface-border">
      {error && <p role="alert" className="mx-auto max-w-5xl rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with View All CTA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-gold-600 uppercase tracking-widest bg-gold-50 px-3.5 py-1 rounded-full border border-gold-200 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" />
              <span>คัดสรรพิเศษ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950">
              ทรัพย์เด่นที่คัดสรรมาให้คุณ
            </h2>
            <p className="text-brand-muted text-sm sm:text-base mt-2">
              อสังหาริมทรัพย์น่าสนใจจาก Chantakorn Property ตรวจสอบเอกสารสิทธิ์และความถูกต้องแล้วทุกรายการ
            </p>
          </div>

          <Link
            href="/properties"
            className="mt-4 md:mt-0 inline-flex items-center space-x-2 text-sm font-semibold text-navy-900 hover:text-gold-600 transition-colors group"
          >
            <span>ดูอสังหาริมทรัพย์ทั้งหมด</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform text-gold-500" />
          </Link>
        </div>

        {/* 6 Property Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((prop) => (
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
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
