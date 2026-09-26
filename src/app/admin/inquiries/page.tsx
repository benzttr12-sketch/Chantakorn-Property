'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MessageSquare, 
  Phone, 
  MessageCircle, 
  Clock, 
  User,
  Search,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import { logSystemActivity } from '@/lib/store/activity-store';
import { Inquiry } from '@/lib/types';
import { formatThaiDate, formatPropertyCode } from '@/lib/utils';

function InquiriesContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'contacted' | 'closed'>(
    ['all', 'new', 'contacted', 'closed'].includes(initialFilter) ? (initialFilter as any) : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const loadInquiries = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchInquiries();
      setInquiries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  // Sync with searchParams if filter changes in URL
  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter && ['all', 'new', 'contacted', 'closed'].includes(urlFilter)) {
      setStatusFilter(urlFilter as any);
    }
  }, [searchParams]);

  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status']) => {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      const saved = await updateInquiryStatus(id, newStatus);
      if (!saved) throw new Error('ไม่พบรายการผู้ติดต่อนี้');
      setInquiries(current => current.map(inquiry => inquiry.id === id ? saved : inquiry));

      const statusLabels: Record<string, string> = {
        new: 'ยังไม่ติดต่อ',
        contacted: 'ติดต่อแล้ว',
        closed: 'ปิดการขาย/เสร็จสิ้น'
      };

      logSystemActivity({
        category: 'inquiry',
        action: 'inquiry_status_updated',
        title: 'อัปเดตสถานะผู้ติดต่อ/ฝากขาย',
        description: `เปลี่ยนสถานะลูกค้า "${saved.name}" เป็น [${statusLabels[newStatus] || newStatus}]`,
        target_id: saved.id,
        target_name: saved.name,
        actor_name: 'ผู้ดูแลระบบ',
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกสถานะไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyPhone = (id: string, phone: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedPhoneId(id);
      setTimeout(() => setCopiedPhoneId(null), 2000);
    }
  };

  const totalCount = inquiries.length;
  const newCount = inquiries.filter(i => i.status === 'new').length;
  const contactedCount = inquiries.filter(i => i.status === 'contacted').length;
  const closedCount = inquiries.filter(i => i.status === 'closed').length;

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const code = inq.property_id ? formatPropertyCode(inq.property_id).toLowerCase() : '';
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.phone.toLowerCase().includes(q) ||
        (inq.line_id && inq.line_id.toLowerCase().includes(q)) ||
        (inq.property_title && inq.property_title.toLowerCase().includes(q)) ||
        (inq.message && inq.message.toLowerCase().includes(q)) ||
        code.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200">
          {error}
        </p>
      )}

      {/* KPI Lead Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-navy-950 text-white border-navy-900 shadow-md ring-2 ring-gold-400/40'
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              statusFilter === 'all' ? 'bg-navy-900 text-gold-400' : 'bg-gray-100 text-navy-900'
            }`}>
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span className={`text-[11px] font-semibold ${statusFilter === 'all' ? 'text-gray-300' : 'text-gray-500'}`}>
              ทั้งหมด
            </span>
          </div>
          <div className="text-2xl font-black">{totalCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'new'
              ? 'bg-amber-500 text-navy-950 border-amber-600 shadow-md ring-2 ring-amber-300'
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
              statusFilter === 'new' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              !
            </div>
            <span className={`text-[11px] font-bold ${statusFilter === 'new' ? 'text-navy-950' : 'text-amber-700'}`}>
              รอดำเนินการ (ใหม่)
            </span>
          </div>
          <div className="text-2xl font-black">{newCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('contacted')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'contacted'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40'
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              statusFilter === 'contacted' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className={`text-[11px] font-semibold ${statusFilter === 'contacted' ? 'text-emerald-100' : 'text-gray-500'}`}>
              ติดต่อลูกค้าแล้ว
            </span>
          </div>
          <div className="text-2xl font-black">{contactedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('closed')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'closed'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/40'
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              statusFilter === 'closed' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className={`text-[11px] font-semibold ${statusFilter === 'closed' ? 'text-purple-100' : 'text-gray-500'}`}>
              ปิดงานเรียบร้อย
            </span>
          </div>
          <div className="text-2xl font-black">{closedCount}</div>
        </button>
      </div>

      {/* Header with Search and Actions */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950">รายการผู้ติดต่อ & ฝากขายทรัพย์</h1>
            <p className="text-xs text-brand-muted mt-0.5">
              ติดตามลูกค้าผู้สนใจซื้อ เช่า หรือฝากขาย พร้อมโทรและทัก LINE ได้ทันที ({filtered.length} จาก {inquiries.length} รายการ)
            </p>
          </div>

          <button
            type="button"
            onClick={loadInquiries}
            disabled={loading}
            className="self-start sm:self-auto px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์, LINE ID, ชื่อทรัพย์ หรือรหัส CK..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 font-medium"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Inquiries Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-surface-border">
            กำลังโหลดรายการผู้ติดต่อ...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-surface-border space-y-2">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="font-bold text-navy-950 text-base">ไม่พบรายการผู้ติดต่อในเงื่อนไขนี้</h3>
            <p className="text-xs text-gray-400">ลองล้างตัวกรองหรือค้นหาด้วยคำใหม่อีกครั้ง</p>
          </div>
        ) : (
          filtered.map((inq) => (
            <div
              key={inq.id}
              className={`bg-white rounded-2xl p-5 sm:p-6 border transition-all flex flex-col md:flex-row justify-between gap-5 ${
                inq.status === 'new' 
                  ? 'border-amber-200 shadow-sm bg-gradient-to-r from-amber-50/20 to-white' 
                  : 'border-surface-border shadow-xs hover:shadow-md'
              }`}
            >
              {/* Left Details */}
              <div className="space-y-3 flex-grow max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    inq.status === 'new'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                      : inq.status === 'contacted'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                  }`}>
                    {{ 
                      new: '• รอดำเนินการ (ใหม่)', 
                      contacted: '✓ ติดต่อลูกค้าแล้ว', 
                      scheduled: 'นัดหมายแล้ว', 
                      closed: 'ปิดรายการแล้ว' 
                    }[inq.status]}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                    {inq.inquiry_type === 'viewing'
                      ? '📍 ขอนัดชมสถานที่จริง'
                      : inq.inquiry_type === 'consignment_sell'
                      ? '🏠 ฝากขายบ้าน / ที่ดิน'
                      : '💬 สอบถามรายละเอียดทรัพย์'}
                  </span>

                  <span className="text-[11px] text-gray-400 ml-auto flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatThaiDate(inq.created_at)}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-navy-950 flex items-center space-x-2">
                    <User className="w-4 h-4 text-gold-600" />
                    <span>{inq.name}</span>
                  </h3>
                  {inq.property_title && (
                    <div className="text-xs text-gold-700 font-semibold mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>ทรัพย์ที่สนใจ: <strong>{inq.property_title}</strong></span>
                      {inq.property_id && (
                        <span className="font-mono text-[10px] bg-gold-100/80 text-navy-950 px-1.5 py-0.2 rounded font-bold border border-gold-300/60">
                          รหัส: {formatPropertyCode(inq.property_id)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl text-xs text-gray-800 leading-relaxed whitespace-pre-line border border-gray-100">
                  {inq.message}
                </div>

                {inq.consignment_details && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-gray-600 bg-gold-50/60 p-3 rounded-xl border border-gold-200">
                    <div>
                      <span className="text-gray-400 block">ประเภททรัพย์:</span>
                      <strong className="text-navy-950">{inq.consignment_details.property_type}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ทำเลที่ตั้ง:</span>
                      <strong className="text-navy-950">{inq.consignment_details.district}, {inq.consignment_details.province}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ราคาเสนอ:</span>
                      <strong className="text-gold-700">฿{new Intl.NumberFormat('th-TH').format(inq.consignment_details.expected_price)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">รูปถ่ายที่แนบ:</span>
                      <strong className="text-navy-950">{inq.consignment_details.photos_count || 0} ภาพ</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 space-y-3 flex-shrink-0 md:w-56">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    ช่องทางติดต่อด่วน
                  </span>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${inq.phone}`}
                      className="flex-1 py-2 px-3 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                      title="กดโทรออกทันที"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>โทร: {inq.phone}</span>
                    </a>
                    
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(inq.id, inq.phone)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs transition-colors cursor-pointer"
                      title="คัดลอกเบอร์โทร"
                    >
                      {copiedPhoneId === inq.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                  </div>

                  {inq.line_id && (
                    <a
                      href={`https://line.me/R/ti/p/${inq.line_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                      title="เปิด LINE คุยกับลูกค้า"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>LINE: {inq.line_id}</span>
                    </a>
                  )}

                  <Link
                    href={`/admin/automation?tab=leads&inquiryId=${encodeURIComponent(inq.id)}`}
                    className="w-full py-2 px-3 bg-gradient-to-r from-navy-950 to-blue-900 hover:from-navy-900 hover:to-blue-800 text-gold-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-all border border-gold-500/20"
                    title="ให้ AI ค้นหาและจับคู่ทรัพย์ที่ตรงกับความต้องการของลูกค้ารายนี้"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                    <span>🎯 จับคู่ทรัพย์ AI</span>
                  </Link>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    เปลี่ยนสถานะใน 1 คลิก
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleUpdateStatus(inq.id, 'new')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        inq.status === 'new'
                          ? 'bg-amber-500 text-navy-950 font-black shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-900'
                      }`}
                      title="ตั้งเป็นรอดำเนินการ"
                    >
                      ใหม่
                    </button>

                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleUpdateStatus(inq.id, 'contacted')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        inq.status === 'contacted'
                          ? 'bg-emerald-600 text-white font-black shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-900'
                      }`}
                      title="ตั้งเป็นติดต่อแล้ว"
                    >
                      ติดต่อแล้ว
                    </button>

                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleUpdateStatus(inq.id, 'closed')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        inq.status === 'closed'
                          ? 'bg-purple-600 text-white font-black shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-900'
                      }`}
                      title="ตั้งเป็นปิดงาน"
                    >
                      ปิดงาน
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">กำลังโหลด...</div>}>
      <InquiriesContent />
    </Suspense>
  );
}
