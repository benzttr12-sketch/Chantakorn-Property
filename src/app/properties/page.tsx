'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  SlidersHorizontal, 
  Map as MapIcon, 
  List, 
  ArrowUpDown, 
  Building2, 
  X,
  Search
} from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyFilterPanel from '@/components/properties/PropertyFilterPanel';
import PropertyMap from '@/components/properties/PropertyMap';
import { Property, PropertyFilters, PropertyType, PropertyStatus } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';

function filtersFromQuery(query: string): PropertyFilters {
  const params = new URLSearchParams(query);
  const types: PropertyType[] = ['house', 'land', 'condo', 'commercial', 'investment', 'consignment'];
  const numeric = (key: string) => {
    const raw = params.get(key);
    if (!raw || !raw.trim()) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  const type = params.get('type') as PropertyType;
  const status = params.get('status');
  return {
    type: types.includes(type) ? type : 'all',
    status: status === 'sale' || status === 'rent' ? status : 'all',
    district: params.get('district') || params.get('location') || '',
    minPrice: numeric('minPrice'), maxPrice: numeric('maxPrice'),
    bedrooms: numeric('bedrooms') ?? 'any', bathrooms: numeric('bathrooms') ?? 'any',
    searchQuery: params.get('searchQuery') || params.get('q') || '',
    features: [], sortBy: 'newest',
  };
}

function PropertiesContent() {
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  const [filters, setFilters] = useState<PropertyFilters>(() => filtersFromQuery(queryString));
  useEffect(() => { setFilters(filtersFromQuery(queryString)); }, [queryString]);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Mobile drawer states
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'map'>('list');

  // Load properties based on current filters
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchProperties(filters);
        if (active) { setProperties(data); setSelectedProperty(null); }
      } catch (err) {
        if (active) { setProperties([]); setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [filters]);

  // Sort properties
  const sortedProperties = useMemo(() => {
    const list = [...properties];
    if (filters.sortBy === 'price_asc') {
      return list.sort((a, b) => a.price - b.price);
    }
    if (filters.sortBy === 'price_desc') {
      return list.sort((a, b) => b.price - a.price);
    }
    if (filters.sortBy === 'popular') {
      return list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }
    // Default newest
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [properties, filters.sortBy]);

  const handleResetFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      district: '',
      minPrice: undefined,
      maxPrice: undefined,
      bedrooms: 'any',
      bathrooms: 'any',
      features: [],
      sortBy: 'newest',
      searchQuery: '',
    });
  };

  return (
    <div className="bg-surface-bg min-h-screen pb-20">
      {/* Top Banner / Search Context */}
      <div className="bg-navy-950 text-white py-8 border-b border-navy-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-1 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1" />
                หาดใหญ่ – สงขลา Real Estate Search
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                ค้นหาอสังหาริมทรัพย์
              </h1>
            </div>

            {/* Quick Text Search Bar */}
            <div className="relative max-w-md w-full">
              <input
                type="text"
                placeholder="ค้นหาชื่อโครงการ, ถนน, หรือทำเล เช่น เซ็นทรัล, ควนลัง..."
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full bg-navy-900 border border-navy-700 text-white text-xs sm:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-400"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, searchQuery: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Horizontal Scrollbar */}
          <div className="mt-5 pt-4 border-t border-navy-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-gray-400 text-xs font-semibold flex-shrink-0 mr-1">กรองด่วน:</span>

            {/* Status pills */}
            <button
              type="button"
              onClick={() => setFilters({ ...filters, status: 'all' })}
              className={`px-3 py-1.5 rounded-xl font-bold flex-shrink-0 transition-all ${
                filters.status === 'all'
                  ? 'bg-gold-500 text-navy-950 shadow-sm'
                  : 'bg-navy-900 text-gray-300 hover:bg-navy-800'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, status: 'sale' })}
              className={`px-3 py-1.5 rounded-xl font-bold flex-shrink-0 transition-all ${
                filters.status === 'sale'
                  ? 'bg-gold-500 text-navy-950 shadow-sm'
                  : 'bg-navy-900 text-gray-300 hover:bg-navy-800'
              }`}
            >
              สำหรับขาย
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, status: 'rent' })}
              className={`px-3 py-1.5 rounded-xl font-bold flex-shrink-0 transition-all ${
                filters.status === 'rent'
                  ? 'bg-gold-500 text-navy-950 shadow-sm'
                  : 'bg-navy-900 text-gray-300 hover:bg-navy-800'
              }`}
            >
              สำหรับเช่า
            </button>

            <span className="text-navy-700 mx-1 flex-shrink-0">|</span>

            {/* Popular property types */}
            {[
              { label: 'บ้านเดี่ยว/ทาวน์โฮม', val: 'house' },
              { label: 'คอนโดมิเนียม', val: 'condo' },
              { label: 'ที่ดิน', val: 'land' },
              { label: 'อาคารพาณิชย์', val: 'commercial' }
            ].map(item => (
              <button
                key={item.val}
                type="button"
                onClick={() => setFilters({ ...filters, type: filters.type === item.val ? 'all' : item.val as PropertyType })}
                className={`px-3 py-1.5 rounded-xl font-medium flex-shrink-0 transition-all ${
                  filters.type === item.val
                    ? 'bg-white text-navy-950 font-bold'
                    : 'bg-navy-900 text-gray-300 hover:bg-navy-800'
                }`}
              >
                {item.label}
              </button>
            ))}

            <span className="text-navy-700 mx-1 flex-shrink-0">|</span>

            {/* Popular districts */}
            {['หาดใหญ่', 'เมืองสงขลา', 'คลองหอยโข่ง', 'สะเดา'].map(dist => (
              <button
                key={dist}
                type="button"
                onClick={() => setFilters({ ...filters, district: filters.district === dist ? '' : dist })}
                className={`px-3 py-1.5 rounded-xl font-medium flex-shrink-0 transition-all ${
                  filters.district === dist
                    ? 'bg-gold-400 text-navy-950 font-bold'
                    : 'bg-navy-900 text-gray-300 hover:bg-navy-800'
                }`}
              >
                📍 {dist}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 3-Pane Container: [ FILTER (280px) | LISTINGS (Flexible) | MAP (380px) ] */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Mobile Control Bar */}
        <div className="lg:hidden flex items-center justify-between bg-white p-3 rounded-2xl border border-surface-border shadow-sm mb-4">
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-semibold rounded-xl"
          >
            <SlidersHorizontal className="w-4 h-4 text-gold-600" />
            <span>ตัวกรอง ({properties.length})</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMobileViewMode('list')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center space-x-1 ${
                mobileViewMode === 'list'
                  ? 'bg-navy-950 text-gold-400'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span>รายการ</span>
            </button>
            <button
              onClick={() => setMobileViewMode('map')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center space-x-1 ${
                mobileViewMode === 'map'
                  ? 'bg-navy-950 text-gold-400'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>แผนที่</span>
            </button>
          </div>
        </div>

        {/* Desktop 3-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PANE 1: LEFT FILTER PANEL (3 Cols) */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20">
              <PropertyFilterPanel
                filters={filters}
                onChange={setFilters}
                onReset={handleResetFilters}
                resultCount={sortedProperties.length}
              />
            </div>
          </aside>

          {/* PANE 2: CENTER PROPERTY LISTINGS (5 or 6 Cols) */}
          <section className={`lg:col-span-5 xl:col-span-5 ${mobileViewMode === 'map' ? 'hidden lg:block' : 'block'}`}>
            {/* Sorting & Results Header */}
            <div className="bg-white rounded-2xl p-4 border border-surface-border shadow-sm mb-4 flex items-center justify-between">
              <div className="text-xs sm:text-sm font-semibold text-navy-950">
                พบ <span className="text-gold-600 font-bold text-base">{sortedProperties.length}</span> รายการ
              </div>

              {/* Sort Selector */}
              <div className="flex items-center space-x-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500 hidden sm:inline">เรียงตาม:</span>
                <select
                  value={filters.sortBy || 'newest'}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as PropertyFilters['sortBy'] })}
                  className="text-xs font-semibold text-navy-950 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
                >
                  <option value="newest">ล่าสุด</option>
                  <option value="price_asc">ราคาต่ำ → สูง</option>
                  <option value="price_desc">ราคาสูง → ต่ำ</option>
                  <option value="popular">ยอดนิยม</option>
                </select>
              </div>
            </div>

            {/* Active Filters Bar */}
            {(filters.type !== 'all' || filters.status !== 'all' || filters.district || filters.minPrice || filters.maxPrice || filters.bedrooms !== 'any' || filters.searchQuery) && (
              <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-gray-200 mb-4 flex flex-wrap items-center gap-1.5 text-xs animate-in fade-in">
                <span className="text-[11px] text-gray-500 font-semibold mr-1">กำลังกรอง:</span>
                
                {filters.status !== 'all' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gold-100 text-gold-900 font-medium text-[11px]">
                    <span>{filters.status === 'rent' ? 'สำหรับเช่า' : 'สำหรับขาย'}</span>
                    <button type="button" onClick={() => setFilters({ ...filters, status: 'all' })} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.type !== 'all' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-medium text-[11px]">
                    <span>{filters.type}</span>
                    <button type="button" onClick={() => setFilters({ ...filters, type: 'all' })} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.district && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium text-[11px]">
                    <span>📍 {filters.district}</span>
                    <button type="button" onClick={() => setFilters({ ...filters, district: '' })} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.searchQuery && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 font-medium text-[11px]">
                    <span>ค้นหา: &quot;{filters.searchQuery}&quot;</span>
                    <button type="button" onClick={() => setFilters({ ...filters, searchQuery: '' })} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(filters.minPrice || filters.maxPrice) && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 font-medium text-[11px]">
                    <span>
                      ราคา: {filters.minPrice ? `${(filters.minPrice / 1000000).toFixed(1)}ลบ.` : '0'} - {filters.maxPrice ? `${(filters.maxPrice / 1000000).toFixed(1)}ลบ.` : 'ไม่จำกัด'}
                    </span>
                    <button type="button" onClick={() => setFilters({ ...filters, minPrice: undefined, maxPrice: undefined })} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-red-600 hover:underline font-bold ml-auto px-2 py-0.5"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            )}

            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            {/* Listings Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
                ))}
              </div>
            ) : sortedProperties.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-surface-border">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-navy-950 text-lg mb-1">ไม่พบอสังหาริมทรัพย์ที่ตรงกับเงื่อนไข</h3>
                <p className="text-xs text-gray-500 mb-5">ลองปรับตัวกรอง หรือค้นหาทำเลอื่นในหาดใหญ่-สงขลา</p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-navy-950 text-gold-400 text-xs font-semibold rounded-lg hover:bg-navy-900"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {sortedProperties.map((prop) => (
                  <div
                    key={prop.id}
                    onMouseEnter={() => setSelectedProperty(prop)}
                    className="transition-all"
                  >
                    <PropertyCard
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
                      slug={prop.slug}
                      createdAt={prop.created_at}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* PANE 3: RIGHT INTERACTIVE MAP (4 Cols) */}
          <aside className={`lg:col-span-4 xl:col-span-4 ${mobileViewMode === 'list' ? 'hidden lg:block' : 'block'}`}>
            <div className="sticky top-20 h-[580px] lg:h-[calc(100vh-100px)]">
              <PropertyMap
                properties={sortedProperties}
                selectedProperty={selectedProperty}
                onSelectProperty={(prop) => setSelectedProperty(prop)}
                height="100%"
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Slide-Out Filter Drawer Modal */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto p-5 shadow-2xl flex flex-col justify-between animate-fadeIn">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div className="flex items-center space-x-2 font-bold text-navy-950 text-base">
                  <SlidersHorizontal className="w-4 h-4 text-gold-600" />
                  <span>ตัวกรองการค้นหา</span>
                </div>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <PropertyFilterPanel
                filters={filters}
                onChange={setFilters}
                onReset={handleResetFilters}
                resultCount={sortedProperties.length}
              />
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6 sticky bottom-0 bg-white">
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-3 bg-navy-950 text-gold-400 rounded-xl font-bold text-sm shadow-md"
              >
                ดูผลการค้นหา ({sortedProperties.length} รายการ)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-navy-900 font-bold">กำลังโหลดข้อมูลการค้นหา...</div>}>
      <PropertiesContent />
    </Suspense>
  );
}
