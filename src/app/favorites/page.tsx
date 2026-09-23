'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Building2, Trash2, ArrowRight } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { Property } from '@/lib/types';
import { fetchProperties, getFavoriteIds } from '@/lib/store/properties-store';

export default function FavoritesPage() {
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFavorites = async () => {
    setLoading(true);
    setError('');
    try {
      const ids = getFavoriteIds();
      if (ids.length === 0) {
        setFavoriteProperties([]);
      } else {
        const all = await fetchProperties();
        const favs = all.filter((p) => ids.includes(p.id));
        setFavoriteProperties(favs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายการโปรดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();

    const handleUpdate = () => {
      loadFavorites();
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, []);

  const handleClearAll = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chantakorn_favorites', JSON.stringify([]));
        window.dispatchEvent(new Event('favorites-updated'));
      } catch { setError('เบราว์เซอร์ไม่อนุญาตให้แก้ไขรายการโปรด'); }
    }
  };

  return (
    <div className="bg-surface-bg min-h-screen pb-24">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Header Banner */}
      <div className="bg-navy-950 text-white py-12 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-gold-400 uppercase tracking-wider bg-navy-900 px-3.5 py-1 rounded-full border border-gold-500/30 mb-2">
                <Heart className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                <span>รายการโปรด</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white">
                ทรัพย์ที่บันทึกไว้
              </h1>
              <p className="text-gray-300 text-xs sm:text-sm mt-1">
                บันทึกรายการที่คุณสนใจเพื่อเปรียบเทียบหรือติดต่อสอบถามในภายหลัง
              </p>
            </div>

            {favoriteProperties.length > 0 && (
              <button
                onClick={handleClearAll}
                className="self-start sm:self-auto flex items-center space-x-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-gray-300 hover:text-red-400 rounded-xl text-xs font-semibold border border-navy-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายการทั้งหมด</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : favoriteProperties.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 sm:p-16 text-center border border-surface-border shadow-card max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-xl font-bold text-navy-950 mb-2">
              ยังไม่มีอสังหาริมทรัพย์ที่บันทึกไว้
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6 leading-relaxed">
              เมื่อคุณเจอทรัพย์ที่น่าสนใจในหาดใหญ่-สงขลา สามารถกดปุ่มไอคอนหัวใจเพื่อบันทึกเก็บไว้ดูในหน้านี้ได้ตลอดเวลา
            </p>
            <Link
              href="/properties"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-sm rounded-xl shadow-md transition-all"
            >
              <span>ค้นหาอสังหาริมทรัพย์เลย</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-6">
              บันทึกไว้ทั้งหมด <span className="text-navy-950 font-bold">{favoriteProperties.length}</span> รายการ
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteProperties.map((prop) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
