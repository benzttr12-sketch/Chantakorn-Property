import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Calculator, PlusCircle } from 'lucide-react';
import FloatingSearchBox from './FloatingSearchBox';
import MeshDriftBackground from './MeshDriftBackground';
import { hatyaiModernHouseHero } from '@/assets/images';

export default function HeroSection() {
  return (
    <section className="home-hero relative mx-3 mt-3 overflow-hidden rounded-[1.75rem] bg-navy-950 py-7 sm:mx-6 sm:mt-5 sm:rounded-[2rem] sm:py-10 lg:mx-8 lg:py-14">
      <div className="home-hero-background pointer-events-none absolute inset-0" aria-hidden="true">
        <Image src={hatyaiModernHouseHero} alt="" fill priority placeholder="blur" sizes="100vw" className="home-hero-backdrop object-cover" />
        <MeshDriftBackground />
        <div className="home-hero-shade absolute inset-0" />
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-6 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-10">
        <div className="min-w-0">
          <p className="hero-reveal mb-4 flex items-center gap-3 text-[10px] font-medium tracking-[0.12em] text-[#e8d6b0] sm:text-xs">
            <span aria-hidden="true" className="h-px w-8 bg-[#d6b77b]" />
            CHANTAKORN PROPERTY · หาดใหญ่–สงขลา
          </p>
          <h1 className="hero-reveal hero-reveal-heading text-3xl font-semibold leading-[1.4] tracking-tight text-white sm:text-4xl lg:text-[3.25rem]">
            บ้านที่ใช่<br />
            <span className="text-[#e8d6b0]">ในทำเลที่คุณรัก</span>
          </h1>
          <p className="hero-reveal hero-reveal-description mt-4 max-w-md text-sm leading-7 text-slate-200">
            ซื้อ ขาย เช่า และฝากขายบ้าน ที่ดิน คอนโดในหาดใหญ่และสงขลา
          </p>
          <div className="hero-reveal hero-reveal-actions mt-6 flex flex-wrap gap-3">
            <Link href="/properties" className="hero-cta hero-cta-primary inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#e8d6b0] px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-[#f3e5c9]">
              ดูทรัพย์ทั้งหมด <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/sell" className="hero-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15">
              <PlusCircle size={16} aria-hidden="true" className="text-[#e8d6b0]" />
              ฝากขายกับเรา
            </Link>
          </div>
          <a href="#home-calculators" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-[#e8d6b0] underline decoration-white/30 underline-offset-4 hover:decoration-[#e8d6b0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e8d6b0]">
            <Calculator size={16} aria-hidden="true" /> เครื่องมือคำนวณ
          </a>
        </div>
        <div className="hero-reveal hero-reveal-search min-w-0"><FloatingSearchBox /></div>
      </div>
    </section>
  );
}
