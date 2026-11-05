import { Calculator, ChevronDown, Compass } from 'lucide-react';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import LandValuationCTA from '@/components/home/LandValuationCTA';
import SmartPropertyMatchmaker from '@/components/home/SmartPropertyMatchmaker';
import ContactCTA from '@/components/home/ContactCTA';
import HomeExperience from '@/components/home/HomeExperience';
import MortgageCalculator from '@/components/tools/MortgageCalculator';

export default function HomePage() {
  return (
    <HomeExperience>
      <HeroSection />
      <div data-home-reveal><FeaturedProperties /></div>

      <section
        id="home-calculators"
        aria-labelledby="home-calculators-title"
        className="scroll-mt-36 bg-white px-4 py-10 sm:px-6 md:py-14 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <h2 id="home-calculators-title" className="text-2xl font-black tracking-tight text-navy-950 sm:text-3xl">
            เครื่องมือคำนวณ
          </h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <LandValuationCTA />
            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 lg:open:col-span-2">
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3.5 hover:bg-gold-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-800">
                  <Calculator size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-navy-950">คำนวณขายฝาก–จำนอง</span>
                  <span className="mt-0.5 block text-sm text-slate-600">ประมาณวงเงิน ดอกเบี้ย และค่าธรรมเนียม</span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-gold-700 group-open:rotate-180" />
              </summary>
              <div className="px-2 pb-2 sm:px-4 sm:pb-4">
                <MortgageCalculator initialPrice={3500000} compact />
              </div>
            </details>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 md:pb-14 lg:px-8">
        <details id="home-matchmaker" className="group rounded-2xl border border-slate-200">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-navy-950 hover:bg-gold-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 sm:px-5 [&::-webkit-details-marker]:hidden">
            <Compass size={18} aria-hidden="true" className="shrink-0 text-gold-700" />
            <span className="flex-1">ช่วยเลือกทรัพย์ตามทำเลและงบ</span>
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-gold-700 group-open:rotate-180" />
          </summary>
          <SmartPropertyMatchmaker />
        </details>
      </div>

      <ContactCTA />
    </HomeExperience>
  );
}
