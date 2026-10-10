'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { Building2, ExternalLink, LoaderCircle, LogOut, Menu, Plus, RefreshCw, ShieldAlert, UserRound, X } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { supabase } from '@/lib/supabase/client';
import { dataBackend } from '@/lib/backend';
import { getCurrentUserProfile, logoutUser } from '@/lib/auth-helpers';
import { fetchInquiries } from '@/lib/store/properties-store';
import type { UserProfile } from '@/lib/types';
import AdminNavigation, { getAdminPageTitle } from '@/components/admin/AdminNavigation';

type SessionState = 'checking' | 'ready' | 'denied' | 'error' | 'redirecting';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingInquiriesCount, setPendingInquiriesCount] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'AGENT';
  const restrictedPage = pathname.startsWith('/admin/users') && currentUser?.role !== 'ADMIN';

  useEffect(() => {
    let active = true;
    let revision = 0;
    let profileRequests = 0;
    let pendingRecheck = false;
    const loadSession = async (showChecking = true) => {
      if (!active) return;
      const requestRevision = ++revision;
      profileRequests += 1;
      if (showChecking) setSessionState('checking');
      try {
        const profile = await getCurrentUserProfile();
        if (!active || requestRevision !== revision) return;
        setCurrentUser(profile);
        if (!profile) {
          setSessionState('redirecting');
          router.replace('/login?reason=admin_required');
        } else {
          setSessionState(profile.role === 'ADMIN' || profile.role === 'AGENT' ? 'ready' : 'denied');
        }
      } catch {
        if (active && requestRevision === revision) {
          setCurrentUser(null);
          setSessionState('error');
        }
      } finally {
        profileRequests -= 1;
        if (active && profileRequests === 0 && pendingRecheck) {
          pendingRecheck = false;
          void loadSession(false);
        }
      }
    };

    // Notifications request a fresh server profile, never grant an event's role.
    // Queue changes received during a read so a saved profile is not missed.
    const handleProfileChange = () => {
      if (profileRequests === 0) void loadSession(false);
      else pendingRecheck = true;
    };
    window.addEventListener('chantakorn_auth_change', handleProfileChange);
    let unsubscribe: (() => void) | undefined;
    if (dataBackend === 'firebase' && auth) {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          void loadSession();
        } else {
          revision += 1;
          setCurrentUser(null);
          setSessionState('redirecting');
          router.replace('/login?reason=admin_required');
        }
      });
    } else {
      void loadSession();
      if (dataBackend === 'supabase' && supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
          setTimeout(() => { if (active) void loadSession(); }, 0);
        });
        unsubscribe = () => subscription.unsubscribe();
      }
    }
    return () => {
      active = false;
      revision += 1;
      unsubscribe?.();
      window.removeEventListener('chantakorn_auth_change', handleProfileChange);
    };
  }, [router, sessionAttempt]);

  useEffect(() => {
    if (sessionState === 'ready' && restrictedPage) router.replace('/admin');
  }, [restrictedPage, router, sessionState]);

  useEffect(() => {
    let active = true;
    if (sessionState === 'ready' && isStaff) {
      fetchInquiries().then((items) => {
        if (active) setPendingInquiriesCount(items.filter((item) => item.status === 'new').length);
      }).catch(() => { if (active) setPendingInquiriesCount(0); });
    }
    return () => { active = false; };
  }, [isStaff, pathname, sessionState]);

  useEffect(() => { setMobileSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    if (sessionState !== 'ready') setMobileSidebarOpen(false);
  }, [sessionState]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const menuButton = menuButtonRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileSidebarOpen(false);
      }
      if (event.key === 'Tab') {
        const elements = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const handleDesktop = () => { if (window.innerWidth >= 768) setMobileSidebarOpen(false); };
    window.addEventListener('resize', handleDesktop);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleDesktop);
      menuButton?.focus();
    };
  }, [mobileSidebarOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logoutUser();
      router.replace('/');
    } catch {
      setLogoutError('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
      setLoggingOut(false);
    }
  };

  if (sessionState !== 'ready' || !currentUser || !isStaff || restrictedPage) {
    const denied = sessionState === 'denied';
    const failed = sessionState === 'error';
    return (
      <main className="admin-workspace flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-900">
            {denied || failed ? <ShieldAlert className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin motion-reduce:animate-none" />}
          </div>
          <h1 className="text-xl font-bold text-navy-950">{denied ? 'บัญชีนี้ยังไม่มีสิทธิ์เข้าหลังบ้าน' : failed ? 'เชื่อมต่อบัญชีไม่ได้' : 'กำลังตรวจสอบบัญชี'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500" role={failed ? 'alert' : 'status'}>
            {denied ? 'ระบบนี้สำหรับผู้ดูแลระบบและนายหน้า กรุณาใช้บัญชีเจ้าหน้าที่หรือติดต่อผู้ดูแลระบบ' : failed ? 'กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง' : 'กรุณารอสักครู่ ระบบกำลังตรวจสอบสิทธิ์ของคุณ'}
          </p>
          {failed && <button onClick={() => setSessionAttempt((value) => value + 1)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" />ลองใหม่</button>}
          {denied && <div className="mt-6 flex flex-col gap-3"><button disabled={loggingOut} onClick={handleLogout} className="min-h-11 rounded-xl bg-navy-950 px-4 text-sm font-bold text-white">เข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่</button><Link href="/" className="py-2 text-sm text-slate-600">กลับหน้าเว็บไซต์</Link></div>}
          {logoutError && <p role="alert" className="mt-3 text-sm text-red-700">{logoutError}</p>}
        </div>
      </main>
    );
  }

  const sidebarContent = (
    <>
      <div className="flex shrink-0 items-center justify-between px-6 pb-5 pt-7">
        <Link href="/admin" onClick={() => setMobileSidebarOpen(false)} className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400 text-navy-950"><Building2 className="h-5 w-5" /></span>
          <span><span className="block text-sm font-bold tracking-wider text-white">CHANTAKORN</span><span className="mt-1 block text-[11px] text-slate-400">พื้นที่ทำงานของทีม</span></span>
        </Link>
        <button ref={closeButtonRef} onClick={() => setMobileSidebarOpen(false)} aria-label="ปิดเมนูหลังบ้าน" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden"><X className="h-5 w-5" /></button>
      </div>
      <div className="shrink-0 px-5 pb-3"><Link href="/admin/properties/new" onClick={() => setMobileSidebarOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-400 px-4 text-sm font-bold text-navy-950 transition-colors hover:bg-gold-300"><Plus className="h-4 w-4" />เพิ่มทรัพย์ใหม่</Link></div>
      <AdminNavigation pathname={pathname} role={currentUser.role} pendingCount={pendingInquiriesCount} onNavigate={() => setMobileSidebarOpen(false)} />
      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/profile" onClick={() => setMobileSidebarOpen(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5" aria-label="แก้ไขโปรไฟล์ของฉัน">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-gold-300">
              {currentUser.avatar_url ? <Image src={currentUser.avatar_url} alt="" fill unoptimized referrerPolicy="no-referrer" className="object-cover" /> : <UserRound className="h-4 w-4" />}
            </span>
            <span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{currentUser.full_name}</span><span className="mt-1 block text-[11px] text-slate-400">{currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'นายหน้า'} · โปรไฟล์</span></span>
          </Link>
          <button disabled={loggingOut} onClick={handleLogout} aria-label="ออกจากระบบ" className="rounded-xl p-3 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"><LogOut className="h-4 w-4" /></button>
        </div>
        {logoutError && <p role="alert" className="mt-2 text-xs text-red-300">{logoutError}</p>}
      </div>
    </>
  );

  return (
    <div className="admin-workspace flex min-h-[100dvh] bg-[#F5F6FA] text-navy-950">
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col bg-navy-950 md:flex" aria-label="เมนูหลังบ้าน">{sidebarContent}</aside>
      {mobileSidebarOpen && <div className="fixed inset-0 z-[70] md:hidden"><div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" /><div ref={drawerRef} role="dialog" aria-modal="true" aria-label="เมนูหลังบ้าน" id="admin-mobile-menu" className="relative flex h-[100dvh] w-[min(288px,calc(100vw-40px))] flex-col bg-navy-950 shadow-2xl">{sidebarContent}</div></div>}
      <div className="min-w-0 flex-1">
        <header className="flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={menuButtonRef} onClick={() => setMobileSidebarOpen(true)} aria-label="เปิดเมนูหลังบ้าน" aria-expanded={mobileSidebarOpen} aria-controls="admin-mobile-menu" className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-navy-950 md:hidden"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0"><span className="hidden text-[11px] text-slate-400 sm:block">Chantakorn Property / หลังบ้าน</span><span className="block truncate text-sm font-semibold sm:mt-1">{getAdminPageTitle(pathname)}</span></div>
          </div>
          <Link href="/" target="_blank" rel="noopener noreferrer" className="flex shrink-0 min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"><ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">ดูหน้าเว็บไซต์</span><span className="sr-only sm:hidden">ดูหน้าเว็บไซต์</span></Link>
        </header>
        <main id="admin-main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
