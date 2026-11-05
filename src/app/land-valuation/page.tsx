import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Database, ExternalLink, FileSearch } from 'lucide-react';
import SongkhlaLandLookup from '@/components/tools/SongkhlaLandLookup';
import index from '@/data/songkhla-land-index.json';
import source from '@/data/songkhla-land-source.json';

export const metadata: Metadata = {
  title: 'ค้นหาราคาประเมินที่ดินสงขลา',
  description: 'ค้นหาราคาประเมินที่ดินจังหวัดสงขลาด้วยเลขระวางและเลขที่ดิน จากชุดข้อมูลเปิดกรมธนารักษ์ พร้อมวันที่ข้อมูลต้นทางและเครื่องคำนวณพื้นที่',
  alternates: { canonical: '/land-valuation' },
};
const date = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

export default function LandValuationPage() {
  return <div className="min-h-screen bg-slate-50 pb-20">
    <section className="border-b border-slate-200 bg-white px-4 pb-10 pt-8 sm:px-6 sm:pb-14 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-gold-700"><ArrowLeft size={16} aria-hidden="true" />กลับหน้าแรก</Link>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-3xl"><p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gold-800"><FileSearch size={17} aria-hidden="true" />ข้อมูลเปิดกรมธนารักษ์ · จังหวัดสงขลา</p>
            <h1 className="mt-4 text-3xl font-semibold leading-snug text-navy-950 sm:text-4xl">ค้นหาราคาประเมินที่ดินสงขลา</h1>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">ดูราคาต่อหน่วยจากเลขระวางและเลขที่ดิน แล้วคำนวณตามพื้นที่ในเอกสารของคุณ เปิดใช้ได้ฟรีโดยไม่ต้องสมัครสมาชิก</p>
          </div>
          <div className="rounded-2xl border border-gold-200 bg-gold-50 px-5 py-4"><Database size={19} className="text-gold-700" aria-hidden="true" /><p className="mt-2 text-2xl font-semibold text-navy-950">{index.rowCount.toLocaleString('th-TH')}</p><p className="mt-1 text-xs text-slate-600">แถวข้อมูลจากไฟล์ต้นทาง</p></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs leading-6 text-slate-600"><span>ข้อมูลต้นทางอัปเดต {date(source.sourceUpdatedAt)}</span><span>ตรวจแค็ตตาล็อกล่าสุด {date(source.verifiedAt)}</span></div>
      </div>
    </section>
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
      <SongkhlaLandLookup index={index} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-7 text-slate-600 sm:p-6" aria-labelledby="land-source-title">
        <h2 id="land-source-title" className="text-sm font-semibold text-navy-950">แหล่งข้อมูลและวันที่อ้างอิง</h2>
        <p className="mt-2">{source.publisher} · ชุดข้อมูลราคาประเมินที่ดิน · {source.license}</p>
        <p>ไฟล์ที่ใช้ตรงกับไฟล์สงขลาซึ่งแค็ตตาล็อกเผยแพร่ ณ วันที่ตรวจข้างต้น ข้อมูลใน CSV ไม่ได้ระบุรอบบัญชีรายแปลง จึงใช้วันที่ชุดข้อมูลตามต้นทางและไม่กำหนดปีรอบบัญชีแทนหน่วยงาน</p>
        <p>ชุดข้อมูลมีเลขอ้างอิงซ้ำบางรายการ ระบบเก็บทุกแถวไว้ให้ตรวจเทียบ ไม่มีพิกัด ชื่อเจ้าของ เลขโฉนด หรือแนวเขตแปลงจากไฟล์นี้</p>
        <a href={source.datasetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-gold-800 underline underline-offset-4">เปิดแค็ตตาล็อกกรมธนารักษ์<ExternalLink size={13} aria-hidden="true" /></a>
      </section>
    </div>
  </div>;
}
