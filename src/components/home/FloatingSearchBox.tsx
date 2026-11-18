'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { DISTRICTS_LIST } from '@/data/locations';

const tabs = [
  { value: 'sale', label: 'ซื้อ' },
  { value: 'rent', label: 'เช่า' },
  { value: 'consignment', label: 'ขายฝาก / จำนอง' },
] as const;

type SearchTab = (typeof tabs)[number]['value'];

const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-800';
const selectClass = 'min-h-12 w-full min-w-0 rounded-xl border border-[#e5e0d6] bg-white px-3 py-2 text-sm text-navy-950 hover:border-[#b59b68] focus:ring-2 focus:ring-[#b59b68]';

export default function FloatingSearchBox() {
  const router = useRouter();
  const [tab, setTab] = useState<SearchTab>('sale');
  const [propertyType, setPropertyType] = useState<string>('all');
  const [district, setDistrict] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  function selectTab(nextTab: SearchTab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    setMaxPrice('');
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ status: tab });
    if (propertyType && propertyType !== 'all') {
      params.set('type', propertyType);
    }
    if (district) {
      params.set('district', district);
    }
    if (maxPrice) {
      params.set('maxPrice', maxPrice);
    }

    router.push(`/properties?${params.toString()}`);
  }

  return (
    <div className="w-full rounded-2xl border border-white/50 bg-[#fcfbf8] p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:p-7">
      <h2 className="mb-5 text-xl font-semibold tracking-tight text-navy-950">ค้นหาทรัพย์</h2>
      <div role="group" aria-label="เลือกซื้อ เช่า หรือขายฝาก" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-[#f0ece4] p-1">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => selectTab(value)}
            aria-pressed={tab === value}
            className={`min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-4 ${
              tab === value ? 'bg-navy-950 text-[#efe3cb] shadow-sm' : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'consignment' ? (
        <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
          <p className="mb-3 text-sm leading-6 text-slate-700">สอบถามเงื่อนไขและขั้นตอนการขายฝากหรือจำนองอสังหาริมทรัพย์กับทีมงาน</p>
          <Link href="/sell" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-navy-900">
            ปรึกษาเรื่องขายฝาก
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSearch} className="grid items-end gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="home-search-type" className={labelClass}>ประเภททรัพย์</label>
            <select
              id="home-search-type"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className={selectClass}
            >
              <option value="all">ทุกประเภททรัพย์</option>
              <option value="house">บ้าน / ทาวน์โฮม / พูลวิลล่า</option>
              <option value="land">ที่ดิน</option>
              <option value="condo">คอนโด</option>
              <option value="commercial">อาคารพาณิชย์</option>
              <option value="investment">อสังหาฯ เพื่อการลงทุน</option>
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="home-search-district" className={labelClass}>ทำเล</label>
            <select
              id="home-search-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={selectClass}
            >
              <option value="">ทุกทำเลในหาดใหญ่–สงขลา</option>
              {DISTRICTS_LIST.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="home-search-budget" className={labelClass}>งบประมาณ</label>
            <select
              id="home-search-budget"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className={selectClass}
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
                  <option value="10000">ไม่เกิน 10,000 บาท/เดือน</option>
                  <option value="20000">ไม่เกิน 20,000 บาท/เดือน</option>
                  <option value="35000">ไม่เกิน 35,000 บาท/เดือน</option>
                  <option value="50000">ไม่เกิน 50,000 บาท/เดือน</option>
                </>
              )}
            </select>
          </div>

          <button
            type="submit"
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy-950 px-4 py-2 text-sm font-semibold text-[#efe3cb] transition-colors hover:bg-navy-800"
          >
            <Search size={16} aria-hidden="true" />
            ค้นหาทรัพย์
          </button>
        </form>
      )}
    </div>
  );
}
