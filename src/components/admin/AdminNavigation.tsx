import Link from 'next/link';
import { Building2, ChevronRight, Layers, LayoutDashboard, MapPin, MessageSquare, Settings, Sparkles, Star, UserCheck, Users } from 'lucide-react';
import type { UserProfile } from '@/lib/types';

const navigationGroups = [
  { label: 'ภาพรวม', items: [{ label: 'ภาพรวมวันนี้', href: '/admin', icon: LayoutDashboard }] },
  { label: 'งานประจำ', items: [
    { label: 'จัดการทรัพย์', href: '/admin/properties', icon: Building2 },
    { label: 'ลูกค้าและนัดชม', href: '/admin/inquiries', icon: MessageSquare },
  ] },
  { label: 'เครื่องมือธุรกิจ', items: [
    { label: 'ประเมินราคา / LandsMaps', href: '/admin/valuation', icon: MapPin },
    { label: 'ติดตามเฟสงาน', href: '/admin/work-phases', icon: Layers },
    { label: 'ผู้ช่วย AI และการตลาด', href: '/admin/automation', icon: Sparkles },
  ] },
  { label: 'ทีมและเว็บไซต์', items: [
    { label: 'นายหน้าแนะนำ', href: '/admin/agents', icon: UserCheck },
    { label: 'รีวิวลูกค้า', href: '/admin/reviews', icon: Star },
    { label: 'สมาชิกและสิทธิ์', href: '/admin/users', icon: Users },
    { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
  ] },
];

export function getAdminPageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/properties/new')) return 'เพิ่มหรือแก้ไขทรัพย์';
  if (pathname.startsWith('/admin/profile')) return 'โปรไฟล์ของฉัน';
  return navigationGroups.flatMap((group) => group.items).find((item) => item.href === '/admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))?.label || 'พื้นที่ทำงาน';
}

export default function AdminNavigation({ pathname, role, pendingCount, onNavigate }: { pathname: string; role: UserProfile['role']; pendingCount: number; onNavigate: () => void }) {
  return (
    <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-6 pt-4" aria-label="ส่วนงานหลังบ้าน">
      {navigationGroups.map((group) => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-semibold tracking-wide text-slate-500">{group.label}</p><div className="space-y-1">{group.items.filter((item) => item.href !== '/admin/users' || role === 'ADMIN').map((item) => {
        const active = item.href === '/admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? pathname === item.href ? 'page' : 'location' : undefined} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 ${active ? 'bg-white/10 text-gold-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}><span className="flex min-w-0 items-center gap-3"><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></span>{item.href === '/admin/inquiries' && pendingCount > 0 ? <span className="rounded-md bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-navy-950" aria-label={`${pendingCount} รายการใหม่`}>{pendingCount}</span> : active ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : null}</Link>;
      })}</div></div>)}
    </nav>
  );
}
