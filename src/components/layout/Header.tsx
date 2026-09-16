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
  Facebook
} from 'lucide-react';
import { getFavoriteIds } from '@/lib/store/properties-store';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const updateFavs = () => {
      setFavCount(getFavoriteIds().length);
    };
    updateFavs();
    window.addEventListener('favorites-updated', updateFavs);
    window.addEventListener('storage', updateFavs);
    return () => { window.removeEventListener('favorites-updated', updateFavs); window.removeEventListener('storage', updateFavs); };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      <div className="bg-navy-900 text-gray-300 text-xs py-1.5 px-4 hidden md:block border-b border-navy-700/50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-gold-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              นายหน้าอสังหาริมทรัพย์มืออาชีพ หาดใหญ่ – สงขลา
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-300">ปรึกษาเรื่องซื้อ ขาย ฝากขาย ฟรี!</span>
          </div>
          <div className="flex items-center space-x-5 text-gray-300">
            <a href="tel:0816040097" className="hover:text-gold-400 transition-colors flex items-center">
              <Phone className="w-3 h-3 mr-1 text-gold-400" />
              081-604-0097
            </a>
            <span className="text-gray-500">•</span>
            <a
              href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gold-400 transition-colors flex items-center"
              title="Facebook Page"
            >
              <Facebook className="w-3 h-3 mr-1 text-[#1877F2]" />
              Facebook
            </a>
            <span className="text-gray-500">•</span>
            <span className="text-gray-300">LINE: <span className="text-gold-400 font-semibold">Official Account</span></span>
            <span className="text-gray-500">•</span>
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
              ระบบหลังบ้าน
            </Link>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-navy-950/95 backdrop-blur-md shadow-lg border-b border-navy-800/80 py-2.5'
            : 'bg-navy-950 border-b border-navy-800 py-3.5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6 text-navy-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg tracking-wider leading-none">
                CHANTAKORN
              </span>
              <span className="text-gold-400 text-xs font-semibold tracking-widest leading-tight">
                PROPERTY
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'text-gold-400 bg-navy-800 font-semibold'
                      : 'text-gray-200 hover:text-gold-400 hover:bg-navy-900/80'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center space-x-3">
            <Link
              href="/favorites"
              className="relative p-2 text-gray-300 hover:text-gold-400 hover:bg-navy-900 rounded-lg transition-colors"
              title="ทรัพย์ที่บันทึกไว้"
            >
              <Heart className="w-5 h-5" />
              {favCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {favCount}
                </span>
              )}
            </Link>

            <Link
              href="/login"
              className="flex items-center space-x-1.5 text-gray-200 hover:text-gold-400 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <User className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </Link>

            <Link
              href="/sell"
              className="flex items-center space-x-1 px-3.5 py-1.5 text-xs font-semibold text-gold-300 border border-gold-500/40 hover:border-gold-400 hover:bg-gold-500/10 rounded-lg transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5 text-gold-400" />
              <span>ลงประกาศ</span>
            </Link>

            <Link
              href="/contact"
              className="px-4 py-2 text-xs font-bold text-navy-950 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 rounded-lg shadow-sm hover:shadow-gold-500/20 transition-all transform hover:-translate-y-0.5"
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
        <div className="lg:hidden fixed inset-x-0 top-[60px] bottom-0 z-30 bg-navy-950/98 backdrop-blur-xl border-t border-navy-800 flex flex-col p-6 overflow-y-auto animate-fadeIn">
          <div className="flex flex-col space-y-2 mb-6">
            <div className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-1 px-2">
              เมนูหลัก
            </div>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-800 text-gold-400 font-semibold'
                      : 'text-gray-200 hover:bg-navy-900 hover:text-white'
                  }`}
                >
                  <span>{link.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </Link>
              );
            })}
          </div>

          <div className="border-t border-navy-800/80 pt-5 flex flex-col space-y-3 pb-20">
            <Link
              href="/sell"
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-gold-400/50 text-gold-400 font-medium hover:bg-gold-400/10"
            >
              <PlusCircle className="w-4 h-4" />
              <span>ลงประกาศ / ฝากขายทรัพย์</span>
            </Link>

            <Link
              href="/login"
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-navy-800 text-white font-medium hover:bg-navy-700"
            >
              <User className="w-4 h-4" />
              <span>เข้าสู่ระบบ / ลงทะเบียน</span>
            </Link>

            <Link
              href="/contact"
              className="w-full flex items-center justify-center py-3 px-4 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-bold shadow-md"
            >
              ติดต่อ Chantakorn Property
            </Link>

            <div className="mt-4 pt-4 border-t border-navy-900 text-center text-xs text-gray-400 space-y-1.5">
              <div>โทร: <a href="tel:0816040097" className="text-gold-400 font-semibold">081-604-0097</a></div>
              <div>
                <a
                  href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline"
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
