'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Home, Building, MapPin, Coins, ArrowRight } from 'lucide-react';
import { DISTRICTS_LIST } from '@/data/locations';

export default function FloatingSearchBox() {
  const router = useRouter();
  const [tab, setTab] = useState<'sale' | 'rent'>('sale');
  const [propertyType, setPropertyType] = useState<string>('all');
  const [district, setDistrict] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('status', tab);
    if (propertyType && propertyType !== 'all') {
      params.set('type', propertyType);
    }
    if (district) {
      params.set('district', district);
    }
    if (minPrice) {
      params.set('minPrice', minPrice);
    }
    if (maxPrice) {
      params.set('maxPrice', maxPrice);
    }

    router.push(`/properties?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-float border border-surface-border p-4 md:p-6 transition-all">
      {/* Tabs: ซื้อ / เช่า */}
      <div className="flex items-center space-x-2 border-b border-gray-100 pb-4 mb-5">
        <button
          type="button"
          onClick={() => setTab('sale')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === 'sale'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-gold-400/30'
              : 'text-gray-700 hover:text-navy-950 hover:bg-gray-100 bg-gray-50'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>ซื้ออสังหาริมทรัพย์</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('rent')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === 'rent'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-gold-400/30'
              : 'text-gray-700 hover:text-navy-950 hover:bg-gray-100 bg-gray-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>เช่าอสังหาริมทรัพย์</span>
        </button>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-end">
        {/* Field 1: ประเภททรัพย์ */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center">
            <Home className="w-3.5 h-3.5 mr-1 text-gold-600" />
            ประเภททรัพย์
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">ทุกประเภททรัพย์</option>
            <option value="house">บ้านเดี่ยว / ทาวน์โฮม</option>
            <option value="land">ที่ดิน</option>
            <option value="condo">คอนโดมิเนียม</option>
            <option value="commercial">อาคารพาณิชย์</option>
            <option value="investment">อสังหาฯ ลงทุน</option>
            <option value="consignment">ขายฝาก / จำนอง</option>
          </select>
        </div>

        {/* Field 2: ทำเล */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1 text-gold-600" />
            ทำเล (หาดใหญ่-สงขลา)
          </label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="">ทุกทำเลในสงขลา</option>
            {DISTRICTS_LIST.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>

        {/* Field 3: ช่วงราคา */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center">
            <Coins className="w-3.5 h-3.5 mr-1 text-gold-600" />
            ช่วงราคา {tab === 'rent' ? '(บาท/เดือน)' : '(บาท)'}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="ราคาต่ำสุด"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all"
            />
            <input
              type="number"
              min="0"
              placeholder="ราคาสูงสุด"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Field 4: Search Button */}
        <div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-navy-950 hover:bg-navy-900 text-gold-400 hover:text-white rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Search className="w-4 h-4 text-gold-400" />
            <span>ค้นหาอสังหาฯ</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-70" />
          </button>
        </div>
      </form>
    </div>
  );
}
