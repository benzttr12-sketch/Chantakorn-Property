import Link from 'next/link';
import Image from 'next/image';
import { Calculator, PlusCircle, Search } from 'lucide-react';
import FloatingSearchBox from './FloatingSearchBox';
import MeshDriftBackground from './MeshDriftBackground';
import { hatyaiModernHouseHero } from '@/assets/images';

export default function HeroSection() {
  return (
    <section className="home-hero relative overflow-hidden bg-navy-950 py-8 sm:py-10 lg:py-12">
      <div className="home-hero-background pointer-events-none absolute inset-x-0 top-0" aria-hidden="true">
        <Image src={hatyaiModernHouseHero} alt="" fill priority placeholder="blur" sizes="100vw" className="home-hero-backdrop object-cover" />
        <MeshDriftBackground />
        <div className="home-hero-shade absolute inset-0" />
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        <div className="min-w-0">
          <p className="hero-reveal mb-3 text-xs font-semibold tracking-wider text-gold-300">CHANTAKORN PROPERTY · หาดใหญ่–สงขลา</p>
          <h1 className="hero-reveal hero-reveal-heading text-3xl font-semibold leading-[1.3] tracking-tight text-white sm:text-4xl lg:text-5xl">
            บ้านที่ใช่<br />
            <span className="bg-linear-to-r/srgb from-gold-100 via-gold-300 to-gold-500 bg-clip-text text-transparent">ในทำเลที่คุณรัก</span>
          </h1>
          <p className="hero-reveal hero-reveal-description mt-3 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">ซื้อ ขาย เช่า และฝากขายบ้าน ที่ดิน คอนโดในหาดใหญ่และสงขลา</p>
          <div className="hero-reveal hero-reveal-actions mt-5 flex flex-wrap gap-2.5">
            <Link href="/properties" className="hero-cta hero-cta-primary inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-gold-300">
              <Search size={16} aria-hidden="true" />
              ดูทรัพย์ทั้งหมด
            </Link>
            <Link href="/sell" className="hero-cta inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              <PlusCircle size={16} aria-hidden="true" className="text-gold-300" />
              ฝากขายกับเรา
            </Link>
            <a href="#home-calculators" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gold-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-300">
              <Calculator size={16} aria-hidden="true" />
              เครื่องมือคำนวณ
            </a>
          </div>
        </div>
        <div className="hero-reveal hero-reveal-search min-w-0"><FloatingSearchBox /></div>
      </div>
    </section>
  );
}
