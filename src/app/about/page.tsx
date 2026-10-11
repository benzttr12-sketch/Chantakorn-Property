import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, Clock, FileCheck2, HeartHandshake, MapPin, MessageCircle, Phone, Search, ShieldCheck, Users } from 'lucide-react';
import AboutTeam from '@/components/about/AboutTeam';
import { DEFAULT_OFFICIAL_LINE_URL, DEFAULT_OFFICIAL_PHONE } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'เกี่ยวกับเรา | Chantakorn Property',
  description: 'รู้จัก Chantakorn Property ทีมที่ปรึกษาและบริการซื้อ ขาย เช่าอสังหาริมทรัพย์ในหาดใหญ่–สงขลา พร้อมช่องทางติดต่อทีมงาน',
};

const services = [
  { title: 'ซื้อและเช่า', description: 'ค้นหาบ้าน ที่ดิน คอนโด และอาคารพาณิชย์ตามทำเลและงบประมาณที่ต้องการ', href: '/properties', icon: Search },
  { title: 'ฝากขายและฝากเช่า', description: 'ส่งข้อมูลทรัพย์ให้ทีม ช่วยเตรียมประกาศและประสานงานกับผู้สนใจ', href: '/sell', icon: Building2 },
  { title: 'นัดชมและปรึกษา', description: 'พูดคุยความต้องการ นัดดูสถานที่ และสอบถามขั้นตอนซื้อขายหรือเช่า', href: '/contact', icon: HeartHandshake },
];

const values = [
  { title: 'ข้อมูลตรงไปตรงมา', description: 'เริ่มจากความต้องการของคุณ ให้รายละเอียดทรัพย์และเงื่อนไขที่ชัดเจนเพื่อประกอบการตัดสินใจ', icon: HeartHandshake },
  { title: 'ขั้นตอนที่ชัดเจน', description: 'ช่วยประสานข้อมูลเอกสาร เงื่อนไข และค่าใช้จ่ายที่เกี่ยวข้อง ก่อนดำเนินการแต่ละขั้นตอน', icon: ShieldCheck },
  { title: 'ประสานงานกับทีม', description: 'ติดต่อที่ปรึกษาเพื่อสอบถามรายละเอียด นัดชม และติดตามความคืบหน้าของรายการที่สนใจ', icon: Users },
  { title: 'ดูแลการดำเนินงาน', description: 'ช่วยประสานงานตั้งแต่การค้นหาหรือฝากทรัพย์ การนัดชม จนถึงการเตรียมเอกสารซื้อขายหรือเช่า', icon: FileCheck2 },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full border-[64px] border-white/[0.025]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-white/5 px-3 py-1.5 text-xs font-medium text-gold-300"><Building2 className="h-3.5 w-3.5" />เกี่ยวกับเรา</span>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Chantakorn<br className="sm:hidden" /> Property</h1>
            <p className="mt-4 text-lg font-medium leading-relaxed text-gold-300 sm:text-2xl">ที่ปรึกษาอสังหาริมทรัพย์<br className="hidden sm:block" />ในหาดใหญ่–สงขลา</p>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">บ้าน ที่ดิน คอนโด และอาคารพาณิชย์ เราช่วยให้การค้นหา ฝากขาย หรือเช่าทรัพย์ เริ่มต้นได้อย่างชัดเจน พร้อมทีมงานที่ติดต่อพูดคุยได้</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href={DEFAULT_OFFICIAL_LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold-400 px-5 text-sm font-bold text-navy-950 transition-colors hover:bg-gold-300"><MessageCircle className="h-4 w-4" />พูดคุยผ่าน LINE</a><a href="#about-team" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-medium text-white transition-colors hover:bg-white/5">รู้จักทีมงาน<ArrowRight className="h-4 w-4" /></a></div>
            <p className="mt-7 flex items-start gap-2 text-xs leading-relaxed text-slate-400"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />ดูแลพื้นที่หาดใหญ่และจังหวัดสงขลา</p>
          </div>

          <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <p className="mb-5 text-sm font-semibold text-white">วันนี้ให้เราช่วยเรื่องไหน</p>
            <div className="space-y-3">{services.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-navy-950/30 p-4 transition-colors hover:border-gold-400/40 hover:bg-white/5 sm:gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{title}</span><span className="mt-1.5 block text-xs leading-relaxed text-slate-400">{description}</span></span><ArrowRight className="mt-3 h-4 w-4 shrink-0 text-slate-500 transition-transform motion-safe:group-hover:translate-x-1" /></Link>)}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:space-y-20 sm:px-6 sm:py-16 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:items-start">
          <div><p className="text-xs font-semibold tracking-wider text-gold-700">ฉันทากร พร็อพเพอร์ตี้</p><h2 className="mt-3 text-2xl font-bold leading-relaxed text-navy-950 sm:text-3xl">เริ่มจากความต้องการ<br />ของคุณเป็นสำคัญ</h2><p className="mt-4 text-sm leading-7 text-slate-500">CHANTAKORN PROPERTY ช่วยประสานงานด้านอสังหาริมทรัพย์สำหรับผู้ซื้อ ผู้ขาย และผู้เช่าในพื้นที่หาดใหญ่–สงขลา เพื่อให้คุณมีข้อมูลสำหรับเลือกทรัพย์และวางแผนขั้นตอนต่อไป</p><Link href="/services" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-700">ดูบริการทั้งหมด<ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid gap-4 sm:grid-cols-2">{values.map(({ title, description, icon: Icon }) => <article key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-50 text-gold-700"><Icon className="h-5 w-5" /></span><h3 className="text-sm font-bold text-navy-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{description}</p></article>)}</div>
        </section>

        <section id="about-team" className="scroll-mt-32">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-wider text-gold-700">พูดคุยกับทีมงาน</p><h2 className="mt-3 text-2xl font-bold text-navy-950 sm:text-3xl">ที่ปรึกษาและทีมงานของเรา</h2><p className="mt-3 text-sm leading-relaxed text-slate-500">เลือกติดต่อทีมงานเพื่อสอบถามทรัพย์หรือนัดหมายพูดคุย</p></div><Link href="/contact" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy-950 transition-colors hover:border-gold-300"><Phone className="h-4 w-4 text-gold-600" />ติดต่อทีม</Link></div>
          <AboutTeam />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="grid lg:grid-cols-[1.1fr_1fr]"><div className="p-6 sm:p-8 lg:p-10"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-700"><HeartHandshake className="h-6 w-6" /></span><h2 className="mt-5 text-2xl font-bold leading-relaxed text-navy-950">เริ่มต้นเรื่องทรัพย์<br />ไปด้วยกัน</h2><p className="mt-3 max-w-md text-sm leading-7 text-slate-500">บอกทำเล งบประมาณ หรือรายละเอียดทรัพย์ที่ต้องการฝากขาย ทีมงานพร้อมรับเรื่องและช่วยประสานขั้นตอนต่อไป</p><div className="mt-6 flex flex-wrap gap-3"><a href={DEFAULT_OFFICIAL_LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-bold text-white hover:bg-navy-900"><MessageCircle className="h-4 w-4 text-gold-300" />ติดต่อผ่าน LINE</a><Link href="/contact" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-navy-950">ส่งข้อความหาเรา<ArrowRight className="h-4 w-4" /></Link></div></div>
            <div className="space-y-5 border-t border-slate-200 bg-[#F5F3ED] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10"><p className="text-xs font-semibold tracking-wider text-gold-700">ช่องทางติดต่อ</p><div className="flex items-start gap-3"><Phone className="mt-1 h-4 w-4 shrink-0 text-gold-700" /><div><span className="block text-xs text-slate-500">โทรศัพท์</span><a href={`tel:${DEFAULT_OFFICIAL_PHONE.replace(/[^\d+]/g, '')}`} className="mt-1 inline-block py-1 text-lg font-bold text-navy-950">{DEFAULT_OFFICIAL_PHONE}</a></div></div><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><div><span className="block text-xs text-slate-500">พื้นที่ให้บริการ</span><p className="mt-1 text-sm font-medium text-navy-950">อำเภอหาดใหญ่ จังหวัดสงขลา</p></div></div><div className="flex items-start gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><div><span className="block text-xs text-slate-500">เวลาทำการ</span><p className="mt-1 text-sm font-medium text-navy-950">ทุกวัน 08:30 – 18:00 น.</p></div></div><p className="flex items-start gap-2 border-t border-gold-200 pt-5 text-xs leading-relaxed text-slate-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />นัดหมายกับทีมก่อนเข้าชมหรือพูดคุยรายละเอียดทรัพย์</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
