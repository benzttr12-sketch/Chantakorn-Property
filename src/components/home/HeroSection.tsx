import Link from 'next/link';
import Image from 'next/image';
import { Search, PlusCircle, ChevronRight, MapPin, ShieldCheck, HeartHandshake, ArrowDown } from 'lucide-react';
import FloatingSearchBox from './FloatingSearchBox';
import HomeMoodSelector from './HomeMoodSelector';
import { hatyaiModernHouseHero } from '@/assets/images';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-navy-950 pb-10 pt-12 sm:pb-14 sm:pt-16 lg:pt-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image src={hatyaiModernHouseHero} alt="" fill priority placeholder="blur" sizes="100vw" className="object-cover object-center opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/50" />
        <div className="home-hero-grid absolute inset-0 opacity-15" />
        <div className="absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-gold-500/10 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-gold-500/10 blur-[100px]" />
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-8">
        <div className="min-w-0">
          <p className="hero-reveal mb-6 flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.15em] text-gold-300 sm:text-xs"><span className="h-px w-8 bg-gold-400" /> CHANTAKORN PROPERTY <span className="text-white/40">/</span> หาดใหญ่–สงขลา</p>
          <h1 className="hero-reveal hero-reveal-heading text-[2.5rem] font-semibold leading-[1.3] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
            บ้านที่ใช่<br />
            <span className="bg-gradient-to-r from-gold-100 via-gold-300 to-gold-500 bg-clip-text text-transparent">ในทำเลที่คุณรัก</span>
          </h1>
          <p className="hero-reveal hero-reveal-description mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">ซื้อ ขาย เช่า ฝากขาย บ้าน ที่ดิน และคอนโดในหาดใหญ่–สงขลา เริ่มต้นค้นหาทรัพย์ที่ตอบโจทย์ชีวิต พร้อมทีมงานดูแลตั้งแต่วันแรกจนถึงวันโอน</p>
          <div className="hero-reveal hero-reveal-actions mt-7 flex flex-wrap gap-3">
            <Link href="/properties" className="hero-cta hero-cta-primary flex min-h-12 items-center gap-2.5 rounded-xl bg-gold-400 px-5 py-3.5 text-sm font-semibold text-navy-950 shadow-lg hover:bg-gold-300"><Search size={17} aria-hidden="true" />ค้นหาทรัพย์ทั้งหมด<ChevronRight size={16} aria-hidden="true" className="hero-cta-arrow" /></Link>
            <Link href="/sell" className="hero-cta flex min-h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3.5 text-sm font-medium text-white hover:bg-white/10"><PlusCircle size={17} aria-hidden="true" className="text-gold-300" />ฝากขายกับเรา</Link>
          </div>
          <div className="hero-reveal hero-reveal-stats mt-8 flex flex-wrap gap-x-5 gap-y-3 border-t border-white/15 pt-5 text-[11px] text-slate-300 sm:text-xs">
            <span className="flex items-center gap-2"><MapPin size={15} aria-hidden="true" className="text-gold-300" />เชี่ยวชาญทำเลในพื้นที่</span>
            <span className="flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" className="text-gold-300" />ดูแลเรื่องเอกสาร</span>
            <span className="flex items-center gap-2"><HeartHandshake size={15} aria-hidden="true" className="text-gold-300" />ปรึกษาทีมงานได้</span>
          </div>
          <a href="#home-properties" className="mt-7 inline-flex min-h-11 items-center gap-3 text-[11px] text-slate-300 hover:text-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-300"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20"><ArrowDown size={14} aria-hidden="true" /></span>เลื่อนลงเพื่อค้นพบทรัพย์ที่ใช่</a>
        </div>
        <div className="hero-reveal hero-reveal-actions min-w-0"><HomeMoodSelector /></div>
      </div>
      <div className="hero-reveal hero-reveal-search relative mx-auto mt-10 w-full max-w-7xl px-4 sm:mt-12 sm:px-6 lg:px-8"><FloatingSearchBox /></div>
    </section>
  );
}
