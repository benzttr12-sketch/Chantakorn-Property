'use client';

import React from 'react';
import { 
  Filter, 
  RotateCcw, 
  Home, 
  Tag, 
  MapPin, 
  Coins, 
  Bed, 
  Bath, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { PropertyFilters, PropertyType, PropertyStatus } from '@/lib/types';
import { DISTRICTS_LIST } from '@/data/locations';

interface FilterPanelProps {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  onReset: () => void;
  resultCount: number;
}

export default function PropertyFilterPanel({
  filters,
  onChange,
  onReset,
  resultCount,
}: FilterPanelProps) {
  const propertyTypes: { label: string; value: PropertyType | 'all' }[] = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'บ้านเดี่ยว / ทาวน์โฮม', value: 'house' },
    { label: 'ที่ดิน', value: 'land' },
    { label: 'คอนโดมิเนียม', value: 'condo' },
    { label: 'อาคารพาณิชย์', value: 'commercial' },
    { label: 'อสังหาฯ ลงทุน', value: 'investment' },
    { label: 'ขายฝาก / จำนอง', value: 'consignment' },
  ];

  const statuses: { label: string; value: PropertyStatus | 'all' }[] = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'สำหรับขาย', value: 'sale' },
    { label: 'สำหรับเช่า', value: 'rent' },
  ];

  const amenityOptions = [
    'เครื่องปรับอากาศ',
    'ที่จอดรถส่วนตัว',
    'สวนหย่อมส่วนตัว',
    'สระว่ายน้ำ',
    'ห้องครัวบิวท์อิน',
    'กล้องวงจรปิด CCTV',
    'ติดถนนใหญ่',
    'ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)',
    'ใกล้สนามบินหาดใหญ่',
    'ใกล้เซ็นทรัลหาดใหญ่',
    'ระบบรักษาความปลอดภัย 24 ชม.',
  ];

  const handleTypeChange = (type: PropertyType | 'all') => {
    onChange({ ...filters, type });
  };

  const handleStatusChange = (status: PropertyStatus | 'all') => {
    onChange({ ...filters, status });
  };

  const handleDistrictChange = (district: string) => {
    onChange({ ...filters, district: district === 'all' ? '' : district });
  };

  const handleBedroomsChange = (val: string) => {
    onChange({ ...filters, bedrooms: val === 'any' ? 'any' : Number(val) });
  };

  const handleBathroomsChange = (val: string) => {
    onChange({ ...filters, bathrooms: val === 'any' ? 'any' : Number(val) });
  };

  const handleAmenityToggle = (amenity: string) => {
    const current = filters.features || [];
    const exists = current.includes(amenity);
    const updated = exists
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    onChange({ ...filters, features: updated });
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card space-y-6">
      {/* Filter Header & Reset */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-2 text-navy-950 font-bold text-base">
          <Filter className="w-4 h-4 text-gold-600" />
          <span>ตัวกรองการค้นหา</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-brand-muted hover:text-navy-900 flex items-center space-x-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>ล้างค่า</span>
        </button>
      </div>

      {/* 1. Status: ขาย / เช่า */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <Tag className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          สถานะ
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl">
          {statuses.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => handleStatusChange(st.value)}
              className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all ${
                (filters.status || 'all') === st.value
                  ? 'bg-navy-950 text-gold-400 shadow-sm'
                  : 'text-gray-600 hover:text-navy-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Property Type */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <Home className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          ประเภทอสังหาริมทรัพย์
        </label>
        <div className="space-y-1">
          {propertyTypes.map((pt) => {
            const isSelected = (filters.type || 'all') === pt.value;
            return (
              <button
                key={pt.value}
                type="button"
                onClick={() => handleTypeChange(pt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-gold-50 text-navy-950 font-bold border border-gold-300'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{pt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-gold-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Location / District */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <MapPin className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          ทำเลในสงขลา
        </label>
        <select
          value={filters.district || 'all'}
          onChange={(e) => handleDistrictChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-all cursor-pointer"
        >
          <option value="all">ทุกทำเลในสงขลา</option>
          {DISTRICTS_LIST.map((dist) => (
            <option key={dist} value={dist}>
              {dist}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Price Range */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <Coins className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          ช่วงราคา (บาท)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
              min="0"
            placeholder="ราคาต่ำสุด"
            value={filters.minPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <input
            type="number"
              min="0"
            placeholder="ราคาสูงสุด"
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>
      </div>

      {/* 5. Bedrooms */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <Bed className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          ห้องนอน
        </label>
        <div className="grid grid-cols-5 gap-1">
          {['any', '1', '2', '3', '4+'].map((val) => {
            const rawVal = val === '4+' ? '4' : val;
            const isSelected =
              val === 'any'
                ? !filters.bedrooms || filters.bedrooms === 'any'
                : String(filters.bedrooms) === rawVal;

            return (
              <button
                key={val}
                type="button"
                onClick={() => handleBedroomsChange(rawVal)}
                className={`py-1.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'bg-navy-950 text-gold-400 border-navy-950 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {val === 'any' ? 'ไม่ระบุ' : val}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Bathrooms */}
      <div>
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2 flex items-center">
          <Bath className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
          ห้องน้ำ
        </label>
        <div className="grid grid-cols-5 gap-1">
          {['any', '1', '2', '3', '4+'].map((val) => {
            const rawVal = val === '4+' ? '4' : val;
            const isSelected =
              val === 'any'
                ? !filters.bathrooms || filters.bathrooms === 'any'
                : String(filters.bathrooms) === rawVal;

            return (
              <button
                key={val}
                type="button"
                onClick={() => handleBathroomsChange(rawVal)}
                className={`py-1.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'bg-navy-950 text-gold-400 border-navy-950 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {val === 'any' ? 'ไม่ระบุ' : val}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Features & Amenities */}
      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">
          สิ่งอำนวยความสะดวก & จุดเด่น
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {amenityOptions.map((opt) => {
            const checked = (filters.features || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleAmenityToggle(opt)}
                className="flex items-center space-x-2 text-left w-full text-xs text-gray-700 hover:text-navy-950 group"
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-gold-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                )}
                <span className={checked ? 'font-semibold text-navy-950' : ''}>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Count Indicator */}
      <div className="pt-3 border-t border-gray-100 text-center text-xs font-semibold text-brand-muted">
        ผลการค้นหา: <span className="text-navy-950 font-bold text-sm">{resultCount}</span> รายการ
      </div>
    </div>
  );
}
