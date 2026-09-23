'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Home, Building, MapPin, Coins, ArrowRight, HandCoins } from 'lucide-react';
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
    <div className="w-full max-w-5xl mx-auto bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 p-5 sm:p-7 transition-all">
      {/* Tabs: ซื้อ / เช่า */}
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-5">
        <button
          type="button"
          onClick={() => setTab('sale')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'sale'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-gold-400/40'
              : 'text-slate-600 hover:text-navy-950 hover:bg-slate-100 bg-slate-50'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>ซื้ออสังหาริมทรัพย์</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('rent')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'rent'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-gold-400/40'
              : 'text-slate-600 hover:text-navy-950 hover:bg-slate-100 bg-slate-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>เช่าอสังหาริมทรัพย์</span>
        </button>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 items-end">
        {/* Field 1: ประเภททรัพย์ */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center">
            <Home className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
            ประเภททรัพย์
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">ทุกประเภททรัพย์</option>
            <option value="house">บ้านเดี่ยว / ทาวน์โฮม</option>
            <option value="land">ที่ดิน</option>
            <option value="condo">คอนโดมิเนียม</option>
            <option value="commercial">อาคารพาณิชย์</option>
            <option value="investment">อสังหาฯ เพื่อการลงทุน</option>
            <option value="consignment">ขายฝาก / จำนอง</option>
          </select>
        </div>

        {/* Field 2: ทำเล */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
            ทำเล (หาดใหญ่-สงขลา)
          </label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="">ทุกทำเลในหาดใหญ่–สงขลา</option>
            {DISTRICTS_LIST.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>

        {/* Field 3: ช่วงราคา */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center">
            <Coins className="w-3.5 h-3.5 mr-1.5 text-gold-600" />
            งบประมาณ
          </label>
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="">ทุกช่วงราคา</option>
            {tab === 'sale' ? (
              <>
                <option value="2000000">ไม่เกิน 2 ล้านบาท</option>
                <option value="3500000">ไม่เกิน 3.5 ล้านบาท</option>
                <option value="5000000">ไม่เกิน 5 ล้านบาท</option>
                <option value="10000000">ไม่เกิน 10 ล้านบาท</option>
                <option value="20000000">ไม่เกิน 20 ล้านบาท</option>
              </>
            ) : (
              <>
                <option value="10000">ไม่เกิน 10,000 บาท/ด.</option>
                <option value="20000">ไม่เกิน 20,000 บาท/ด.</option>
                <option value="35000">ไม่เกิน 35,000 บาท/ด.</option>
                <option value="50000">ไม่เกิน 50,000 บาท/ด.</option>
              </>
            )}
          </select>
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            className="w-full py-3 px-5 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-gold-500/25 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Search className="w-4 h-4 text-navy-950 stroke-[2.5]" />
            <span>ค้นหาทันที</span>
          </button>
        </div>
      </form>
    </div>
  );
}
