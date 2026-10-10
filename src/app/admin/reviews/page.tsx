'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Star,
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Check,
  X,
  ShieldCheck,
  Save,
  Search,
  Loader2,
  UserRound,
} from 'lucide-react';
import {
  Review,
  fetchReviews,
  addReview,
  updateReview,
  deleteReview,
} from '@/lib/store/reviews-store';

const serviceLabels: Record<Review['serviceType'], string> = {
  buy: 'ซื้อทรัพย์',
  sell: 'ฝากขายทรัพย์',
  rent: 'เช่า / ปล่อยเช่า',
  consignment: 'ขายฝาก',
};
const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-50';

function blankReview(): Review {
  return {
    id: '',
    customerName: '',
    customerRole: '',
    propertyTitleOrZone: '',
    agentName: '',
    rating: 0,
    comment: '',
    date: '',
    avatarUrl: '',
    verifiedBuyer: false,
    published: false,
    serviceType: 'buy',
  };
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [notification, setNotification] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const editorRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchReviews(true)
      .then((list) => {
        if (active) setReviews(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'โหลดรีวิวไม่สำเร็จ');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const editingId = editingReview?.id;
  useEffect(() => {
    if (editingId === undefined) return;
    editorRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    editorRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [editingId]);

  const openEditor = (review?: Review) => {
    if (saving) return;
    setFormError('');
    setNotification('');
    setDeleteConfirmId(null);
    setIsCreating(!review);
    setEditingReview(review ? { ...review } : blankReview());
  };
  const closeEditor = () => {
    if (!saving) {
      setEditingReview(null);
      setFormError('');
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingReview || saving) return;
    setFormError('');
    if (!editingReview.customerName.trim() || !editingReview.comment.trim()) {
      setFormError('กรุณากรอกชื่อลูกค้าและข้อความรีวิว');
      return;
    }
    if (
      !Number.isInteger(editingReview.rating) ||
      editingReview.rating < 1 ||
      editingReview.rating > 5
    ) {
      setFormError('กรุณาเลือกคะแนน 1–5 ดาวตามรีวิวของลูกค้า');
      return;
    }
    setSaving(true);
    setNotification('');
    try {
      const { id, date, ...fields } = editingReview;
      const review = {
        ...fields,
        customerName: fields.customerName.trim(),
        comment: fields.comment.trim(),
        customerRole: fields.customerRole.trim(),
        propertyTitleOrZone: fields.propertyTitleOrZone.trim(),
        agentName: fields.agentName.trim(),
        avatarUrl: fields.avatarUrl?.trim() || '',
      };
      const updated = isCreating
        ? await addReview({ ...review, ...(date.trim() ? { date: date.trim() } : {}) })
        : await updateReview(id, { ...review, date: date.trim() });
      setReviews(updated);
      setNotification(
        editingReview.published
          ? 'บันทึกรีวิวและเผยแพร่บนเว็บไซต์แล้ว'
          : 'บันทึกรีวิวเป็นแบบร่างแล้ว',
      );
      setEditingReview(null);
      setIsCreating(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'บันทึกรีวิวไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotification('');
    try {
      setReviews(await deleteReview(id));
      setDeleteConfirmId(null);
      if (editingReview?.id === id) setEditingReview(null);
      setNotification('ลบรีวิวแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบรีวิวไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (statusFilter === 'published' && !review.published) return false;
    if (statusFilter === 'draft' && review.published) return false;
    const query = searchQuery.trim().toLowerCase();
    return (
      !query ||
      [review.customerName, review.comment, review.propertyTitleOrZone, review.agentName].some(
        (value) => value.toLowerCase().includes(query),
      )
    );
  });

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
            CUSTOMER REVIEWS
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">
            รีวิวจากลูกค้า
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            เก็บความคิดเห็นจริง ตรวจข้อมูล และเลือกรีวิวที่จะเผยแพร่บนเว็บไซต์
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => openEditor()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 text-gold-400" />
          เพิ่มรีวิว
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => setReload((value) => value + 1)}
            className="min-h-10 rounded-lg bg-white px-3 font-semibold disabled:opacity-50"
          >
            โหลดใหม่
          </button>
        </div>
      )}
      {notification && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <Check className="h-4 w-4 shrink-0" />
          {notification}
        </p>
      )}

      {editingReview && (
        <form
          ref={editorRef}
          onSubmit={handleSave}
          aria-label={isCreating ? 'เพิ่มรีวิว' : 'แก้ไขรีวิว'}
          className="scroll-mt-24 space-y-5 rounded-3xl border border-gold-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                {isCreating ? 'เพิ่มรีวิวใหม่' : 'แก้ไขรีวิว'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                กรอกตามข้อมูลที่ลูกค้าให้ไว้ ส่วนที่ยังไม่มีข้อมูลเว้นว่างได้
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={closeEditor}
              aria-label="ปิดฟอร์มรีวิว"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {formError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-600">
                ชื่อลูกค้า *
                <input
                  required
                  type="text"
                  value={editingReview.customerName}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, customerName: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-600">
                อาชีพ / ข้อมูลลูกค้า
                <input
                  type="text"
                  value={editingReview.customerRole}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, customerRole: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-600">
              ข้อความรีวิว *
              <textarea
                required
                rows={4}
                value={editingReview.comment}
                onChange={(event) =>
                  setEditingReview({ ...editingReview, comment: event.target.value })
                }
                className={`${inputClass} py-3 leading-relaxed`}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-600">
                คะแนนจากลูกค้า *
                <select
                  required
                  value={editingReview.rating || ''}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, rating: Number(event.target.value) })
                  }
                  className={inputClass}
                >
                  <option value="">เลือกคะแนน</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} ดาว
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-600">
                ประเภทบริการ
                <select
                  value={editingReview.serviceType}
                  onChange={(event) =>
                    setEditingReview({
                      ...editingReview,
                      serviceType: event.target.value as Review['serviceType'],
                    })
                  }
                  className={inputClass}
                >
                  {Object.entries(serviceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-600">
                ทรัพย์ / ทำเล
                <input
                  type="text"
                  value={editingReview.propertyTitleOrZone}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, propertyTitleOrZone: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-600">
                นายหน้าที่ดูแล
                <input
                  type="text"
                  value={editingReview.agentName}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, agentName: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-600">
                วันที่รีวิว
                <input
                  type="text"
                  required={!isCreating}
                  value={editingReview.date}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, date: event.target.value })
                  }
                  placeholder={isCreating ? 'เว้นว่างเพื่อใช้วันที่บันทึก' : 'วันที่รีวิว'}
                  className={inputClass}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-600">
                ลิงก์รูปโปรไฟล์
                <input
                  type="url"
                  value={editingReview.avatarUrl || ''}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, avatarUrl: event.target.value })
                  }
                  placeholder="https://… (ถ้ามี)"
                  className={inputClass}
                />
              </label>
            </div>
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
              <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-navy-950">
                <input
                  type="checkbox"
                  checked={editingReview.verifiedBuyer}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, verifiedBuyer: event.target.checked })
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-navy-950"
                />
                <span>
                  <strong className="block font-semibold">ยืนยันว่าเคยใช้บริการแล้ว</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    เลือกเมื่อทีมตรวจสอบข้อมูลลูกค้าเรียบร้อยแล้ว
                  </span>
                </span>
              </label>
              <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-navy-950">
                <input
                  type="checkbox"
                  checked={editingReview.published}
                  onChange={(event) =>
                    setEditingReview({ ...editingReview, published: event.target.checked })
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-navy-950"
                />
                <span>
                  <strong className="block font-semibold">เผยแพร่รีวิวบนเว็บไซต์</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    ตรวจข้อความและข้อมูลที่ลูกค้ายินยอมให้แสดงก่อนเผยแพร่
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={closeEditor}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 text-gold-400" />
              )}
              {saving
                ? 'กำลังบันทึก…'
                : editingReview.published
                  ? 'บันทึกและเผยแพร่'
                  : 'บันทึกแบบร่าง'}
            </button>
          </div>
        </form>
      )}

      <section
        aria-label="ค้นหาและกรองรีวิว"
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <label htmlFor="admin-review-search" className="sr-only">
              ค้นหาชื่อลูกค้า ข้อความ ทำเล หรือนายหน้า
            </label>
            <input
              id="admin-review-search"
              type="search"
              placeholder="ค้นหาชื่อลูกค้า ข้อความ ทำเล หรือนายหน้า"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={`${inputClass} bg-slate-50 pl-10`}
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => setReload((value) => value + 1)}
            aria-label="โหลดรายการรีวิวใหม่"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all' as const, label: 'ทั้งหมด' },
            { id: 'published' as const, label: 'เผยแพร่แล้ว' },
            { id: 'draft' as const, label: 'แบบร่าง' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
              className={`min-h-10 rounded-xl px-3 text-sm font-medium ${statusFilter === option.id ? 'bg-navy-950 text-white' : 'bg-slate-50 text-slate-600'}`}
            >
              {option.label}{' '}
              <span className="ml-1 text-xs">
                {loading
                  ? '—'
                  : reviews.filter(
                      (review) =>
                        option.id === 'all' ||
                        (option.id === 'published' ? review.published : !review.published),
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <p aria-live="polite" className="text-sm text-slate-500">
          {loading
            ? 'กำลังโหลดข้อมูล…'
            : `แสดง ${filteredReviews.length} จาก ${reviews.length} รีวิว`}
        </p>
      </section>
      {loading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-12 text-sm text-slate-500"
        >
          <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
          กำลังโหลดรีวิว…
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-semibold text-navy-950">
            {error
              ? 'ยังแสดงรีวิวไม่ได้'
              : reviews.length === 0
                ? 'ยังไม่มีรีวิวในระบบ'
                : 'ไม่พบรีวิวตามเงื่อนไข'}
          </h2>
          <p className="text-sm text-slate-500">
            {error
              ? 'ลองโหลดข้อมูลใหม่อีกครั้ง'
              : reviews.length === 0
                ? 'เพิ่มความคิดเห็นที่ได้รับจากลูกค้า แล้วเลือกเผยแพร่เมื่อข้อมูลพร้อม'
                : 'ลองค้นหาคำอื่นหรือเลือกดูทั้งหมด'}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredReviews.map((review) => (
            <article
              key={review.id}
              className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-sm font-semibold text-navy-950">
                  <Star className="h-4 w-4 fill-gold-400 text-gold-500" />
                  {review.rating} / 5
                </p>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${review.published ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                >
                  {review.published ? 'เผยแพร่แล้ว' : 'แบบร่าง'}
                </span>
              </div>
              <p className="whitespace-pre-line break-words rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-navy-950">
                “{review.comment}”
              </p>
              <div className="space-y-1 text-xs leading-relaxed text-slate-500">
                <p>
                  {serviceLabels[review.serviceType]}
                  {review.propertyTitleOrZone && ` · ${review.propertyTitleOrZone}`}
                </p>
                {review.agentName && <p>ผู้ดูแล: {review.agentName}</p>}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                  {review.avatarUrl ? (
                    <Image
                      src={review.avatarUrl}
                      alt={review.customerName}
                      fill
                      sizes="44px"
                      unoptimized
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  ) : (
                    <UserRound className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-navy-950">
                    {review.customerName}
                  </h3>
                  <p className="break-words text-xs text-slate-500">
                    {[review.customerRole, review.date].filter(Boolean).join(' · ')}
                  </p>
                  {review.verifiedBuyer && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                      <ShieldCheck className="h-3 w-3" />
                      ยืนยันการใช้บริการ
                    </span>
                  )}
                </div>
              </div>
              {deleteConfirmId === review.id ? (
                <div
                  role="group"
                  aria-label="ยืนยันการลบรีวิว"
                  className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3"
                >
                  <p className="text-sm text-red-700">
                    ลบรีวิวของ {review.customerName}? การลบไม่สามารถกู้คืนได้
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setDeleteConfirmId(null)}
                      className="min-h-11 rounded-xl bg-white px-3 text-sm text-slate-600 disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDelete(review.id)}
                      className="min-h-11 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? 'กำลังลบ…' : 'ยืนยันลบรีวิว'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => openEditor(review)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-navy-950 disabled:opacity-50"
                  >
                    <Edit3 className="h-4 w-4" />
                    แก้ไขรีวิว
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setDeleteConfirmId(review.id)}
                    aria-label={`ลบรีวิวของ ${review.customerName}`}
                    className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
