'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Copy, Edit3, ExternalLink, FileText, Layers, LoaderCircle, MapPin, MessageCircle, MessageSquare, Phone, Plus, RefreshCw, Sparkles, Users, Wand2 } from 'lucide-react';
import { fetchAdminProperties, fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import type { Inquiry, Property } from '@/lib/types';
import { formatPrice, formatPropertyCode, formatThaiDate, propertyHref } from '@/lib/utils';
import AdminMonthlyActivity from '@/components/admin/AdminMonthlyActivity';

const InvestmentZoneDistributionMap = dynamic(() => import('@/components/admin/InvestmentZoneDistributionMap'), { loading: () => <p className="p-5 text-sm text-slate-500">กำลังเปิดแผนที่...</p> });
const SystemActivityFeed = dynamic(() => import('@/components/admin/SystemActivityFeed'), { loading: () => <p className="p-5 text-sm text-slate-500">กำลังเปิดประวัติกิจกรรม...</p> });

const businessTools = [
  { title: 'ร่างโพสต์การตลาด', description: 'ข้อความสำหรับ Facebook, TikTok และ LINE', href: '/admin/automation?tab=marketing', icon: Wand2 },
  { title: 'จับคู่ลูกค้ากับทรัพย์', description: 'ค้นหาทรัพย์ที่ตรงกับผู้สนใจ', href: '/admin/automation?tab=leads', icon: Users },
  { title: 'ประเมินราคาและผลตอบแทน', description: 'ค่างวด ผลตอบแทน และข้อมูลที่ดิน', href: '/admin/automation?tab=valuation', icon: MapPin },
  { title: 'ร่างสัญญา', description: 'จัดเตรียมสัญญาจะซื้อจะขาย', href: '/admin/automation?tab=contracts', icon: FileText },
  { title: 'ติดตามเฟสงาน', description: 'ติดตามขั้นตอนและงานของทีม', href: '/admin/work-phases', icon: Layers },
  { title: 'ประเมินที่ดิน / LandsMaps', description: 'ค้นหาแปลงและประเมินราคาที่ดิน', href: '/admin/valuation', icon: MapPin },
];

const inquiryStatusLabels: Record<Inquiry['status'], string> = { new: 'รอติดต่อ', contacted: 'ติดต่อแล้ว', scheduled: 'นัดชมแล้ว', closed: 'ปิดรายการ' };

export default function AdminDashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [copiedWebsite, setCopiedWebsite] = useState(false);
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const requestRevision = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatingInquiryRef = useRef(false);

  const loadDashboardData = useCallback(async () => {
    const revision = ++requestRevision.current;
    setLoading(true);
    setError('');
    try {
      const [propertyData, inquiryData] = await Promise.all([fetchAdminProperties(), fetchInquiries()]);
      if (revision !== requestRevision.current) return;
      setProperties(propertyData);
      setInquiries(inquiryData);
      setUpdatedAt(new Date());
    } catch (err) {
      if (revision === requestRevision.current) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
    return () => {
      requestRevision.current += 1;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [loadDashboardData]);

  const handleQuickStatusUpdate = async (id: string, status: Inquiry['status']) => {
    if (updatingInquiryRef.current) return;
    updatingInquiryRef.current = true;
    setUpdatingInquiryId(id);
    setActionMessage('');
    try {
      const saved = await updateInquiryStatus(id, status);
      if (!saved) throw new Error('บันทึกสถานะไม่สำเร็จ กรุณาลองอีกครั้ง');
      setInquiries((items) => items.map((item) => item.id === id ? saved : item));
      setActionMessage(`บันทึกสถานะเป็น “${inquiryStatusLabels[saved.status]}” แล้ว`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'ไม่สามารถบันทึกสถานะได้');
    } finally {
      updatingInquiryRef.current = false;
      setUpdatingInquiryId(null);
    }
  };

  const handleCopyWebsiteLink = async () => {
    setActionMessage('');
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedWebsite(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedWebsite(false), 2500);
    } catch {
      setActionMessage('คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกจากแถบที่อยู่ของหน้าเว็บไซต์');
    }
  };

  const saleCount = properties.filter((property) => property.status === 'sale').length;
  const rentCount = properties.filter((property) => property.status === 'rent').length;
  const publishedCount = properties.filter((property) => property.published).length;
  const draftCount = properties.length - publishedCount;
  const newInquiries = inquiries.filter((inquiry) => inquiry.status === 'new');
  const scheduledCount = inquiries.filter((inquiry) => inquiry.status === 'scheduled').length;
  const featuredCount = properties.filter((property) => property.featured).length;
  const latestProperties = [...properties].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)).slice(0, 4);
  const priorityInquiries = [...inquiries].sort((a, b) => Number(b.status === 'new') - Number(a.status === 'new') || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)).slice(0, 5);
  const stats = [
    { label: 'ทรัพย์ทั้งหมด', count: properties.length, note: `${saleCount} ขาย · ${rentCount} เช่า`, href: '/admin/properties', icon: Building2 },
    { label: 'เผยแพร่บนเว็บ', count: publishedCount, note: 'รายการที่ลูกค้าเปิดดูได้', href: '/admin/properties?filter=published', icon: CheckCircle2 },
    { label: 'ฉบับร่าง', count: draftCount, note: 'เตรียมข้อมูลก่อนเผยแพร่', href: '/admin/properties?filter=draft', icon: FileText },
    { label: 'ลูกค้ารอติดต่อ', count: newInquiries.length, note: `${scheduledCount} รายการนัดชมแล้ว`, href: '/admin/inquiries?filter=new', icon: MessageSquare },
  ];
  const dataUnavailable = Boolean(error) && !updatedAt;

  return (
    <div className="space-y-6 sm:space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-semibold tracking-wider text-gold-700">CHANTAKORN WORKSPACE</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">ภาพรวมวันนี้</h1><p className="mt-2 text-sm text-slate-500">จัดการทรัพย์ ติดตามลูกค้า และวางแผนงานของทีมในที่เดียว</p></div>
        <div className="flex items-center gap-2"><button onClick={() => void loadDashboardData()} disabled={loading} aria-label="รีเฟรชข้อมูลภาพรวม" className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button><Link href="/admin/properties/new" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-bold text-white transition-colors hover:bg-navy-900 sm:flex-none"><Plus className="h-4 w-4 text-gold-300" />เพิ่มทรัพย์ใหม่</Link></div>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{updatedAt ? 'รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า · ' : ''}{error}</span><button disabled={loading} onClick={() => void loadDashboardData()} className="rounded-lg border border-red-200 px-3 py-2 font-semibold">ลองใหม่</button></div>}
      {actionMessage && <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{actionMessage}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({ label, count, note, href, icon: Icon }) => <Link key={label} href={href} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-gold-300 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-500">{label}</p><Icon className="h-4 w-4 shrink-0 text-gold-600" /></div><p className="mt-4 text-3xl font-bold tracking-tight text-navy-950">{loading || dataUnavailable ? '—' : count.toLocaleString('th-TH')}</p><p className="mt-2 text-[11px] leading-relaxed text-slate-400">{dataUnavailable ? 'ยังโหลดข้อมูลไม่ได้' : loading ? 'กำลังโหลดข้อมูล' : note}</p></Link>)}</div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5"><div><h2 className="text-base font-bold text-navy-950">ลูกค้าที่ต้องติดตาม</h2><p className="mt-1 text-xs text-slate-400">แสดงรายการรอติดต่อก่อน ตามด้วยรายการล่าสุด</p></div><Link href="/admin/inquiries" className="inline-flex shrink-0 items-center gap-1 py-1 text-xs font-semibold text-gold-700">ดูทั้งหมด<ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {loading ? <div className="p-7 text-sm text-slate-400" role="status">กำลังโหลดลูกค้า...</div> : dataUnavailable ? <div className="p-7 text-sm text-slate-500">ยังแสดงรายการลูกค้าไม่ได้ กรุณาลองโหลดข้อมูลอีกครั้ง</div> : !priorityInquiries.length ? <div className="flex flex-col items-center px-5 py-12 text-center"><MessageSquare className="mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-navy-950">ยังไม่มีรายการผู้ติดต่อ</p><p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-400">ลูกค้าที่สอบถาม ฝากขาย หรือนัดชมผ่านเว็บจะแสดงที่นี่</p></div> : <div className="divide-y divide-slate-100">{priorityInquiries.map((inquiry) => <article key={inquiry.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-navy-950">{inquiry.name}</h3><p className="mt-1 text-[11px] text-slate-400">{formatThaiDate(inquiry.created_at)} · {inquiry.inquiry_type === 'viewing' ? 'นัดชมทรัพย์' : inquiry.inquiry_type === 'consignment_sell' ? 'ฝากขายทรัพย์' : 'สอบถามข้อมูล'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${inquiry.status === 'new' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{inquiryStatusLabels[inquiry.status]}</span></div>{inquiry.property_title && <p className="mt-2 truncate text-xs text-gold-700">{inquiry.property_title}</p>}<p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-slate-500">{inquiry.message}</p><div className="mt-3 flex flex-wrap items-center gap-2">{inquiry.phone && <a href={`tel:${inquiry.phone}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-navy-950"><Phone className="h-3 w-3" />{inquiry.phone}</a>}{inquiry.line_id && <a href={`https://line.me/R/ti/p/${encodeURIComponent(inquiry.line_id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700"><MessageCircle className="h-3 w-3" />LINE</a>}{inquiry.status === 'new' && <button disabled={updatingInquiryId !== null} onClick={() => void handleQuickStatusUpdate(inquiry.id, 'contacted')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-navy-950 px-2.5 text-xs font-semibold text-white disabled:opacity-50">{updatingInquiryId === inquiry.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}ติดต่อแล้ว</button>}{inquiry.status === 'contacted' && <button disabled={updatingInquiryId !== null} onClick={() => void handleQuickStatusUpdate(inquiry.id, 'new')} className="min-h-9 px-2 text-[11px] text-slate-400 disabled:opacity-50">คืนเป็นรอติดต่อ</button>}</div></article>)}</div>}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5"><div><h2 className="text-base font-bold text-navy-950">ทรัพย์ล่าสุด</h2><p className="mt-1 text-xs text-slate-400">เปิดดูหรือแก้ไขข้อมูลได้ทันที</p></div><Link href="/admin/properties" className="inline-flex shrink-0 items-center gap-1 py-1 text-xs font-semibold text-gold-700">ดูทั้งหมด<ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {loading ? <div className="p-7 text-sm text-slate-400" role="status">กำลังโหลดทรัพย์...</div> : dataUnavailable ? <div className="p-7 text-sm text-slate-500">ยังแสดงรายการทรัพย์ไม่ได้ กรุณาลองโหลดข้อมูลอีกครั้ง</div> : !latestProperties.length ? <div className="px-5 py-12 text-center"><Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-navy-950">เริ่มต้นด้วยทรัพย์รายการแรก</p><Link href="/admin/properties/new" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-gold-700"><Plus className="h-3.5 w-3.5" />เพิ่มทรัพย์ใหม่</Link></div> : <div className="divide-y divide-slate-100">{latestProperties.map((property) => <article key={property.id} className="flex gap-3 px-5 py-4"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">{property.cover_image ? <Image src={property.cover_image} alt={property.title} fill unoptimized referrerPolicy="no-referrer" className="object-cover" /> : <Building2 className="h-6 w-6 text-slate-300" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[10px] font-medium text-slate-400">{formatPropertyCode(property.id)}</span><span className={`text-[10px] font-medium ${property.published ? 'text-emerald-700' : 'text-amber-700'}`}>{property.published ? 'เผยแพร่' : 'ฉบับร่าง'}</span></div><h3 className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-navy-950">{property.title}</h3><p className="mt-1 text-xs font-bold text-navy-950">{formatPrice(property.price, property.status)}</p><div className="mt-2 flex flex-wrap items-center gap-3"><Link href={`/admin/properties/new?id=${encodeURIComponent(property.id)}`} className="inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-gold-700"><Edit3 className="h-3 w-3" />แก้ไข</Link>{property.published && <Link href={propertyHref(property.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-[11px] text-slate-500"><ExternalLink className="h-3 w-3" />หน้าเว็บ</Link>}</div></div></article>)}</div>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">{[{ label: 'ขาย', count: saleCount, filter: 'sale' }, { label: 'เช่า', count: rentCount, filter: 'rent' }, { label: 'ทรัพย์เด่น', count: featuredCount, filter: 'featured' }].map((item) => <Link key={item.filter} href={`/admin/properties?filter=${item.filter}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500">{item.label} <span className="ml-1 font-semibold text-navy-950">{loading || dataUnavailable ? '—' : item.count}</span></Link>)}</div>
        </section>
      </div>

      <section className="rounded-2xl bg-navy-950 px-5 py-5 text-white sm:px-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-base font-bold">ส่งทรัพย์และติดตามงานได้เร็วขึ้น</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">เลือกทรัพย์แล้วกดส่ง LINE ถึงผู้ติดตาม OA หรือแชร์ลิงก์เว็บไซต์ให้ลูกค้า</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/admin/properties" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gold-400 px-4 text-xs font-bold text-navy-950"><MessageCircle className="h-4 w-4" />เลือกทรัพย์ส่ง LINE</Link><button onClick={() => void handleCopyWebsiteLink()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-medium text-slate-200">{copiedWebsite ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{copiedWebsite ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์เว็บ'}</button></div></div></section>

      <AdminMonthlyActivity properties={properties} inquiries={inquiries} loading={loading} unavailable={dataUnavailable} now={updatedAt || undefined} />

      <details className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-5"><span className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-gold-600" /><span><span className="block text-sm font-bold text-navy-950">เครื่องมือธุรกิจและผู้ช่วย AI</span><span className="mt-1 block text-xs font-normal text-slate-400">ร่างโพสต์ จับคู่ลูกค้า ประเมินราคา และร่างสัญญา</span></span></span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary><div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-3">{businessTools.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-gold-300"><Icon className="mb-3 h-5 w-5 text-gold-600" /><span className="block text-xs font-semibold text-navy-950">{title}</span><span className="mt-2 block text-[11px] leading-relaxed text-slate-400">{description}</span></Link>)}</div></details>

      <details onToggle={(event) => setMapOpen(event.currentTarget.open)} className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-5"><span><span className="block text-sm font-bold text-navy-950">แผนที่ทรัพย์และโซนการลงทุน</span><span className="mt-1 block text-xs text-slate-400">เปิดดูการกระจายตัวของทรัพย์ตามพื้นที่</span></span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary>{mapOpen && <div className="border-t border-slate-100 p-3 sm:p-5">{loading || dataUnavailable ? <p className="p-4 text-sm text-slate-500">{loading ? 'กำลังโหลดข้อมูลทรัพย์...' : 'กรุณาโหลดข้อมูลทรัพย์อีกครั้งก่อนเปิดแผนที่'}</p> : <InvestmentZoneDistributionMap properties={properties} />}</div>}</details>

      <details onToggle={(event) => setActivityOpen(event.currentTarget.open)} className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-5"><span><span className="block text-sm font-bold text-navy-950">ประวัติกิจกรรมของทีม</span><span className="mt-1 block text-xs text-slate-400">ค้นหาและตรวจสอบรายการเปลี่ยนแปลงในระบบ</span></span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary>{activityOpen && <div className="border-t border-slate-100 p-3 sm:p-5"><SystemActivityFeed /></div>}</details>
      {updatedAt && <p className="text-center text-[11px] text-slate-400">อัปเดตล่าสุด {updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ข้อมูลจากรายการในระบบ</p>}
    </div>
  );
}
