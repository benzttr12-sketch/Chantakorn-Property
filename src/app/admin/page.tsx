'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  Tag, 
  Key, 
  MessageSquare, 
  TrendingUp, 
  PlusCircle, 
  ArrowUpRight, 
  Eye, 
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  Edit3,
  Star,
  Layers,
  MapPin,
  Check,
  Sparkles,
  Wand2,
  FileText,
  Users
} from 'lucide-react';
import { fetchAdminProperties, fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import { Property, Inquiry } from '@/lib/types';
import { formatPrice, propertyHref, formatPropertyCode, getPropertyTypeName, formatThaiDate } from '@/lib/utils';
import SystemActivityFeed from '@/components/admin/SystemActivityFeed';

export default function AdminDashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedWebsite, setCopiedWebsite] = useState(false);
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      const [p, inq] = await Promise.all([fetchAdminProperties(), fetchInquiries()]);
      setProperties(p);
      setInquiries(inq);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleQuickStatusUpdate = async (id: string, newStatus: Inquiry['status']) => {
    setUpdatingInquiryId(id);
    try {
      await updateInquiryStatus(id, newStatus);
      setInquiries(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสถานะได้');
    } finally {
      setUpdatingInquiryId(null);
    }
  };

  const handleCopyWebsiteLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(origin);
      setCopiedWebsite(true);
      setTimeout(() => setCopiedWebsite(false), 2000);
    }
  };

  const totalListings = properties.length;
  const saleListings = properties.filter((p) => p.status === 'sale').length;
  const rentListings = properties.filter((p) => p.status === 'rent').length;
  const featuredListings = properties.filter((p) => p.featured).length;
  const totalInquiries = inquiries.length;
  const newInquiries = inquiries.filter((i) => i.status === 'new').length;

  const statCards = [
    {
      title: 'ทรัพย์ทั้งหมด',
      value: totalListings,
      change: `${saleListings} ขาย / ${rentListings} เช่า`,
      icon: Building2,
      color: 'text-navy-950',
      bg: 'bg-blue-50',
      href: '/admin/properties',
    },
    {
      title: 'ทรัพย์สำหรับขาย',
      value: saleListings,
      change: 'พร้อมเปิดให้เข้าชม',
      icon: Tag,
      color: 'text-gold-700',
      bg: 'bg-gold-50',
      href: '/admin/properties?status=sale',
    },
    {
      title: 'ทรัพย์สำหรับเช่า',
      value: rentListings,
      change: 'สัญญาพร้อมเข้าอยู่',
      icon: Key,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      href: '/admin/properties?status=rent',
    },
    {
      title: 'ข้อความ & ผู้สนใจ',
      value: totalInquiries,
      change: newInquiries > 0 ? `🔥 ${newInquiries} รายการรอติดต่อกลับ` : 'ตอบกลับครบทุกรายแล้ว',
      icon: MessageSquare,
      color: newInquiries > 0 ? 'text-amber-700' : 'text-purple-700',
      bg: newInquiries > 0 ? 'bg-amber-50' : 'bg-purple-50',
      href: '/admin/inquiries',
    },
  ];

  // Demo trend data for visualizations
  const trendMonths = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.'];
  const listingData = [12, 15, 18, 22, 28, Math.max(32, properties.length)];
  const inquiryData = [8, 14, 19, 25, 34, Math.max(42, inquiries.length)];

  return (
    <div className="space-y-6 sm:space-y-8">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 border border-navy-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-gold-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            CHANTAKORN PROPERTY CONTROL CENTER
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            แดชบอร์ดจัดการระบบ
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl">
            ศูนย์ควบคุมจัดการอสังหาริมทรัพย์ ตรวจสอบผู้ติดต่อ และติดตามผลงานในเขตหาดใหญ่–สงขลา
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyWebsiteLink}
            className="px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-gray-200 hover:text-white font-semibold text-xs rounded-xl border border-navy-700 flex items-center space-x-2 transition-all cursor-pointer"
            title="คัดลอกลิงก์หน้าแรกเว็บไซต์ส่งให้ลูกค้า"
          >
            {copiedWebsite ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">คัดลอกลิงก์แล้ว!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-gold-400" />
                <span>แชร์ลิงก์หน้าเว็บ</span>
              </>
            )}
          </button>

          <Link
            href="/admin/properties/new"
            className="px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-navy-950" />
            <span>+ ลงประกาศทรัพย์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Quick Action Shortcuts (แผงทางลัดด่วน) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-surface-border shadow-xs">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          ⚡ เมนูลัดใช้งานบ่อย (Quick Shortcuts)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/properties/new"
            className="p-3.5 rounded-xl bg-navy-50 hover:bg-navy-100/80 border border-navy-100 transition-all flex items-center space-x-3 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-navy-950 text-gold-400 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5 text-gold-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-navy-950 group-hover:text-gold-600 truncate">ลงประกาศทรัพย์ใหม่</div>
              <div className="text-[10px] text-gray-500">กรอกข้อมูล & อัปโหลดรูป</div>
            </div>
          </Link>

          <Link
            href="/admin/inquiries?filter=new"
            className={`p-3.5 rounded-xl border transition-all flex items-center space-x-3 group cursor-pointer ${
              newInquiries > 0 
                ? 'bg-amber-50/80 hover:bg-amber-100 border-amber-200' 
                : 'bg-gray-50 hover:bg-gray-100 border-gray-100'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform ${
              newInquiries > 0 ? 'bg-amber-500 text-navy-950' : 'bg-gray-200 text-gray-700'
            }`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-navy-950 flex items-center gap-1.5 truncate">
                <span>ผู้ติดต่อใหม่</span>
                {newInquiries > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-navy-950 font-black text-[10px] rounded-full">
                    {newInquiries}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {newInquiries > 0 ? 'รอโทรกลับด่วน' : 'ไม่มีค้างติดต่อ'}
              </div>
            </div>
          </Link>

          <Link
            href="/admin/properties"
            className="p-3.5 rounded-xl bg-blue-50/60 hover:bg-blue-100/70 border border-blue-100 transition-all flex items-center space-x-3 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-navy-950 group-hover:text-blue-700 truncate">จัดการคลังทรัพย์</div>
              <div className="text-[10px] text-gray-500">{totalListings} รายการในระบบ</div>
            </div>
          </Link>

          <Link
            href="/admin/properties?filter=featured"
            className="p-3.5 rounded-xl bg-gold-50/60 hover:bg-gold-100/70 border border-gold-100 transition-all flex items-center space-x-3 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-gold-500 text-navy-950 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <Star className="w-5 h-5 fill-navy-950" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-navy-950 group-hover:text-gold-700 truncate">ทรัพย์เด่นหน้าแรก</div>
              <div className="text-[10px] text-gray-500">{featuredListings} รายการแนะนำ</div>
            </div>
          </Link>
        </div>
      </div>

      {/* AI Automation Super Suite Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 text-white p-6 sm:p-7 border border-gold-500/30 shadow-xl space-y-4">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>ระบบอัตโนมัติ AI อัจฉริยะ (AI Automation Suite)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              เพิ่มยอดขายและทุ่นแรงนายหน้า 10 เท่าด้วยระบบอัตโนมัติ
            </h2>
            <p className="text-xs text-gray-300 max-w-2xl">
              สร้างโพสต์การตลาดทุกแพลตฟอร์ม จับคู่ผู้สนใจกับทรัพย์อัตโนมัติ ร่างสัญญาจะซื้อจะขาย และวิเคราะห์ผลตอบแทน Yield ในคลิกเดียว
            </p>
          </div>

          <Link
            href="/admin/automation"
            className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-navy-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all self-start sm:self-auto flex-shrink-0"
          >
            <span>เปิดศูนย์ระบบอัตโนมัติ</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <Link
            href="/admin/automation?tab=marketing"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-gold-300 truncate">ผลิตคอนเทนต์ AI</div>
              <div className="text-[10px] text-gray-400">FB, TikTok, LINE, IG</div>
            </div>
          </Link>

          <Link
            href="/admin/automation?tab=leads"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">จับคู่ลูกค้าอัจฉริยะ</div>
              <div className="text-[10px] text-gray-400">Smart Lead Matcher</div>
            </div>
          </Link>

          <Link
            href="/admin/automation?tab=valuation"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-blue-300 truncate">ประเมินราคา & Yield</div>
              <div className="text-[10px] text-gray-400">ค่างวดผ่อน & ROI</div>
            </div>
          </Link>

          <Link
            href="/admin/automation?tab=contracts"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-amber-300 truncate">ร่างสัญญาจะซื้อจะขาย</div>
              <div className="text-[10px] text-gray-400">พิมพ์สัญญา A4 ใน 1 คลิก</div>
            </div>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              href={c.href}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-surface-border shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 group-hover:text-navy-950 transition-colors">{c.title}</span>
                <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className={`text-3xl font-black ${c.color}`}>
                  {c.value}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 flex items-center font-medium">
                  <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
                  <span>{c.change}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recently Added Properties (ทรัพย์ที่ลงประกาศล่าสุด) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-surface-border shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-navy-950 text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gold-600" />
              <span>อสังหาริมทรัพย์ที่ลงประกาศล่าสุด</span>
            </h3>
            <p className="text-xs text-gray-500">ทรัพย์ล่าสุดที่เพิ่มในระบบ พร้อมดูหน้าเว็บหรือแก้ไขทันที</p>
          </div>
          <Link
            href="/admin/properties"
            className="text-xs font-bold text-navy-950 hover:text-gold-600 flex items-center space-x-1"
          >
            <span>ดูทั้งหมด ({properties.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">กำลังโหลดรายการทรัพย์...</div>
        ) : properties.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            ยังไม่มีรายการทรัพย์ในระบบ คลิกที่ &ldquo;+ ลงประกาศทรัพย์ใหม่&rdquo; เพื่อเริ่มต้น
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {properties.slice(0, 4).map((prop) => (
              <div
                key={prop.id}
                className="bg-gray-50/70 hover:bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between transition-all group"
              >
                <div className="space-y-2">
                  <div className="relative w-full h-28 rounded-lg overflow-hidden bg-gray-200 border border-gray-200">
                    <Image
                      src={prop.cover_image}
                      alt={prop.title}
                      fill
                      unoptimized
                      referrerPolicy="no-referrer"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1.5 left-1.5 flex gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        prop.status === 'rent' ? 'bg-emerald-600 text-white' : 'bg-gold-500 text-navy-950'
                      }`}>
                        {prop.status === 'rent' ? 'เช่า' : 'ขาย'}
                      </span>
                      {prop.featured && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-navy-950 flex items-center gap-0.5">
                          ★ เด่น
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 font-mono text-[9px] font-bold bg-navy-950/80 text-white px-1.5 py-0.5 rounded">
                      {formatPropertyCode(prop.id)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-navy-950 text-xs line-clamp-1 group-hover:text-gold-600">
                      {prop.title}
                    </h4>
                    <div className="text-xs font-black text-navy-950 mt-0.5">
                      {formatPrice(prop.price, prop.status)}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center mt-0.5">
                      <MapPin className="w-3 h-3 mr-0.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{prop.district}, {prop.province}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-gray-200/60 flex items-center justify-between gap-1.5">
                  <Link
                    href={propertyHref(prop.slug)}
                    target="_blank"
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-gray-100 text-navy-950 border border-gray-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-gray-500" />
                    <span>ดูหน้าเว็บ</span>
                  </Link>

                  <Link
                    href={`/admin/properties/new?id=${encodeURIComponent(prop.id)}`}
                    className="flex-1 py-1.5 px-2 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3 h-3 text-gold-400" />
                    <span>แก้ไข</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Listings Growth Over Time */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-950 text-base">การเติบโตของรายการทรัพย์ (Listings)</h3>
              <p className="text-xs text-gray-500">จำนวนอสังหาริมทรัพย์ที่รับฝากและเปิดขายในระบบ 6 เดือนย้อนหลัง</p>
            </div>
            <span className="text-xs font-bold text-gold-600 bg-gold-50 px-2.5 py-1 rounded-md">
              +166% Growth
            </span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-4 px-2">
            {listingData.map((val, idx) => {
              const heightPercent = (val / 40) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                  <span className="text-[10px] font-bold text-navy-950 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    style={{ height: `${Math.min(100, Math.max(15, heightPercent))}%` }}
                    className="w-full bg-navy-900 group-hover:bg-gold-500 rounded-t-lg transition-all duration-300 shadow-xs"
                  />
                  <span className="text-[11px] text-gray-500 font-semibold mt-2">
                    {trendMonths[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Inquiries Over Time */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-950 text-base">ยอดผู้ติดต่อ & ฝากขาย (Inquiries)</h3>
              <p className="text-xs text-gray-500">จำนวนข้อความสอบถามและนัดชมทรัพย์ 6 เดือนย้อนหลัง</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              +425% Leads
            </span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-4 px-2">
            {inquiryData.map((val, idx) => {
              const heightPercent = (val / 50) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                  <span className="text-[10px] font-bold text-navy-950 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    style={{ height: `${Math.min(100, Math.max(15, heightPercent))}%` }}
                    className="w-full bg-gold-500 group-hover:bg-gold-600 rounded-t-lg transition-all duration-300 shadow-xs"
                  />
                  <span className="text-[11px] text-gray-500 font-semibold mt-2">
                    {trendMonths[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Inquiries Preview Table with 1-Click Fast Actions */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-surface-border shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-navy-950 text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <span>รายการผู้ติดต่อล่าสุด</span>
            </h3>
            <p className="text-xs text-gray-500">โทรติดต่อกลับหรือเปิด LINE คุยกับลูกค้าได้ทันทีจากตรงนี้</p>
          </div>
          <Link
            href="/admin/inquiries"
            className="text-xs font-bold text-navy-950 hover:text-gold-600 flex items-center space-x-1"
          >
            <span>ดูทั้งหมด ({inquiries.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-semibold">ชื่อผู้ติดต่อ</th>
                <th className="pb-3 font-semibold">ช่องทางติดต่อด่วน</th>
                <th className="pb-3 font-semibold">ประเภท & ทรัพย์</th>
                <th className="pb-3 font-semibold">ข้อความ</th>
                <th className="pb-3 font-semibold">สถานะ</th>
                <th className="pb-3 font-semibold text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">กำลังโหลด...</td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">ไม่มีข้อความผู้ติดต่อใหม่</td>
                </tr>
              ) : (
                inquiries.slice(0, 5).map((inq) => (
                  <tr key={inq.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 font-bold text-navy-950">
                      <div>{inq.name}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{formatThaiDate(inq.created_at)}</div>
                    </td>
                    <td className="py-3 text-gray-600">
                      <div className="flex items-center space-x-2">
                        <a
                          href={`tel:${inq.phone}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-navy-950 text-gold-400 text-[10px] font-bold hover:bg-navy-900 transition-colors"
                          title="กดเพื่อโทรออก"
                        >
                          <Phone className="w-2.5 h-2.5 mr-1" />
                          <span>{inq.phone}</span>
                        </a>
                        {inq.line_id && (
                          <a
                            href={`https://line.me/R/ti/p/${inq.line_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#06C755] text-white text-[10px] font-bold hover:bg-[#05b34c] transition-colors"
                            title="ทัก LINE"
                          >
                            <MessageCircle className="w-2.5 h-2.5 mr-1 fill-current" />
                            <span>LINE</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800 block w-fit">
                        {inq.inquiry_type === 'viewing' ? 'นัดชมสถานที่' : inq.inquiry_type === 'consignment_sell' ? 'ฝากขายทรัพย์' : 'สอบถามข้อมูล'}
                      </span>
                      {inq.property_title && (
                        <span className="text-[10px] text-gold-700 font-medium block truncate max-w-[160px] mt-0.5">
                          {inq.property_title}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">{inq.message}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        inq.status === 'new' 
                          ? 'bg-amber-100 text-amber-800 animate-pulse' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {inq.status === 'new' ? 'รอดำเนินการ' : 'ติดต่อแล้ว'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {inq.status === 'new' ? (
                        <button
                          type="button"
                          disabled={updatingInquiryId === inq.id}
                          onClick={() => handleQuickStatusUpdate(inq.id, 'contacted')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          title="คลิกเพื่อเปลี่ยนสถานะเป็นติดต่อแล้ว"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>เสร็จสิ้น</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingInquiryId === inq.id}
                          onClick={() => handleQuickStatusUpdate(inq.id, 'new')}
                          className="px-2 py-1 text-gray-400 hover:text-amber-600 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                          title="เปลี่ยนกลับเป็นรอดำเนินการ"
                        >
                          ย้อนกลับ
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Activity Feed Timeline */}
      <SystemActivityFeed />
    </div>
  );
}
