import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Calculator, MapPin } from 'lucide-react';
import tropicalHome from '@/assets/images/tropical-home-hero.webp';
import ScrollVideoHero from '@/components/ui/ScrollVideoHero';
import FloatingSearchBox from './FloatingSearchBox';

const heroVideo = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/videos/chantakorn-home-reveal.mp4`;

export default function HeroSection() {
  return (
    <section aria-labelledby="home-hero-title" className="home-hero mx-auto w-full max-w-[90rem] px-3 pt-3 sm:px-6 sm:pt-5 lg:px-8">
      <ScrollVideoHero
        videoSrc={heroVideo}
        poster={
          <Image
            src={tropicalHome}
            alt=""
            fill
            priority
            sizes="(min-width: 1440px) 1376px, 100vw"
            className="object-cover object-[59%_center]"
          />
        }
      >
        <div className="mx-auto w-full max-w-7xl p-5 pb-8 sm:p-9 sm:pb-12 lg:p-14 lg:pb-16">
          <p className="hero-reveal mb-5 flex items-center gap-2.5 text-sm font-medium text-[#f0d6a4]">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            หาดใหญ่ · สงขลา
          </p>
          <h1 id="home-hero-title" className="hero-reveal hero-reveal-heading text-[clamp(1.875rem,5.7vw,5.25rem)] font-semibold leading-[1.26] tracking-tight text-white">
            บ้านที่ใช่<br />
            <span className="text-[#f2dcaf]">ในทำเลที่คุณรัก</span>
          </h1>
          <p className="hero-reveal hero-reveal-description mt-5 max-w-lg text-sm leading-relaxed text-[#fff9ec] sm:text-base lg:text-lg">
            ซื้อ ขาย เช่า และฝากขายบ้าน ที่ดิน คอนโด กับทีมอสังหาฯ ท้องถิ่น
          </p>
          <div className="hero-reveal hero-reveal-actions mt-6 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-4">
            <a href="#home-search" className="hero-cta hero-cta-primary inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-[#f0d6a4] px-4 text-sm font-semibold text-navy-950 hover:bg-[#fae5bb] sm:px-5">
              เริ่มค้นหาทรัพย์ <ArrowDown className="size-4 shrink-0" aria-hidden="true" />
            </a>
            <Link href="/properties" className="hero-cta inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/50 bg-[#081610]/40 px-4 text-sm font-medium text-white hover:bg-[#081610]/70 sm:px-5">
              ดูทรัพย์ทั้งหมด <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <div className="hero-reveal hero-reveal-actions mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-0">
            <Link href="/sell" className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-white underline decoration-white/45 underline-offset-4 hover:decoration-white">
              ฝากขายกับเรา <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
            <a href="#home-calculators" className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-white underline decoration-white/45 underline-offset-4 hover:decoration-white">
              <Calculator className="size-3.5 shrink-0" aria-hidden="true" /> เครื่องมือคำนวณ
            </a>
          </div>
        </div>
      </ScrollVideoHero>

      <section id="home-search" tabIndex={-1} aria-labelledby="home-search-title" className="mx-auto mt-4 max-w-7xl scroll-mt-8 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a17b3a] sm:mt-6">
        <FloatingSearchBox />
      </section>
    </section>
  );
}
