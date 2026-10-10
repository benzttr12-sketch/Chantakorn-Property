'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Phone,
  MessageCircle,
  Clock,
  Search,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Loader2,
  ChevronDown,
  UserRound,
} from 'lucide-react';
import { fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import { logSystemActivity } from '@/lib/store/activity-store';
import { Inquiry } from '@/lib/types';
import { formatThaiDate, formatPropertyCode } from '@/lib/utils';

type InquiryFilter = 'all' | Inquiry['status'];
const statusOptions: { id: InquiryFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'new', label: 'รอติดต่อ' },
  { id: 'contacted', label: 'ติดต่อแล้ว' },
  { id: 'scheduled', label: 'นัดหมายแล้ว' },
  { id: 'closed', label: 'ปิดงาน' },
];
const typeLabels: Record<Inquiry['inquiry_type'], string> = {
  viewing: 'ขอนัดชมทรัพย์',
  consignment_sell: 'ฝากขายทรัพย์',
  inquiry: 'สอบถามทรัพย์',
};
function readInquiryFilter(value: string | null | undefined): InquiryFilter {
  return statusOptions.some((option) => option.id === value) ? (value as InquiryFilter) : 'all';
}

function InquiriesContent() {
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryFilter>(() =>
    readInquiryFilter(searchParams?.get('filter')),
  );
  const [typeFilter, setTypeFilter] = useState<'all' | Inquiry['inquiry_type']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadInquiries = async () => {
    setLoading(true);
    setError('');
    try {
      setInquiries(await fetchInquiries());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดรายการลูกค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
  }, []);
  useEffect(() => {
    setStatusFilter(readInquiryFilter(searchParams?.get('filter')));
  }, [searchParams]);

  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status']) => {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setFeedback('');
    try {
      const saved = await updateInquiryStatus(id, newStatus);
      if (!saved) throw new Error('ไม่พบรายการผู้ติดต่อนี้');
      setInquiries((current) => current.map((inquiry) => (inquiry.id === id ? saved : inquiry)));
      const statusLabel =
        statusOptions.find((option) => option.id === saved.status)?.label || saved.status;
      setFeedback(`บันทึกสถานะ “${statusLabel}” ของ ${saved.name} เรียบร้อยแล้ว`);
      logSystemActivity({
        category: 'inquiry',
        action: 'inquiry_status_updated',
        title: 'อัปเดตสถานะผู้ติดต่อ/ฝากขาย',
        description: `เปลี่ยนสถานะลูกค้า "${saved.name}" เป็น [${statusLabel}]`,
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

  const handleCopyPhone = async (id: string, phone: string) => {
    setFeedback('');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(id);
      setFeedback('คัดลอกเบอร์โทรศัพท์แล้ว');
      setTimeout(() => setCopiedPhoneId((current) => (current === id ? null : current)), 2000);
    } catch {
      setError('คัดลอกเบอร์โทรไม่สำเร็จ กรุณาอนุญาตการคัดลอกในเบราว์เซอร์แล้วลองอีกครั้ง');
    }
  };

  const filtered = inquiries
    .filter((inquiry) => {
      if (statusFilter !== 'all' && inquiry.status !== statusFilter) return false;
      if (typeFilter !== 'all' && inquiry.inquiry_type !== typeFilter) return false;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return [
        inquiry.name,
        inquiry.phone,
        inquiry.line_id,
        inquiry.property_title,
        inquiry.message,
        inquiry.property_id ? formatPropertyCode(inquiry.property_id) : '',
      ].some((value) => value?.toLowerCase().includes(query));
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || searchQuery.trim() !== '';
  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
            CUSTOMER WORKSPACE
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">
            ลูกค้าและนัดชม
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            ติดตามผู้สนใจซื้อ เช่า และฝากขาย พร้อมช่องทางติดต่อในที่เดียว
          </p>
        </div>
        <button
          type="button"
          onClick={loadInquiries}
          disabled={loading || busyId !== null}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy-950 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          โหลดข้อมูลใหม่
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {feedback}
        </p>
      )}

      <section
        aria-label="ค้นหาและกรองลูกค้า"
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="admin-inquiry-search" className="sr-only">
              ค้นหาลูกค้า เบอร์โทร LINE หรือรหัสทรัพย์
            </label>
            <input
              id="admin-inquiry-search"
              type="search"
              placeholder="ค้นหาลูกค้า เบอร์โทร LINE หรือรหัสทรัพย์"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-base text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="inquiry-type-filter"
            onClick={() => setFiltersOpen((value) => !value)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
          >
            ประเภทคำขอ
            {typeFilter !== 'all' && (
              <span className="rounded-full bg-navy-950 px-1.5 text-xs text-white">1</span>
            )}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="สถานะลูกค้า">
          {statusOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition ${statusFilter === option.id ? 'bg-navy-950 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-xs ${statusFilter === option.id ? 'bg-white/15 text-gold-200' : 'bg-white text-slate-500'}`}
              >
                {loading
                  ? '—'
                  : inquiries.filter(
                      (inquiry) => option.id === 'all' || inquiry.status === option.id,
                    ).length}
              </span>
            </button>
          ))}
        </div>
        {filtersOpen && (
          <label
            id="inquiry-type-filter"
            className="block space-y-1.5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500"
          >
            ประเภทคำขอ
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950 sm:max-w-sm"
            >
              <option value="all">ทุกประเภทคำขอ</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p aria-live="polite" className="text-sm text-slate-500">
            {loading
              ? 'กำลังโหลดข้อมูล…'
              : `แสดง ${filtered.length} จาก ${inquiries.length} รายการ · ล่าสุดก่อน`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-9 rounded-lg px-2 text-sm font-semibold text-navy-950 underline underline-offset-4"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-12 text-sm text-slate-500"
        >
          <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
          กำลังโหลดรายการลูกค้า…
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
          <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-semibold text-navy-950">
            {error
              ? 'ยังแสดงรายการลูกค้าไม่ได้'
              : hasFilters
                ? 'ไม่พบลูกค้าตามเงื่อนไข'
                : 'ยังไม่มีคำขอจากลูกค้า'}
          </h2>
          <p className="text-sm text-slate-500">
            {error
              ? 'ลองโหลดข้อมูลใหม่อีกครั้ง'
              : hasFilters
                ? 'ลองใช้คำค้นอื่น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด'
                : 'เมื่อมีคนสอบถาม นัดชม หรือฝากขายผ่านเว็บไซต์ จะแสดงรายการที่นี่'}
          </p>
          {hasFilters && !error && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-navy-950"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inquiry) => (
            <article
              key={inquiry.id}
              className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${inquiry.status === 'new' ? 'bg-gold-100 text-gold-900' : inquiry.status === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}
                    >
                      {statusOptions.find((option) => option.id === inquiry.status)?.label ||
                        inquiry.status}
                    </span>
                    <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                      {typeLabels[inquiry.inquiry_type]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 sm:ml-auto">
                      <Clock className="h-3.5 w-3.5" />
                      {formatThaiDate(inquiry.created_at)}
                    </span>
                  </div>
                  <div>
                    <h2 className="flex items-start gap-2 text-lg font-bold text-navy-950">
                      <UserRound className="mt-1 h-4 w-4 shrink-0 text-gold-600" />
                      <span className="break-words">{inquiry.name}</span>
                    </h2>
                    {inquiry.property_title && (
                      <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
                        สนใจ:{' '}
                        <strong className="font-semibold text-navy-950">
                          {inquiry.property_title}
                        </strong>
                        {inquiry.property_id && (
                          <span className="ml-2 inline-block rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500">
                            {formatPropertyCode(inquiry.property_id)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="whitespace-pre-line break-words rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-navy-950">
                    {inquiry.message || 'ไม่ได้ระบุข้อความเพิ่มเติม'}
                  </p>
                  {inquiry.consignment_details && (
                    <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-gold-100 bg-gold-50/50 p-4 text-sm">
                      <div>
                        <dt className="mb-1 text-xs text-slate-500">ประเภททรัพย์</dt>
                        <dd className="break-words font-medium text-navy-950">
                          {inquiry.consignment_details.property_type}
                        </dd>
                      </div>
                      <div>
                        <dt className="mb-1 text-xs text-slate-500">ทำเล</dt>
                        <dd className="break-words font-medium text-navy-950">
                          {inquiry.consignment_details.district} ·{' '}
                          {inquiry.consignment_details.province}
                        </dd>
                      </div>
                      <div>
                        <dt className="mb-1 text-xs text-slate-500">ราคาเสนอ</dt>
                        <dd className="font-semibold text-navy-950">
                          ฿
                          {new Intl.NumberFormat('th-TH').format(
                            inquiry.consignment_details.expected_price,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="mb-1 text-xs text-slate-500">รูปที่แนบ</dt>
                        <dd className="font-medium text-navy-950">
                          {inquiry.consignment_details.photos_count || 0} ภาพ
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
                <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500">ติดต่อลูกค้า</h3>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${inquiry.phone}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-navy-950 px-3 text-sm font-semibold text-white hover:bg-navy-900"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-gold-400" />
                        <span className="break-all">{inquiry.phone}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(inquiry.id, inquiry.phone)}
                        aria-label={`คัดลอกเบอร์โทรของ ${inquiry.name}`}
                        className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        {copiedPhoneId === inquiry.id ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {inquiry.line_id && (
                      <a
                        href={`https://line.me/R/ti/p/${encodeURIComponent(inquiry.line_id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span className="break-all">LINE: {inquiry.line_id}</span>
                      </a>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor={`inquiry-status-${inquiry.id}`}
                      className="mb-2 block text-xs font-semibold text-slate-500"
                    >
                      สถานะการติดตาม
                    </label>
                    <select
                      id={`inquiry-status-${inquiry.id}`}
                      value={inquiry.status}
                      disabled={busyId !== null}
                      onChange={(event) =>
                        handleUpdateStatus(inquiry.id, event.target.value as Inquiry['status'])
                      }
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-950 disabled:opacity-50"
                    >
                      {statusOptions
                        .filter((option) => option.id !== 'all')
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                    {busyId === inquiry.id && (
                      <p
                        role="status"
                        className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500"
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        กำลังบันทึกสถานะ…
                      </p>
                    )}
                  </div>
                  <details className="rounded-xl border border-slate-100">
                    <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-slate-600">
                      เครื่องมือเพิ่มเติม
                    </summary>
                    <div className="space-y-1 border-t border-slate-100 p-2">
                      <Link
                        href={`/admin/automation?tab=leads&inquiryId=${encodeURIComponent(inquiry.id)}`}
                        className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-navy-950 hover:bg-slate-50"
                      >
                        <Sparkles className="h-4 w-4 shrink-0 text-gold-600" />
                        จับคู่ทรัพย์ด้วย AI
                      </Link>
                      <Link
                        href="/admin/work-phases"
                        className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-navy-950 hover:bg-slate-50"
                      >
                        <Layers className="h-4 w-4 shrink-0 text-gold-600" />
                        ติดตามเฟสงาน
                      </Link>
                    </div>
                  </details>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-center text-sm text-slate-500">
          กำลังโหลดรายการลูกค้า…
        </p>
      }
    >
      <InquiriesContent />
    </Suspense>
  );
}
