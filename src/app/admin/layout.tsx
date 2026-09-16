'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { dataBackend, isDemoAuthEnabled, isDemoMode } from '@/lib/backend';
import { 
  LayoutDashboard, 
  Building2, 
  PlusCircle, 
  MessageSquare, 
  Users, 
  Settings, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    full_name: 'ผู้ดูแลระบบ (Admin)',
    role: 'ADMIN',
    email: 'admin@chantakornproperty.com',
  });

  useEffect(() => {
    async function authorize() {
      if (dataBackend === 'supabase' && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, phone')
          .eq('id', user.id)
          .single();
        if (!profile || !['ADMIN', 'AGENT'].includes(profile.role)) {
          await supabase.auth.signOut();
          router.replace('/login');
          return;
        }
        if (pathname.startsWith('/admin/users') && profile.role !== 'ADMIN') {
          router.replace('/admin');
          return;
        }
        setCurrentUser({ ...profile, email: user.email });
        setIsAuthorized(true);
        return;
      }

      if (isDemoAuthEnabled && typeof window !== 'undefined') {
        const stored = localStorage.getItem('chantakorn_auth_user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            if (user.demo === true && ['ADMIN', 'AGENT'].includes(user.role)) {
              if (pathname.startsWith('/admin/users') && user.role !== 'ADMIN') {
                router.replace('/admin');
                return;
              }
              setCurrentUser(user);
              setIsAuthorized(true);
              return;
            }
          } catch {}
        }

      }
      router.replace('/login');
    }
    setIsAuthorized(false);
    authorize().catch(() => router.replace('/login'));
    if (dataBackend === 'supabase' && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setIsAuthorized(false);
          router.replace('/login');
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [router, pathname]);

  const handleLogout = async () => {
    if (dataBackend === 'supabase' && supabase) await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chantakorn_auth_user');
    }
    router.push('/');
  };

  const navItems = [
    { label: 'แดชบอร์ดภาพรวม', href: '/admin', icon: LayoutDashboard },
    { label: 'จัดการอสังหาริมทรัพย์', href: '/admin/properties', icon: Building2 },
    { label: 'เพิ่มทรัพย์ใหม่', href: '/admin/properties/new', icon: PlusCircle },
    { label: 'รายการผู้ติดต่อ & ฝากขาย', href: '/admin/inquiries', icon: MessageSquare },
    { label: 'จัดการสมาชิก & สิทธิ์', href: '/admin/users', icon: Users },
    { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
  ];

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-navy-950 text-white p-4 flex items-center justify-between border-b border-navy-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 text-gray-300 hover:text-white"
          >
            {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="font-bold text-sm tracking-wide">CHANTAKORN CRM</span>
        </div>
        <Link href="/" className="text-xs text-gold-400 font-semibold flex items-center">
          <span>หน้าเว็บไซต์</span>
          <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-navy-950 text-gray-300 flex flex-col justify-between p-5 border-r border-navy-800/80 transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="pb-6 border-b border-navy-800 flex items-center justify-between">
            <Link href="/admin" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md">
                <Building2 className="w-5 h-5 text-navy-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-wider leading-none">
                  CHANTAKORN
                </span>
                <span className="text-gold-400 text-[10px] font-semibold tracking-widest leading-tight">
                  ADMIN DASHBOARD
                </span>
              </div>
            </Link>
          </div>

          {/* User Badge */}
          <div className="mt-4 p-3 bg-navy-900/80 rounded-xl border border-navy-800 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold text-xs border border-gold-500/40">
              {currentUser.full_name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-grow">
              <span className="text-xs font-bold text-white block truncate">
                {currentUser.full_name}
              </span>
              <span className="text-[10px] text-gold-400 block font-semibold">
                บทบาท: {currentUser.role}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            {navItems.filter(item => item.href !== '/admin/users' || currentUser.role === 'ADMIN').map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gold-500 text-navy-950 font-bold shadow-sm'
                      : 'text-gray-300 hover:bg-navy-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-navy-800 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-gold-400 hover:bg-navy-900 rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>ดูหน้าเว็บลูกค้า</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-xl transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {isDemoMode && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">โหมดตัวอย่าง: การเปลี่ยนแปลงบันทึกเฉพาะเบราว์เซอร์นี้ และไม่ส่งข้อความถึงทีมงาน</div>}
        {children}
      </main>
    </div>
  );
}
