import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';

export default function ContactCTA() {
  return (
    <section id="booking-section" aria-labelledby="home-contact-title" className="scroll-mt-36 border-t border-[#e0d5c2] bg-[#eee7d8] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="home-contact-title" className="text-xl font-bold text-navy-950">สนใจทรัพย์หรือต้องการนัดชม?</h2>
          <p className="mt-1 text-sm text-slate-600">คุยกับทีมงาน Chantakorn Property ได้โดยตรง</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-4 py-2 text-sm font-bold text-[#efe3cb] hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600">
            <MessageCircle size={16} aria-hidden="true" /> คุยทาง LINE
          </a>
          <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-navy-950 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600">
            ติดต่อเรา <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
