'use client';

import React, { useState, useEffect, useMemo, useDeferredValue, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  SlidersHorizontal, 
  Map as MapIcon, 
  List, 
  ArrowUpDown, 
  Building2, 
  X,
  Search,
  RotateCcw
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
  const deferredFilters = useDeferredValue(filters);

  // Load properties based on current filters
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchProperties(deferredFilters);
        if (active) { setProperties(data); setSelectedProperty(null); }
      } catch (err) {
        if (active) { setProperties([]); setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [deferredFilters]);

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

  const activeFilters = [
    filters.status === 'sale' ? { key: 'status', label: 'สำหรับขาย' } : null,
    filters.status === 'rent' ? { key: 'status', label: 'สำหรับเช่า' } : null,
    filters.type && filters.type !== 'all'
      ? { key: 'type', label: ({ house: 'บ้าน', land: 'ที่ดิน', condo: 'คอนโด', commercial: 'อาคารพาณิชย์', investment: 'ลงทุน', consignment: 'ขายฝาก / จำนอง' } as Record<PropertyType, string>)[filters.type] }
      : null,
    filters.district ? { key: 'district', label: 'อำเภอ ' + filters.district } : null,
    filters.searchQuery ? { key: 'searchQuery', label: '“' + filters.searchQuery + '”' } : null,
    filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? { key: 'price', label: (filters.minPrice !== undefined ? '≥ ' + filters.minPrice.toLocaleString() : 'ทุกงบ') + (filters.maxPrice !== undefined ? ' – ' + filters.maxPrice.toLocaleString() + ' บาท' : ' บาท') }
      : null,
    typeof filters.bedrooms === 'number' ? { key: 'bedrooms', label: filters.bedrooms + '+ ห้องนอน' } : null,
    typeof filters.bathrooms === 'number' ? { key: 'bathrooms', label: filters.bathrooms + '+ ห้องน้ำ' } : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));

  const clearFilter = (key: string) => {
    if (key === 'price') {
      setFilters({ ...filters, minPrice: undefined, maxPrice: undefined });
      return;
    }
    if (key === 'status') setFilters({ ...filters, status: 'all' });
    else if (key === 'type') setFilters({ ...filters, type: 'all' });
    else if (key === 'district') setFilters({ ...filters, district: '' });
    else if (key === 'searchQuery') setFilters({ ...filters, searchQuery: '' });
    else if (key === 'bedrooms') setFilters({ ...filters, bedrooms: 'any' });
    else if (key === 'bathrooms') setFilters({ ...filters, bathrooms: 'any' });
  };

  return (
    <main className="bg-surface-bg min-h-screen pb-20">
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
              <label className="sr-only" htmlFor="property-keyword-search">ค้นหาชื่อโครงการ ถนน หรือทำเล</label>
              <input
                id="property-keyword-search"
                type="search"
                placeholder="ค้นหาชื่อโครงการ, ถนน, หรือทำเล เช่น เซ็นทรัล, ควนลัง..."
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full bg-navy-900 border border-navy-700 text-white text-xs sm:text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-400"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, searchQuery: '' })}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-navy-800 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Container: [ FILTER (280px) | LISTINGS (Flexible) | MAP (380px) ] */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeFilters.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50/70 p-3">
            <span className="px-2 text-xs font-bold text-navy-950">เงื่อนไขที่เลือก</span>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => clearFilter(filter.key)}
                className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-white px-2.5 py-1 text-xs font-medium text-navy-950 hover:border-gold-500 hover:bg-gold-100"
              >
                {filter.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto inline-flex items-center gap-1 px-2 text-xs font-semibold text-brand-muted hover:text-navy-950"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              ล้างทั้งหมด
            </button>
          </div>
        )}
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
            <div className="bg-white rounded-2xl p-4 border border-surface-border shadow-sm mb-5 flex items-center justify-between">
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
    </main>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-navy-900 font-bold">กำลังโหลดข้อมูลการค้นหา...</div>}>
      <PropertiesContent />
    </Suspense>
  );
}
