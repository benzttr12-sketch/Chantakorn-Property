import Link from 'next/link';
import { ArrowUpRight, FileSearch } from 'lucide-react';

export default function LandValuationCTA() {
  return (
    <Link
      id="home-land-valuation"
      href="/land-valuation"
      className="flex min-h-20 scroll-mt-36 items-center gap-3 rounded-2xl border border-[#ddd6c7] bg-white shadow-sm px-4 py-3.5 hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 sm:px-5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eadc] text-[#7b5c28]">
        <FileSearch size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-navy-950">ค้นหาราคาประเมินที่ดินสงขลา</span>
        <span className="mt-0.5 block text-sm text-slate-600">ค้นด้วยเลขระวางและเลขที่ดิน คำนวณตามพื้นที่</span>
      </span>
      <ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-gold-700" />
    </Link>
  );
}
