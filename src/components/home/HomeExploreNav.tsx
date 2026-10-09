import { ArrowDownRight, Compass, Sparkles, Shapes, WandSparkles } from 'lucide-react';

const SHORTCUTS = [
  { href: '#home-properties', label: 'ทรัพย์แนะนำ', detail: 'ดูรายการล่าสุด', icon: Sparkles },
  { href: '#home-categories', label: 'เลือกประเภท', detail: 'ค้นหาสิ่งที่ใช่', icon: Shapes },
  { href: '#home-locations', label: 'สำรวจทำเล', detail: 'รู้จักย่านที่ชอบ', icon: Compass },
  { href: '#home-matchmaker', label: 'ช่วยค้นหาทรัพย์', detail: 'ตอบคำถามสั้น ๆ', icon: WandSparkles },
];

export default function HomeExploreNav() {
  return (
    <nav aria-label="สำรวจส่วนต่าง ๆ ของหน้าแรก" className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 py-4 sm:px-6 md:grid-cols-4 lg:px-8">
        {SHORTCUTS.map((item, index) => {
          const Icon = item.icon;
          return <a key={item.href} href={item.href} className="home-explore-link group flex min-w-0 items-center gap-3 rounded-xl p-3 sm:p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700"><Icon size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-navy-950 sm:text-sm">{item.label}</span><span className="mt-1 block text-[10px] text-slate-500 sm:text-xs">{item.detail}</span></span>
            <span aria-hidden="true" className="hidden text-[10px] text-slate-400 lg:inline">0{index + 1}</span><ArrowDownRight size={15} aria-hidden="true" className="shrink-0 text-gold-600" />
          </a>;
        })}
      </div>
    </nav>
  );
}
