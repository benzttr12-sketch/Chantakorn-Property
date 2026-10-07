'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, Phone, Home, Search, Building2, Landmark, Building, 
  Info, Mail, LogIn, ChevronDown, LayoutDashboard, ChevronRight, Briefcase,
  Heart, User, LandPlot, HomeIcon, BuildingIcon, Warehouse, Factory, BuildingOffice2, LogOut, MessageCircle, Facebook, ShieldCheck
} from 'lucide-react';
import { formatLineUrl } from '@/lib/utils';
import { getCurrentUserProfile, logoutUser } from '@/lib/auth-helpers';
import { UserProfile } from '@/lib/types';

const TopBar = () => {
  return (
    <div className="hidden md:block bg-navy-950 text-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="inline-flex items-center text-gold-300 font-bold tracking-wide whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-gold-400 flex-shrink-0" />
              นายหน้าอสังหาริมทรัพย์มืออาชีพ หาดใหญ่ – สงขลา
            </span>
            <span className="text-navy-600">|</span>
            <span className="text-gray-200 font-normal whitespace-nowrap hidden xl:inline">บริการซื้อ ขาย เช่า ฝากขาย ให้คำปรึกษาฟรี</span>
          </div>
          <div className="flex items-center space-x-6 text-xs flex-shrink-0">
            <a 
              href="tel:0816040097" 
              className="hover:text-gold-300 text-white transition-colors flex items-center group font-medium whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 mr-1.5 text-gold-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">081-604-0097</span>
            </a>
            <a 
              href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-gold-300 text-white transition-colors flex items-center font-medium whitespace-nowrap"
              title="Facebook Page: Chantakorn Property"
            >
              <Facebook className="w-3.5 h-3.5 mr-1.5 text-[#3b82f6]" />
              <span className="hidden lg:inline">Facebook</span>
            </a>
            <a 
              href="https://lin.ee/NMSe28T3" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-gold-300 text-white transition-colors flex items-center group font-medium whitespace-nowrap"
              title="LINE Official Account: Chantakorn Property (คลิกเพื่อแอดไลน์)"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-[#06C755] fill-current group-hover:scale-110 transition-transform" />
              <span className="hidden lg:inline">LINE: <span className="text-gold-300 font-bold">Official Account</span></span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const categoryIconMap: Record<string, React.ElementType> = {
  house: HomeIcon,
  land: LandPlot,
  condo: BuildingIcon,
  commercial: BuildingOffice2,
  investment: Factory,
  consignment: Warehouse
};

const categoryLinks = [
  { type: 'house', label: 'บ้าน / ทาวน์โฮม', description: 'พร้อมอยู่ ทำเลชุมชน ใกล้สถานศึกษา', href: '/buy?type=house' },
  { type: 'land', label: 'ที่ดิน', description: 'แปลงสวย ผลตอบแทนสูง ติดถนนใหญ่', href: '/buy?type=land' },
  { type: 'condo', label: 'คอนโดมิเนียม', description: 'เหมาะพักอาศัยและลงทุนเช่าในเมือง', href: '/buy?type=condo' },
  { type: 'commercial', label: 'อาคารพาณิชย์', description: 'หน้าร้าน เกษตร หรือที่ตั้งธุรกิจ', href: '/buy?type=commercial' },
  { type: 'investment', label: 'ทรัพย์เพื่อการลงทุน', description: 'ไหลเวียนเร็ว ผลตอบแทนชัดเจน', href: '/buy?type=investment' },
  { type: 'consignment', label: 'ทรัพย์รับขายฝาก', description: 'ทรัพย์ปลอดภัย เอกสารสมบูรณ์', href: '/buy?type=consignment' }
];

const navLinks = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/buy', label: 'ซื้อ' },
  { href: '/rent', label: 'เช่า' },
  { href: '/sell', label: 'ฝากขาย' }
];

const serviceLinks = [
  { href: '/services', label: 'บริการของเรา', description: 'บริการครบวงจรด้านอสังหาริมทรัพย์' },
  { href: '/valuation', label: 'ประเมินราคาฟรี', description: 'ประเมินมูลค่าทรัพย์ด้วยข้อมูลตลาดจริง' },
  { href: '/sell', label: 'ฝากขายกับเรา', description: 'ลงประกาศขาย/เช่า พร้อมทีมการตลาด' },
  { href: '/about', label: 'เกี่ยวกับเรา', description: 'ทำความรู้จักทีม Chantakorn Property' }
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auth state from verified backend profile
  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (active) setCurrentUser(profile);
      } catch {
        if (active) setCurrentUser(null);
      }
    };
    loadProfile();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UserProfile | null>).detail || null;
      setCurrentUser(detail);
    };
    window.addEventListener('chantakorn_auth_change', handler);
    return () => {
      active = false;
      window.removeEventListener('chantakorn_auth_change', handler);
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      setIsMenuOpen(false);
      router.push('/');
    }
  };

  const handleMobileNavClick = () => {
    setIsMenuOpen(false);
    setIsBuyDropdownOpen(false);
    setIsServiceDropdownOpen(false);
  };

  const toggleBuyDropdown = () => setIsBuyDropdownOpen((open) => !open);
  const toggleServiceDropdown = () => setIsServiceDropdownOpen((open) => !open);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 bg-navy-950/95 backdrop-blur-md border-b border-white/5">
      <TopBar />
      <nav className={`transition-all duration-300 ${isScrolled ? 'h-14' : 'h-16'} flex items-center`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3 group flex-shrink-0" onClick={handleMobileNavClick}>
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/20 group-hover:shadow-gold-500/40 transition-all duration-300">
                  <Building2 className="w-6 h-6 text-navy-950" strokeWidth={2.2} />
                </div>
                <div className="absolute inset-0 bg-gold-400 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg md:text-xl font-black tracking-tight text-white leading-none">
                  CHANTAKORN
                </span>
                <span className="text-[10px] md:text-xs font-bold tracking-[0.2em] text-gold-400 leading-none mt-1">
                  PROPERTY
                </span>
              </div>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative group ${
                    isActive(link.href)
                      ? 'text-gold-400'
                      : 'text-white hover:text-gold-300'
                  }`}
                >
                  {link.label}
                  <span className={`absolute bottom-0 left-4 right-4 h-0.5 bg-gold-400 transform transition-transform duration-300 ${
                    isActive(link.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`} />
                </Link>
              ))}

              {/* Buy Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsBuyDropdownOpen(true)}
                onMouseLeave={() => setIsBuyDropdownOpen(false)}
              >
                <button
                  onClick={toggleBuyDropdown}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-1 transition-colors duration-200 ${
                    pathname.startsWith('/properties') || pathname.startsWith('/buy')
                      ? 'text-gold-400'
                      : 'text-white hover:text-gold-300'
                  }`}
                >
                  <span>ประเภททรัพย์</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBuyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <div className={`absolute top-full left-0 pt-2 transition-all duration-200 ${
                  isBuyDropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                }`}>
                  <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-[560px]">
                    <div className="grid grid-cols-2 gap-1">
                      {categoryLinks.map((cat) => {
                        const IconComp = categoryIconMap[cat.type] || Building;
                        return (
                          <Link
                            key={cat.type}
                            href={cat.href}
                            onClick={() => setIsBuyDropdownOpen(false)}
                            className="flex items-start space-x-3 p-3 rounded-xl hover:bg-gold-50 transition-colors duration-200 group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-navy-950 transition-colors flex-shrink-0">
                              <IconComp className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-navy-950 leading-snug">{cat.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{cat.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <Link
                        href="/properties"
                        onClick={() => setIsBuyDropdownOpen(false)}
                        className="flex items-center justify-center space-x-1 text-sm font-bold text-gold-600 hover:text-gold-700 py-2 rounded-lg hover:bg-gold-50 transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        <span>ดูประกาศทรัพย์ทั้งหมด</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsServiceDropdownOpen(true)}
                onMouseLeave={() => setIsServiceDropdownOpen(false)}
              >
                <button
                  onClick={toggleServiceDropdown}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-1 transition-colors duration-200 ${
                    ['/services', '/valuation', '/sell', '/about'].some((p) => pathname.startsWith(p))
                      ? 'text-gold-400'
                      : 'text-white hover:text-gold-300'
                  }`}
                >
                  <span>บริการ</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <div className={`absolute top-full left-0 pt-2 transition-all duration-200 ${
                  isServiceDropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                }`}>
                  <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 w-80">
                    {serviceLinks.map((svc) => (
                      <Link
                        key={svc.href}
                        href={svc.href}
                        onClick={() => setIsServiceDropdownOpen(false)}
                        className="flex items-start space-x-3 p-3 rounded-xl hover:bg-gold-50 transition-colors duration-200 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-navy-950 transition-colors flex-shrink-0">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-navy-950">{svc.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link
                href="/contact"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative group ${
                  isActive('/contact') ? 'text-gold-400' : 'text-white hover:text-gold-300'
                }`}
              >
                ติดต่อเรา
                <span className={`absolute bottom-0 left-4 right-4 h-0.5 bg-gold-400 transform transition-transform duration-300 ${
                  isActive('/contact') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`} />
              </Link>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center space-x-3">
              <Link
                href="/favorites"
                className="relative p-2.5 text-white hover:text-gold-300 transition-colors rounded-lg hover:bg-white/5"
                title="รายการโปรด"
              >
                <Heart className="w-5 h-5" />
              </Link>

              {currentUser ? (
                <div className="flex items-center space-x-2">
                  {currentUser.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm transition-all shadow-lg shadow-gold-500/20"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>แอดมิน</span>
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-white/15 hover:border-gold-400/50 text-white hover:text-gold-300 font-semibold text-sm transition-all"
                  >
                    <User className="w-4 h-4" />
                    <span>{currentUser.full_name?.split(' ')[0] || 'โปรไฟล์'}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-white/15 hover:border-gold-400/50 text-white hover:text-gold-300 font-semibold text-sm transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบ</span>
                  </Link>
                  <Link
                    href="/sell"
                    className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm transition-all shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:-translate-y-0.5"
                  >
                    <Home className="w-4 h-4" />
                    <span>ลงประกาศ</span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex lg:hidden items-center space-x-2">
              <Link
                href="/favorites"
                className="relative p-2 text-white hover:text-gold-300 transition-colors"
                title="รายการโปรด"
              >
                <Heart className="w-6 h-6" />
              </Link>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-white hover:text-gold-300 transition-colors"
                aria-label="เปิดเมนู"
              >
                {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`lg:hidden fixed inset-x-0 top-[92px] bottom-0 bg-navy-950 border-t border-white/10 overflow-y-auto transition-all duration-300 z-40 ${
        isMenuOpen ? 'translate-x-0 opacity-100 visible' : 'translate-x-full opacity-0 invisible'
      }`}>
        <div className="px-4 py-6 space-y-1 pb-32">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleMobileNavClick}
              className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-colors ${
                isActive(link.href)
                  ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                  : 'text-white hover:bg-white/5'
              }`}
            >
              {link.label}
              <ChevronRight className="w-4 h-4 opacity-50" />
            </Link>
          ))}

          {/* Mobile: Property Types Accordion */}
          <div className="rounded-xl overflow-hidden">
            <button
              onClick={toggleBuyDropdown}
              className={`w-full flex items-center justify-between px-4 py-3.5 font-semibold transition-colors ${
                isBuyDropdownOpen ? 'bg-white/5 text-gold-400' : 'text-white hover:bg-white/5'
              }`}
            >
              <span>ประเภททรัพย์</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBuyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isBuyDropdownOpen && (
              <div className="pb-2">
                {categoryLinks.map((cat) => {
                  const IconComp = categoryIconMap[cat.type] || Building;
                  return (
                    <Link
                      key={cat.type}
                      href={cat.href}
                      onClick={handleMobileNavClick}
                      className="flex items-center space-x-3 px-6 py-3 text-sm text-gray-200 hover:text-gold-300 hover:bg-white/5 transition-colors"
                    >
                      <IconComp className="w-4 h-4 text-gold-500" />
                      <span>{cat.label}</span>
                    </Link>
                  );
                })}
                <Link
                  href="/properties"
                  onClick={handleMobileNavClick}
                  className="flex items-center space-x-3 px-6 py-3 text-sm font-bold text-gold-400 hover:bg-white/5 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>ดูประกาศทั้งหมด</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: Services Accordion */}
          <div className="rounded-xl overflow-hidden">
            <button
              onClick={toggleServiceDropdown}
              className={`w-full flex items-center justify-between px-4 py-3.5 font-semibold transition-colors ${
                isServiceDropdownOpen ? 'bg-white/5 text-gold-400' : 'text-white hover:bg-white/5'
              }`}
            >
              <span>บริการ</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isServiceDropdownOpen && (
              <div className="pb-2">
                {serviceLinks.map((svc) => (
                  <Link
                    key={svc.href}
                    href={svc.href}
                    onClick={handleMobileNavClick}
                    className="flex items-center space-x-3 px-6 py-3 text-sm text-gray-200 hover:text-gold-300 hover:bg-white/5 transition-colors"
                  >
                    <Briefcase className="w-4 h-4 text-gold-500" />
                    <span>{svc.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/contact"
            onClick={handleMobileNavClick}
            className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-colors ${
              isActive('/contact') ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20' : 'text-white hover:bg-white/5'
            }`}
          >
            ติดต่อเรา
            <ChevronRight className="w-4 h-4 opacity-50" />
          </Link>

          {/* Mobile: Auth Section */}
          <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
            {currentUser ? (
              <>
                <Link
                  href="/profile"
                  onClick={handleMobileNavClick}
                  className="flex items-center space-x-3 px-4 py-3.5 rounded-xl bg-white/5 text-white font-semibold"
                >
                  <User className="w-5 h-5 text-gold-400" />
                  <span>{currentUser.full_name || 'โปรไฟล์ของฉัน'}</span>
                </Link>
                {currentUser.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    onClick={handleMobileNavClick}
                    className="flex items-center space-x-3 px-4 py-3.5 rounded-xl bg-gold-500 text-navy-950 font-bold"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span>แผงควบคุมแอดมิน</span>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl bg-red-500/10 text-red-400 font-semibold"
                >
                  <LogOut className="w-5 h-5" />
                  <span>ออกจากระบบ</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={handleMobileNavClick}
                  className="flex items-center justify-center space-x-1.5 px-4 py-3.5 rounded-xl border border-white/15 text-white font-semibold"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </Link>
                <Link
                  href="/sell"
                  onClick={handleMobileNavClick}
                  className="flex items-center justify-center space-x-1.5 px-4 py-3.5 rounded-xl bg-gold-500 text-navy-950 font-bold"
                >
                  <Home className="w-4 h-4" />
                  <span>ลงประกาศ</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: Contact Info */}
          <div className="pt-6 mt-2 border-t border-white/10">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ติดต่อสื่อสาร</p>
            <a
              href="tel:0816040097"
              className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-200 hover:text-gold-300 transition-colors"
            >
              <Phone className="w-4 h-4 text-gold-400" />
              <span>โทร: 081-604-0097</span>
            </a>
            <a
              href={formatLineUrl('@930xzcyi')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-200 hover:text-gold-300 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#06C755]" />
              <span>LINE Official: @930xzcyi (คลิกเพื่อแอดไลน์)</span>
            </a>
            <a
              href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-200 hover:text-gold-300 transition-colors"
            >
              <Facebook className="w-4 h-4 text-[#3b82f6]" />
              <span>Facebook: Chantakorn Property หน้าหลัก</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
