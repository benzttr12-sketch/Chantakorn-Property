'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { dataBackend, isDemoAuthEnabled } from '@/lib/backend';
import { logoutUser, getStoredUser } from '@/lib/auth-helpers';
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
  ShieldAlert,
  Menu,
  X,
  UserCheck,
  Star,
  Sparkles
} from 'lucide-react';
import Image from 'next/image';
import ProfileHeader from '@/components/admin/ProfileHeader';
import { fetchInquiries } from '@/lib/store/properties-store';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessDeniedUser, setAccessDeniedUser] = useState<any>(null);
  const [pendingInquiriesCount, setPendingInquiriesCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<any>({
    full_name: 'ผู้ดูแลระบบ (Admin)',
    role: 'ADMIN',
    email: 'admin@chantakornproperty.com',
    avatar_url: '',
  });

  useEffect(() => {
    let active = true;
    const loadBadges = async () => {
      try {
        const inqs = await fetchInquiries();
        if (active) {
          const pending = inqs.filter((i) => i.status === 'new').length;
          setPendingInquiriesCount(pending);
        }
      } catch {}
    };
    if (isAuthorized) {
      loadBadges();
    }
    return () => { active = false; };
  }, [isAuthorized, pathname]);

  useEffect(() => {
    let unsubscribeFirebase: (() => void) | undefined;

    const handleAuthChange = (e: any) => {
      if (e.detail) {
        const u = e.detail;
        const r = u.role;
        if (['ADMIN', 'AGENT'].includes(r)) {
          setCurrentUser((prev: any) => ({ ...prev, ...u, role: r }));
        }
      }
    };
    window.addEventListener('chantakorn_auth_change', handleAuthChange);

    async function authorize() {
      let isDenied = false;

      // 1. Supabase Backend
      if (dataBackend === 'supabase' && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login?reason=admin_required');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (!profile || !['ADMIN', 'AGENT'].includes(profile.role)) {
          setAccessDeniedUser({ ...profile, email: user.email, role: 'USER' });
          setIsAuthorized(false);
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

      // 2. Stored Profile check (handles preview domains & fallback sessions)
      const stored = getStoredUser();
      if (stored) {
        const userRole = stored.role || 'USER';
        if (['ADMIN', 'AGENT'].includes(userRole)) {
          if (pathname.startsWith('/admin/users') && userRole !== 'ADMIN') {
            router.replace('/admin');
            return;
          }
          setCurrentUser({ ...stored, role: userRole });
          setIsAuthorized(true);
          return;
        } else {
          // Regular user explicitly attempting to access admin
          isDenied = true;
          setAccessDeniedUser({ ...stored, role: userRole });
          setIsAuthorized(false);
          return;
        }
      }

      // 3. Firebase Auth check
      if (dataBackend === 'firebase' && auth && db) {
        if (auth.currentUser) {
          const userEmail = auth.currentUser.email?.toLowerCase() || '';
          const isRoot = userEmail === 'benzttr12@gmail.com' || userEmail === 'agent@chantakornproperty.com';

          try {
            let snap;
            try {
              snap = await getDocFromServer(doc(db, 'profiles', auth.currentUser.uid));
            } catch {
              snap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
            }

            const docRole = snap.exists() ? snap.data()?.role : null;
            const effectiveRole = isRoot ? 'ADMIN' : (docRole || 'USER');

            if (['ADMIN', 'AGENT'].includes(effectiveRole)) {
              const profile = snap.exists() ? snap.data() : {};
              if (pathname.startsWith('/admin/users') && effectiveRole !== 'ADMIN') {
                router.replace('/admin');
                return;
              }
              setCurrentUser({
                id: auth.currentUser.uid,
                full_name: profile.full_name || auth.currentUser.displayName || (isRoot ? 'คุณฉันทากร (ผู้ดูแลระบบ)' : 'เจ้าหน้าที่'),
                email: auth.currentUser.email,
                role: effectiveRole,
                avatar_url: profile.avatar_url || auth.currentUser.photoURL || '',
              });
              setIsAuthorized(true);
              return;
            } else {
              isDenied = true;
              setAccessDeniedUser({
                id: auth.currentUser.uid,
                email: auth.currentUser.email,
                role: 'USER',
              });
              setIsAuthorized(false);
              return;
            }
          } catch {}
        }
      }

      if (!isDenied) {
        router.replace('/login?reason=admin_required');
      }
    }

    setIsAuthorized(false);
    authorize().catch(() => router.replace('/login?reason=admin_required'));

    if (dataBackend === 'firebase' && auth && db) {
      const firestore = db;
      unsubscribeFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userEmail = firebaseUser.email?.toLowerCase() || '';
          const isRoot = userEmail === 'benzttr12@gmail.com' || userEmail === 'agent@chantakornproperty.com';
          let role = isRoot ? 'ADMIN' : 'USER';
          let avatar = firebaseUser.photoURL || '';
          let name = firebaseUser.displayName || (isRoot ? 'คุณฉันทากร (ผู้ดูแลระบบ)' : firebaseUser.email?.split('@')[0]) || 'ผู้ดูแลระบบ';
          try {
            let snap;
            try {
              snap = await getDocFromServer(doc(firestore, 'profiles', firebaseUser.uid));
            } catch {
              snap = await getDoc(doc(firestore, 'profiles', firebaseUser.uid));
            }

            if (snap.exists()) {
              const data = snap.data();
              if (data.role && !isRoot) role = data.role;
              if (data.avatar_url) avatar = data.avatar_url;
              if (data.full_name) name = data.full_name;
            }
          } catch {}

          if (['ADMIN', 'AGENT'].includes(role)) {
            setCurrentUser({
              full_name: name,
              email: firebaseUser.email,
              avatar_url: avatar,
              role,
            });
            setIsAuthorized(true);
            setAccessDeniedUser(null);
          } else {
            // User is authenticated but role is USER (regular user)
            setAccessDeniedUser({
              full_name: name,
              email: firebaseUser.email,
              role: 'USER',
              avatar_url: avatar
            });
            setIsAuthorized(false);
          }
        } else {
          const stored = getStoredUser();
          if (stored && ['ADMIN', 'AGENT'].includes(stored.role)) {
            setCurrentUser(stored);
            setIsAuthorized(true);
            setAccessDeniedUser(null);
          } else if (!stored) {
            router.replace('/login?reason=admin_required');
          }
        }
      });
    }

    return () => {
      window.removeEventListener('chantakorn_auth_change', handleAuthChange);
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    if (dataBackend === 'supabase' && supabase) await supabase.auth.signOut();
    await logoutUser();
    router.push('/');
  };

  const navItems = [
    { label: 'แดชบอร์ดภาพรวม', href: '/admin', icon: LayoutDashboard },
    { label: 'ระบบอัตโนมัติ AI', href: '/admin/automation', icon: Sparkles, badge: 'เทพ' },
    { label: 'จัดการอสังหาริมทรัพย์', href: '/admin/properties', icon: Building2 },
    { label: 'เพิ่มทรัพย์ใหม่', href: '/admin/properties/new', icon: PlusCircle },
    { label: 'จัดการนายหน้าแนะนำ', href: '/admin/agents', icon: UserCheck },
    { label: 'จัดการรีวิวจากลูกค้า', href: '/admin/reviews', icon: Star },
    { label: 'รายการผู้ติดต่อ & ฝากขาย', href: '/admin/inquiries', icon: MessageSquare },
    { label: 'จัดการสมาชิก & สิทธิ์', href: '/admin/users', icon: Users },
    { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
  ];

  if (accessDeniedUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-7 sm:p-8 border border-surface-border shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-200 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-navy-950">ไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน</h1>
            <p className="text-xs text-brand-muted leading-relaxed">
              คุณได้เข้าสู่ระบบด้วยบัญชี <strong className="text-navy-950">{accessDeniedUser.email || accessDeniedUser.full_name}</strong>
            </p>
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs text-left space-y-1">
              <span className="font-bold flex items-center space-x-1 text-amber-800">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                <span>ข้อจำกัดด้านสิทธิ์การใช้งาน (Role Permissions):</span>
              </span>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                บัญชีของคุณมียศเป็น <strong>ผู้ใช้ทั่วไป (USER)</strong> ระบบหลังบ้านสงวนสิทธิ์การเข้าใช้งานเฉพาะสมาชิกที่มียศ <strong>นายหน้า (AGENT)</strong> และ <strong>ผู้ดูแลระบบ (ADMIN)</strong> เท่านั้น
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              กลับสู่หน้าหลักเว็บไซต์
            </Link>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors"
            >
              ออกจากระบบ / เข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold text-xs border border-gold-500/40 flex-shrink-0">
              {currentUser.avatar_url ? (
                <Image
                  src={currentUser.avatar_url}
                  alt={currentUser.full_name || 'Admin'}
                  fill
                  unoptimized
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{currentUser.full_name?.charAt(0) || 'A'}</span>
              )}
            </div>
            <div className="min-w-0 flex-grow">
              <span className="text-xs font-bold text-white block truncate">
                {currentUser.full_name}
              </span>
              <span className="text-[10px] text-gold-400 block font-semibold truncate">
                บทบาท: {currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ (ADMIN)' : 'นายหน้า (AGENT)'}
              </span>
            </div>
          </div>

            {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            {navItems.filter(item => item.href !== '/admin/users' || currentUser.role === 'ADMIN').map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const isLeadItem = item.href === '/admin/inquiries';
              const isAutomation = item.href === '/admin/automation';
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gold-500 text-navy-950 font-bold shadow-sm'
                      : isAutomation
                      ? 'text-gold-300 bg-navy-900/60 hover:bg-navy-900 hover:text-gold-200 border border-gold-500/20'
                      : 'text-gray-300 hover:bg-navy-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isAutomation && !isActive ? 'text-gold-400' : ''}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {isAutomation && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                        isActive
                          ? 'bg-navy-950 text-gold-400'
                          : 'bg-gradient-to-r from-gold-500 to-amber-500 text-navy-950 shadow-xs'
                      }`}>
                        AI เทพ
                      </span>
                    )}
                    {isLeadItem && pendingInquiriesCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive 
                          ? 'bg-navy-950 text-gold-400' 
                          : 'bg-amber-400 text-navy-950'
                      }`}>
                        {pendingInquiriesCount}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
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

      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
        {/* Quick Top Utility Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-200">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <Link href="/admin" className="hover:text-navy-950 font-semibold flex items-center space-x-1">
              <LayoutDashboard className="w-3.5 h-3.5 text-gold-600" />
              <span>แอดมิน</span>
            </Link>
            <span>/</span>
            <span className="text-navy-950 font-bold">
              {pathname === '/admin' ? 'แดชบอร์ดภาพรวม'
                : pathname.startsWith('/admin/automation') ? 'ศูนย์ระบบอัตโนมัติ AI'
                : pathname.startsWith('/admin/properties/new') ? 'ลงประกาศ / แก้ไขข้อมูลทรัพย์'
                : pathname.startsWith('/admin/properties') ? 'จัดการอสังหาริมทรัพย์'
                : pathname.startsWith('/admin/inquiries') ? 'รายการผู้ติดต่อ & ฝากขาย'
                : pathname.startsWith('/admin/users') ? 'จัดการสมาชิก & สิทธิ์'
                : 'ตั้งค่าระบบ'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {pathname !== '/admin/properties/new' && (
              <Link
                href="/admin/properties/new"
                className="px-3.5 py-1.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-gold-400" />
                <span>+ เพิ่มทรัพย์ใหม่</span>
              </Link>
            )}
            <Link
              href="/"
              target="_blank"
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl border border-gray-200 shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
              <span>ดูหน้าเว็บ</span>
            </Link>
          </div>
        </div>

        <ProfileHeader 
          onProfileUpdated={(updated) => {
            setCurrentUser((prev: any) => ({ ...prev, ...updated }));
          }} 
        />
        {children}
      </main>
    </div>
  );
}
