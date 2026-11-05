import Link from 'next/link';
import { ArrowUpRight, FileSearch } from 'lucide-react';
import source from '@/data/songkhla-land-source.json';

export default function LandValuationCTA() {
  const updated = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${source.sourceUpdatedAt}T00:00:00Z`));
  return <section id="home-land-valuation" className="scroll-mt-32 border-y border-gold-200/60 bg-gold-50/70 px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-3xl border border-gold-200 bg-white p-6 shadow-sm sm:p-9 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-950 text-gold-300"><FileSearch size={23} aria-hidden="true" /></span><div><p className="text-xs font-semibold text-gold-800">เครื่องมือสำหรับเจ้าของที่ดิน</p><h2 className="mt-2 text-2xl font-semibold text-navy-950">ที่ดินสงขลาของคุณ ประเมินเท่าไร?</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">ค้นหาจากเลขระวางและเลขที่ดิน พร้อมคำนวณตามพื้นที่ จากข้อมูลเปิดกรมธนารักษ์ อัปเดตต้นทาง {updated}</p></div></div>
      <Link href="/land-valuation" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-800">ค้นหาราคาประเมินที่ดิน<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </div>
  </section>;
}
