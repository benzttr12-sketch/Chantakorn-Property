'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  Phone, 
  PlusCircle, 
  Heart, 
  Building2, 
  ShieldCheck,
  ChevronRight,
  Facebook,
  MessageCircle,
  LogIn,
  LogOut,
  LayoutDashboard,
  UserCircle
} from 'lucide-react';
import { getFavoriteIds } from '@/lib/store/properties-store';
import { getStoredUser, logoutUser, syncFirebaseUserProfile } from '@/lib/auth-helpers';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { dataBackend } from '@/lib/backend';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen to favorites
  useEffect(() => {
    const updateFavs = () => {
      setFavCount(getFavoriteIds().length);
    };
    updateFavs();
    window.addEventListener('favorites-updated', updateFavs);
    window.addEventListener('storage', updateFavs);
    return () => { 
      window.removeEventListener('favorites-updated', updateFavs); 
      window.removeEventListener('storage', updateFavs); 
    };
  }, []);

  // Listen to user auth state
  useEffect(() => {
    let active = true;
    let revision = 0;
    setCurrentUser(getStoredUser());

    const handleAuthCustom = () => {
      revision += 1;
      if (active) setCurrentUser(getStoredUser());
    };
    window.addEventListener('chantakorn_auth_change', handleAuthCustom);

    let unsubscribe = () => {};
    if (dataBackend === 'firebase' && auth) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!active) return;
        const requestRevision = ++revision;
        setCurrentUser(null);
        if (!firebaseUser) {
          return;
        } else {
          try {
            const profile = await syncFirebaseUserProfile(firebaseUser);
            if (active && requestRevision === revision) setCurrentUser(profile);
          } catch {
            if (active && requestRevision === revision) setCurrentUser(null);
          }
        }
      });
    }

    return () => {
      active = false;
      revision += 1;
      window.removeEventListener('chantakorn_auth_change', handleAuthCustom);
      unsubscribe();
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const navLinks = [
    { name: 'หน้าแรก', href: '/' },
    { name: 'ซื้อ', href: '/buy' },
    { name: 'เช่า', href: '/rent' },
    { name: 'ฝากขาย', href: '/sell' },
    { name: 'บ้าน', href: '/properties?type=house' },
    { name: 'ที่ดิน', href: '/properties?type=land' },
    { name: 'คอนโด', href: '/properties?type=condo' },
    { name: 'บริการ', href: '/services' },
  ];

  return (
    <>
      {/* Top Notification / Trust Bar */}
      <div className="hidden border-b border-[#d6b77b]/20 bg-navy-950 text-xs text-[#efe3cb] md:block">
        <div className="mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-5 px-6 lg:min-h-9 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium">
              <ShieldCheck className="size-4 shrink-0 text-[#d6b77b]" aria-hidden="true" />
              นายหน้าอสังหาริมทรัพย์มืออาชีพ หาดใหญ่ – สงขลา
            </span>
            <span className="hidden whitespace-nowrap border-l border-white/15 pl-4 text-slate-300 xl:inline">บริการซื้อ ขาย เช่า ฝากขาย ให้คำปรึกษาฟรี</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            <a 
              href="tel:0816040097" 
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap px-1 font-medium text-slate-100 transition-colors hover:text-[#d6b77b] lg:min-h-9"
            >
              <Phone className="size-3.5 text-[#d6b77b]" aria-hidden="true" />
              <span>081-604-0097</span>
            </a>

            <a
              href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap text-slate-100 transition-colors hover:text-[#d6b77b] lg:min-h-9 lg:min-w-0 lg:px-1"
              aria-label="Facebook ของ Chantakorn Property"
              title="Facebook Page: Chantakorn Property"
            >
              <Facebook className="size-3.5 text-[#d6b77b]" aria-hidden="true" />
              <span className="hidden lg:inline">Facebook</span>
            </a>

            <a
              href="https://lin.ee/NMSe28T3"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap text-slate-100 transition-colors hover:text-[#d6b77b] lg:min-h-9 lg:min-w-0 lg:px-1"
              aria-label="LINE Official Account ของ Chantakorn Property"
              title="LINE Official Account: Chantakorn Property (คลิกเพื่อแอดไลน์)"
            >
              <MessageCircle className="size-3.5 text-[#d6b77b]" aria-hidden="true" />
              <span className="hidden lg:inline">LINE Official</span>
            </a>

            {/* User Access: เข้าสู่ระบบ or Logged-in profile */}
            {currentUser ? (
              <Link
                id="topbar-profile-link"
                href={currentUser.role === 'ADMIN' || currentUser.role === 'AGENT' ? '/admin' : '/profile'}
                className="inline-flex min-h-11 items-center gap-1.5 border-l border-white/15 px-3 text-[11px] text-[#efe3cb] transition-colors hover:text-white lg:min-h-9"
              >
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="font-bold max-w-[120px] truncate text-white">{currentUser.full_name || 'บัญชีของฉัน'}</span>
                <span className="rounded bg-[#efe3cb] px-1.5 py-0.5 text-[10px] font-semibold text-navy-950">
                  {currentUser.role}
                </span>
              </Link>
            ) : (
              <Link 
                id="topbar-login-link"
                href="/login" 
                className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-l border-white/15 px-3 font-medium text-[#efe3cb] transition-colors hover:text-white lg:min-h-9"
              >
                <LogIn className="size-3.5 text-[#d6b77b]" aria-hidden="true" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-[60] w-full border-b border-[#d6b77b]/45 bg-[#fcfaf6] transition-shadow ${
          isScrolled ? 'shadow-[0_5px_18px_rgba(2,8,18,0.07)]' : ''
        }`}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-x-3 px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-4">
          {/* Brand Logo */}
          <Link href="/" className="inline-flex min-h-16 min-w-0 items-center gap-2.5 justify-self-start">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d6b77b] bg-[#efe3cb] text-navy-950">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold leading-none tracking-wider text-navy-950 sm:text-base">
                CHANTAKORN
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-none tracking-[0.22em] text-[#77591d]">
                PROPERTY
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav aria-label="เมนูหลัก" className="hidden items-center justify-center gap-1 lg:col-span-2 lg:row-start-2 lg:flex lg:border-t lg:border-[#d6b77b]/30 lg:py-1 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:border-0 xl:py-0">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#efe3cb] text-navy-950'
                      : 'text-slate-700 hover:bg-[#f4ede0] hover:text-navy-950'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions (Desktop) */}
          <div className="hidden items-center gap-2 lg:col-start-2 lg:row-start-1 lg:flex xl:col-start-3">
            <Link
              href="/favorites"
              aria-label="ทรัพย์ที่บันทึกไว้"
              className="relative grid size-11 shrink-0 place-items-center rounded-xl text-navy-950 transition-colors hover:bg-[#efe3cb]"
              title="ทรัพย์ที่บันทึกไว้"
            >
              <Heart className="w-5 h-5" />
              {favCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {favCount}
                </span>
              )}
            </Link>

            {/* Login / Profile Button */}
            {currentUser ? (
              <Link
                id="main-user-profile-btn"
                href={currentUser.role === 'ADMIN' || currentUser.role === 'AGENT' ? '/admin' : '/profile'}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d6b77b]/65 bg-white py-1 pl-1.5 pr-2.5 transition-colors hover:bg-[#efe3cb]"
                title="คลิกเพื่อจัดการโปรไฟล์"
              >
                <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-950 ring-1 ring-[#d6b77b]">
                  {currentUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-[#efe3cb]">
                      {(currentUser.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="max-w-24 truncate text-xs font-semibold leading-tight text-navy-950">
                    {currentUser.full_name || 'ผู้ใช้งาน'}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium leading-none text-[#77591d]">
                    {currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : currentUser.role === 'AGENT' ? 'เจ้าหน้าที่' : 'สมาชิก'}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                id="main-login-btn"
                href="/login"
                className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#d6b77b]/65 bg-white px-2.5 text-sm font-medium text-navy-950 transition-colors hover:bg-[#efe3cb]"
              >
                <LogIn className="size-4 text-[#77591d]" aria-hidden="true" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}

            <Link
              href="/sell"
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#d6b77b]/75 px-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-[#efe3cb]"
            >
              <PlusCircle className="size-4 text-[#77591d]" aria-hidden="true" />
              <span>ลงประกาศ</span>
            </Link>

            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-navy-950 px-3 text-sm font-semibold text-[#efe3cb] transition-colors hover:bg-navy-800"
            >
              ติดต่อเรา
            </Link>
          </div>

          {/* Mobile Right Icons & Hamburger */}
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <Link
              href="/favorites"
              aria-label="ทรัพย์ที่บันทึกไว้"
              className="relative grid size-11 place-items-center rounded-xl text-navy-950 transition-colors hover:bg-[#efe3cb]"
            >
              <Heart className="w-5 h-5" />
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {favCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-11 place-items-center rounded-xl border border-[#d6b77b]/60 text-navy-950 transition-colors hover:bg-[#efe3cb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#77591d]"
              aria-label={mobileMenuOpen ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div 
          id="mobile-navigation-menu"
          className="absolute inset-x-0 top-full flex h-[calc(100dvh-4rem)] flex-col overflow-y-auto overscroll-contain border-t border-[#d6b77b]/45 bg-[#fcfaf6] p-4 shadow-xl md:h-[calc(100dvh-6.75rem)] lg:hidden"
        >
          {/* User Account Card in Mobile Menu if logged in */}
          {currentUser && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#d6b77b]/45 bg-white p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-950 ring-1 ring-[#d6b77b]">
                  {currentUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-[#efe3cb]">
                      {(currentUser.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-navy-950">
                    {currentUser.full_name || 'ผู้ใช้งาน'}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[#77591d]">
                    {currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ (Admin)' : currentUser.role === 'AGENT' ? 'เจ้าหน้าที่ (Agent)' : 'สมาชิก'}
                  </div>
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-[#d6b77b]/65 px-3 text-xs font-semibold text-navy-950 transition-colors hover:bg-[#efe3cb]"
              >
                โปรไฟล์
              </Link>
            </div>
          )}

          <nav aria-label="เมนูหลัก" className="mb-5 grid gap-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs font-semibold text-[#77591d]">
              <span>เมนูหลัก</span>
              <span className="text-[11px] font-medium text-slate-600">Chantakorn Property</span>
            </div>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium text-navy-950 transition-colors ${
                    isActive
                      ? 'border-[#d6b77b]/70 bg-[#efe3cb]'
                      : 'border-[#d6b77b]/35 bg-white hover:bg-[#f4ede0]'
                  }`}
                >
                  <span>{link.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-[#77591d]" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>

          <div className="grid gap-2.5 border-t border-[#d6b77b]/40 pt-4 pb-24 md:pb-8">
            <Link
              href="/sell"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d6b77b]/65 bg-white px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-[#efe3cb]"
            >
              <PlusCircle className="size-4 text-[#77591d]" aria-hidden="true" />
              <span>ลงประกาศ / ฝากขายทรัพย์</span>
            </Link>

            {currentUser ? (
              <div className="space-y-2">
                {(currentUser.role === 'ADMIN' || currentUser.role === 'AGENT') && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d6b77b]/65 bg-white px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-[#efe3cb]"
                  >
                    <LayoutDashboard className="size-4 text-[#77591d]" aria-hidden="true" />
                    <span>แผงควบคุมระบบ (Admin Panel)</span>
                  </Link>
                )}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d6b77b]/65 bg-white px-4 py-2 text-sm font-medium text-navy-950 transition-colors hover:bg-[#efe3cb]"
                >
                  <UserCircle className="size-4 text-[#77591d]" aria-hidden="true" />
                  <span>จัดการโปรไฟล์ส่วนตัว</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#efe3cb] px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-[#e6d2a8]"
              >
                <LogIn className="size-4" aria-hidden="true" />
                <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
              </Link>
            )}

            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-xl bg-navy-950 px-4 py-2 text-sm font-semibold text-[#efe3cb] transition-colors hover:bg-navy-800"
            >
              ติดต่อ Chantakorn Property
            </Link>

            <div className="mt-1 border-t border-[#d6b77b]/40 pt-2 text-center text-sm text-slate-700">
              <div>
                <a href="tel:0816040097" className="inline-flex min-h-11 items-center gap-2 px-2 font-medium text-navy-950 hover:underline">
                  <Phone className="size-4 text-[#77591d]" aria-hidden="true" />
                  081-604-0097
                </a>
              </div>
              <div>
                <a
                  href="https://lin.ee/NMSe28T3"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 px-2 font-medium text-emerald-800 hover:underline"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  <span>LINE Official @930xzcyi</span>
                </a>
              </div>
              <div>
                <a
                  href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 px-2 font-medium text-navy-950 hover:underline"
                >
                  <Facebook className="size-4 text-[#77591d]" aria-hidden="true" />
                  Facebook Chantakorn Property
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      </header>
    </>
  );
}
