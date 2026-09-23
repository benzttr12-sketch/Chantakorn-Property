'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Filter, Building2 } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import { Property } from '@/lib/types';
import { fetchProperties } from '@/lib/store/properties-store';
import { DISTRICTS_LIST } from '@/data/locations';

export default function RentPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [maxRent, setMaxRent] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('any');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchProperties({
          status: 'rent',
          type: typeFilter === 'all' ? undefined : (typeFilter as any),
          district: districtFilter === 'all' ? undefined : districtFilter,
          maxPrice: maxRent ? Number(maxRent) : undefined,
          bedrooms: bedrooms === 'any' ? undefined : Number(bedrooms),
        });
        if (active) setProperties(data);
      } catch (err) {
        if (active) { setProperties([]); setError(err instanceof Error ? err.message : 'โหลดข้อมูลทรัพย์ไม่สำเร็จ'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [typeFilter, districtFilter, maxRent, bedrooms]);

  return (
    <div className="bg-surface-bg min-h-screen pb-20">
      {error && <p role="alert" className="mx-auto max-w-5xl rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Header Banner */}
      <div className="bg-navy-950 text-white py-12 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-gold-400 uppercase tracking-wider bg-navy-900 px-3.5 py-1 rounded-full border border-gold-500/30 mb-3">
              <Key className="w-3.5 h-3.5 text-gold-400" />
              <span>ทรัพย์สำหรับเช่า</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              เช่าบ้าน ทาวน์โฮม คอนโด หาดใหญ่–สงขลา
            </h1>
            <p className="text-gray-300 text-sm sm:text-base mt-2">
              บ้านและคอนโดปล่อยเช่า สภาพดี เฟอร์นิเจอร์ครบ พร้อมเข้าอยู่ ใกล้ ม.อ. เซ็นทรัล และย่านธุรกิจ
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-card flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">ประเภททรัพย์</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs text-navy-950 font-medium cursor-pointer"
            >
              <option value="all">ทุกประเภท</option>
              <option value="condo">คอนโดมิเนียม</option>
              <option value="house">บ้านเดี่ยว / ทาวน์โฮม</option>
              <option value="commercial">อาคารพาณิชย์ / ออฟฟิศ</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">ทำเลในสงขลา</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs text-navy-950 font-medium cursor-pointer"
            >
              <option value="all">ทุกทำเล</option>
              {DISTRICTS_LIST.map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">ค่าเช่าสูงสุด (บาท/เดือน)</label>
            <input
              type="number"
              placeholder="เช่น 15,000"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs text-navy-950"
            />
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">ห้องนอน</label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs text-navy-950 font-medium cursor-pointer"
            >
              <option value="any">ไม่ระบุ</option>
              <option value="1">1 ห้องนอนขึ้นไป</option>
              <option value="2">2 ห้องนอนขึ้นไป</option>
              <option value="3">3 ห้องนอนขึ้นไป</option>
            </select>
          </div>

          <div className="self-end">
            <button
              onClick={() => {
                setTypeFilter('all');
                setDistrictFilter('all');
                setMaxRent('');
                setBedrooms('any');
              }}
              className="py-2 px-4 text-xs font-semibold text-gray-600 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ล้างค่า
            </button>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm font-semibold text-navy-950">
            พบทรัพย์สำหรับเช่า <span className="text-gold-600 font-bold text-base">{properties.length}</span> รายการ
          </div>
          <Link
            href="/properties?status=rent"
            className="text-xs font-semibold text-navy-900 hover:text-gold-600 underline"
          >
            เปิดตัวกรองขั้นสูง
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-surface-border">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-navy-950 text-lg">ไม่พบทรัพย์สำหรับเช่าตามเงื่อนไขที่เลือก</h3>
            <p className="text-xs text-gray-500 mt-1">ท่านสามารถติดต่อแจ้งความต้องการกับทีมงานเพื่อจัดหาทรัพย์ที่ตรงใจได้ทันที</p>
            <Link
              href="/contact"
              className="mt-4 inline-block px-5 py-2.5 bg-navy-950 text-gold-400 font-bold text-xs rounded-xl"
            >
              ให้เราช่วยหาทรัพย์ให้คุณ
            </Link>
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
    </div>
  );
}
