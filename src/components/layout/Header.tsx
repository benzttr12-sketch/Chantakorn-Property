'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  Phone, 
  PlusCircle, 
  User, 
  Heart, 
  Building2, 
  ShieldCheck,
  ChevronRight,
  Facebook,
  LogIn,
  LogOut,
  LayoutDashboard,
  UserCircle
} from 'lucide-react';
import { getFavoriteIds } from '@/lib/store/properties-store';
import { getStoredUser, logoutUser } from '@/lib/auth-helpers';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from '@/lib/types';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const pathname = usePathname();

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
    setCurrentUser(getStoredUser());

    const handleAuthCustom = (e: any) => {
      setCurrentUser(e.detail || null);
    };
    window.addEventListener('chantakorn_auth_change', handleAuthCustom);

    let unsubscribe = () => {};
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
          // If no stored user, ensure null
          const stored = getStoredUser();
          if (!stored) setCurrentUser(null);
        } else {
          setCurrentUser(getStoredUser());
        }
      });
    }

    return () => {
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
    { name: 'ขาย', href: '/sell' },
    { name: 'บ้าน', href: '/properties?type=house' },
    { name: 'ที่ดิน', href: '/properties?type=land' },
    { name: 'คอนโด', href: '/properties?type=condo' },
    { name: 'อสังหาริมทรัพย์', href: '/properties' },
    { name: 'บริการ', href: '/services' },
  ];

  return (
    <>
      {/* Top Notification / Trust Bar */}
      <div className="bg-navy-950 text-white text-xs py-2 px-4 hidden md:block border-b border-navy-800 shadow-inner">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center text-gold-300 font-bold tracking-wide">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-gold-400 flex-shrink-0" />
              นายหน้าอสังหาริมทรัพย์มืออาชีพ หาดใหญ่ – สงขลา
            </span>
            <span className="text-navy-600">|</span>
            <span className="text-gray-200 font-normal">บริการซื้อ ขาย เช่า ฝากขาย ให้คำปรึกษาฟรี</span>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <a 
              href="tel:0816040097" 
              className="hover:text-gold-300 text-white transition-colors flex items-center group font-medium"
            >
              <Phone className="w-3.5 h-3.5 mr-1.5 text-gold-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">081-604-0097</span>
            </a>

            <span className="text-navy-600">•</span>

            <a
              href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gold-300 text-white transition-colors flex items-center font-medium"
              title="Facebook Page: Chantakorn Property"
            >
              <Facebook className="w-3.5 h-3.5 mr-1.5 text-[#3b82f6]" />
              Facebook
            </a>

            <span className="text-navy-600">•</span>

            <span className="text-gray-200">
              LINE: <span className="text-gold-300 font-bold">Official Account</span>
            </span>

            <span className="text-navy-600">•</span>

            {/* User Access: เข้าสู่ระบบ or Logged-in profile */}
            {currentUser ? (
              <Link
                id="topbar-profile-link"
                href={currentUser.role === 'ADMIN' || currentUser.role === 'AGENT' ? '/admin' : '/profile'}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-navy-900 border border-gold-400/50 text-gold-300 hover:text-white hover:border-gold-300 transition-all text-[11px]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold max-w-[120px] truncate text-white">{currentUser.full_name || 'บัญชีของฉัน'}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-gold-400 text-navy-950 rounded font-black">
                  {currentUser.role}
                </span>
              </Link>
            ) : (
              <Link 
                id="topbar-login-link"
                href="/login" 
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-gold-400 text-navy-950 hover:bg-gold-300 hover:text-navy-900 font-bold text-xs shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-navy-950 stroke-[2.5]" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-[60] w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-navy-950 shadow-xl border-b border-gold-500/20 py-2.5'
            : 'bg-navy-950 border-b border-navy-800/90 py-3.5'
        }`}
        style={{ backgroundColor: '#020812' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 via-gold-500 to-amber-600 flex items-center justify-center text-navy-950 font-bold shadow-md shadow-gold-500/20 group-hover:scale-105 group-hover:shadow-gold-500/30 transition-all">
              <Building2 className="w-6 h-6 text-navy-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black text-lg tracking-wider leading-none group-hover:text-gold-200 transition-colors">
                CHANTAKORN
              </span>
              <span className="text-gold-400 text-xs font-bold tracking-widest leading-tight">
                PROPERTY
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-1.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'text-gold-300 bg-navy-900 border border-gold-400/50 font-bold shadow-sm'
                      : 'text-white hover:text-gold-300 hover:bg-navy-900/80 font-medium'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions (Desktop) */}
          <div className="hidden lg:flex items-center space-x-3">
            <Link
              href="/favorites"
              className="relative p-2 text-white hover:text-gold-300 hover:bg-navy-900 rounded-xl border border-transparent hover:border-navy-700 transition-all"
              title="ทรัพย์ที่บันทึกไว้"
            >
              <Heart className="w-5 h-5" />
              {favCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {favCount}
                </span>
              )}
            </Link>

            {/* Login / Profile Button */}
            {currentUser ? (
              <Link
                id="main-user-profile-btn"
                href={currentUser.role === 'ADMIN' || currentUser.role === 'AGENT' ? '/admin' : '/profile'}
                className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-navy-900 hover:bg-navy-850 rounded-full border border-gold-400/50 hover:border-gold-300 shadow-sm transition-all group"
                title="คลิกเพื่อจัดการโปรไฟล์"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-gold-400 bg-navy-950 flex items-center justify-center flex-shrink-0">
                  {currentUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gold-400">
                      {(currentUser.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white group-hover:text-gold-200 transition-colors max-w-[100px] truncate leading-tight">
                    {currentUser.full_name || 'ผู้ใช้งาน'}
                  </span>
                  <span className="text-[10px] text-gold-300 font-bold leading-none">
                    {currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : currentUser.role === 'AGENT' ? 'เจ้าหน้าที่' : 'สมาชิก'}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                id="main-login-btn"
                href="/login"
                className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-850 text-white hover:text-gold-300 px-3.5 py-1.5 text-sm font-bold rounded-xl border border-gold-400/40 hover:border-gold-300 transition-all shadow-sm group"
              >
                <LogIn className="w-4 h-4 text-gold-400 group-hover:translate-x-0.5 transition-transform" />
                <span className="text-white group-hover:text-gold-300">เข้าสู่ระบบ</span>
              </Link>
            )}

            <Link
              href="/sell"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-gold-300 border border-gold-400/50 hover:border-gold-300 hover:bg-gold-500/15 rounded-xl transition-all shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-gold-400" />
              <span>ลงประกาศ</span>
            </Link>

            <Link
              href="/contact"
              className="px-4 py-2 text-xs font-bold text-navy-950 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 hover:from-gold-300 hover:to-gold-400 rounded-xl shadow-md hover:shadow-gold-500/25 transition-all transform hover:-translate-y-0.5"
            >
              ติดต่อเรา
            </Link>
          </div>

          {/* Mobile Right Icons & Hamburger */}
          <div className="flex items-center space-x-2 lg:hidden">
            <Link
              href="/favorites"
              className="relative p-2 text-gray-300 hover:text-gold-400 rounded-lg"
            >
              <Heart className="w-5 h-5" />
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {favCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-200 hover:text-gold-400 hover:bg-navy-900 rounded-lg focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 top-[60px] z-[60] bg-[#020812] border-t border-navy-800 flex flex-col p-5 overflow-y-auto animate-fadeIn shadow-2xl"
          style={{ backgroundColor: '#020812' }}
        >
          {/* User Account Card in Mobile Menu if logged in */}
          {currentUser && (
            <div className="mb-5 p-4 rounded-2xl bg-navy-900 border border-gold-500/40 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gold-400 bg-navy-950 flex items-center justify-center flex-shrink-0">
                  {currentUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-gold-400">
                      {(currentUser.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">
                    {currentUser.full_name || 'ผู้ใช้งาน'}
                  </div>
                  <div className="text-xs text-gold-400 font-semibold">
                    {currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ (Admin)' : currentUser.role === 'AGENT' ? 'เจ้าหน้าที่ (Agent)' : 'สมาชิก'}
                  </div>
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-1.5 bg-navy-800 text-gold-300 text-xs font-bold rounded-xl border border-gold-400/40 hover:bg-navy-750 transition-all"
              >
                โปรไฟล์
              </Link>
            </div>
          )}

          <div className="flex flex-col space-y-2 mb-6">
            <div className="text-xs font-bold text-gold-400 uppercase tracking-wider mb-2 px-2 flex items-center justify-between">
              <span>เมนูหลัก</span>
              <span className="text-[11px] text-gray-400 font-normal">Chantakorn Property</span>
            </div>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-base transition-all ${
                    isActive
                      ? 'bg-navy-900 text-gold-300 font-bold border border-gold-400/60 shadow-md ring-1 ring-gold-400/30'
                      : 'text-white hover:text-gold-300 font-semibold bg-navy-900/70 hover:bg-navy-850 border border-navy-800'
                  }`}
                >
                  <span className="tracking-wide">{link.name}</span>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gold-400' : 'text-gray-400'}`} />
                </Link>
              );
            })}
          </div>

          <div className="border-t border-navy-800 pt-5 flex flex-col space-y-3 pb-24">
            <Link
              href="/sell"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-gold-400/50 bg-navy-900 text-gold-300 font-bold hover:bg-navy-850 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-gold-400" />
              <span>ลงประกาศ / ฝากขายทรัพย์</span>
            </Link>

            {currentUser ? (
              <div className="space-y-2">
                {(currentUser.role === 'ADMIN' || currentUser.role === 'AGENT') && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-navy-900 border border-gold-500/40 text-gold-300 font-bold hover:bg-navy-850 transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>แผงควบคุมระบบ (Admin Panel)</span>
                  </Link>
                )}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-navy-850 text-white font-medium hover:bg-navy-800 transition-all border border-navy-800"
                >
                  <UserCircle className="w-4 h-4" />
                  <span>จัดการโปรไฟล์ส่วนตัว</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs font-semibold hover:bg-red-900/40 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gold-400 text-navy-950 font-bold hover:bg-gold-300 transition-all shadow-md"
              >
                <LogIn className="w-4 h-4 text-navy-950 stroke-[2.5]" />
                <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
              </Link>
            )}

            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 text-navy-950 font-black shadow-md hover:shadow-gold-500/25 transition-all"
            >
              ติดต่อ Chantakorn Property
            </Link>

            <div className="mt-4 pt-4 border-t border-navy-800 text-center text-xs text-gray-200 space-y-1.5">
              <div>โทร: <a href="tel:0816040097" className="text-gold-300 font-bold hover:underline">081-604-0097</a></div>
              <div>
                <a
                  href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline font-medium"
                >
                  Facebook: Chantakorn Property
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
