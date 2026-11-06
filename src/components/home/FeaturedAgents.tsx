import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AboutTeam from '@/components/about/AboutTeam';

export default function FeaturedAgents() {
  return (
    <section
      id="home-agents"
      aria-labelledby="home-agents-title"
      className="scroll-mt-36 border-t border-[#e5dfd2] px-4 py-8 sm:px-6 md:py-10 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-agents-title" className="border-l-[3px] border-[#b99b62] pl-4 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">
            นายหน้าแนะนำ
          </h2>
          <Link href="/about#about-team" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e4ded1] bg-white px-4 text-sm font-semibold text-navy-950 hover:border-gold-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600">
            ดูทีมงานทั้งหมด <ArrowRight size={16} aria-hidden="true" className="text-gold-700" />
          </Link>
        </div>
        <AboutTeam compact />
      </div>
    </section>
  );
}
