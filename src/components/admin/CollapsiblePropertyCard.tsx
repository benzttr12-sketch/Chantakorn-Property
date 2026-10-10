'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2,
  Trash2,
  Edit3,
  Eye,
  Copy,
  CopyPlus,
  Check,
  Sparkles,
  ChevronDown,
  Loader2,
  History,
  Lock,
  FileText,
  Star,
  MapPin,
  MessageCircle,
  ClipboardCopy,
  CalendarDays,
  UserRound,
  Tag,
} from 'lucide-react';
import { Property, PropertyStatus, PropertyHistoryLog } from '@/lib/types';
import { fetchPropertyHistory } from '@/lib/store/property-history-store';
import {
  formatPrice,
  propertyHref,
  formatThaiDate,
  formatPropertyCode,
  getPropertyTypeName,
} from '@/lib/utils';

interface CollapsiblePropertyCardProps {
  property: Property;
  isSelected: boolean;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onStartEditPrice: (property: Property) => void;
  onSaveInlinePrice: (id: string) => void;
  editingPriceId: string | null;
  inlinePriceInput: string;
  setInlinePriceInput: (value: string) => void;
  onCancelEditPrice: () => void;
  inlineUpdatingId: string | null;
  onInlineUpdateStatus: (id: string, newStatus: PropertyStatus) => void;
  onTogglePublished: (property: Property) => void;
  onToggleFeatured: (property: Property) => void;
  onCopyCode: (id: string) => void;
  copiedCodeId: string | null;
  onCopyLink: (property: Property) => void;
  copiedId: string | null;
  onCopySnippet: (property: Property) => void;
  copiedSnippetId?: string | null;
  onOpenLandsMaps: (property: Property) => void;
  onOpenHistoryModal: (property: Property) => void;
  onOpenLineModal?: (property: Property) => void;
  onDuplicate: (property: Property) => void;
  onDeleteConfirm: (id: string) => void;
  onUpdateNotes?: (id: string, notes: string) => Promise<void>;
  completionScore: number;
  busy: boolean;
}

const toolClass =
  'flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-navy-950 transition hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-50';

export default function CollapsiblePropertyCard({
  property,
  isSelected,
  isExpanded,
  isHighlighted,
  onToggleSelect,
  onToggleExpand,
  onStartEditPrice,
  onSaveInlinePrice,
  editingPriceId,
  inlinePriceInput,
  setInlinePriceInput,
  onCancelEditPrice,
  inlineUpdatingId,
  onInlineUpdateStatus,
  onTogglePublished,
  onToggleFeatured,
  onCopyCode,
  copiedCodeId,
  onCopyLink,
  copiedId,
  onCopySnippet,
  copiedSnippetId,
  onOpenLandsMaps,
  onOpenHistoryModal,
  onOpenLineModal,
  onDuplicate,
  onDeleteConfirm,
  onUpdateNotes,
  completionScore,
  busy,
}: CollapsiblePropertyCardProps) {
  const [historyLogs, setHistoryLogs] = useState<PropertyHistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyReload, setHistoryReload] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(property.internal_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  const [notesError, setNotesError] = useState('');
  const updating = busy || inlineUpdatingId !== null;
  const detailId = `property-tools-${property.id}`;

  useEffect(() => {
    if (!isEditingNotes) setNotesInput(property.internal_notes || '');
  }, [property.internal_notes, isEditingNotes]);

  useEffect(() => {
    if (!isExpanded) return;
    let active = true;
    setLoadingHistory(true);
    setHistoryError('');
    fetchPropertyHistory(property)
      .then((logs) => {
        if (active) setHistoryLogs(logs);
      })
      .catch(() => {
        if (active) setHistoryError('โหลดประวัติไม่สำเร็จ ลองเปิดประวัติฉบับเต็มหรือโหลดใหม่');
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [isExpanded, property, historyReload]);

  const handleSaveNotes = async () => {
    if (!onUpdateNotes || savingNotes) return;
    setSavingNotes(true);
    setNotesError('');
    setNotesSuccess(false);
    try {
      await onUpdateNotes(property.id, notesInput.trim());
      setIsEditingNotes(false);
      setNotesSuccess(true);
      setHistoryReload((value) => value + 1);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-3xl border bg-white shadow-sm transition ${isSelected ? 'border-gold-500 ring-2 ring-gold-400/20' : isHighlighted ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}
    >
      <div className="relative aspect-[16/9] bg-slate-100">
        {property.cover_image ? (
          <Image
            src={property.cover_image}
            alt={property.title}
            fill
            unoptimized
            referrerPolicy="no-referrer"
            className="object-cover"
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Building2 className="h-6 w-6" />
            ยังไม่มีรูปทรัพย์
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/95 px-3 text-sm font-semibold text-navy-950 shadow-sm">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={updating}
              onChange={() => onToggleSelect(property.id)}
              aria-label={`เลือกทรัพย์ ${formatPropertyCode(property.id)}`}
              className="h-4 w-4 accent-navy-950"
            />
            เลือก
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${property.published ? 'bg-white/95 text-navy-950' : 'bg-navy-950 text-white'}`}
            >
              {property.published ? 'เผยแพร่แล้ว' : 'แบบร่าง'}
            </span>
            {property.featured && (
              <span className="flex items-center gap-1 rounded-full bg-gold-400 px-3 py-1.5 text-xs font-semibold text-navy-950">
                <Star className="h-3.5 w-3.5 fill-current" />
                ทรัพย์เด่น
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            <span>
              {getPropertyTypeName(property.property_type)} ·{' '}
              {property.status === 'rent' ? 'ให้เช่า' : 'ขาย'}
            </span>
            <button
              type="button"
              onClick={() => onCopyCode(property.id)}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-50 px-2 font-mono text-navy-950"
              aria-label={`คัดลอกรหัส ${formatPropertyCode(property.id)}`}
            >
              {formatPropertyCode(property.id)}
              {copiedCodeId === property.id ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-slate-400" />
              )}
            </button>
          </div>
          <h2 className="text-lg font-bold leading-snug text-navy-950">
            <Link
              href={propertyHref(property.slug)}
              target="_blank"
              rel="noreferrer"
              className="break-words hover:text-gold-700"
            >
              {property.title}
            </Link>
          </h2>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">
              {[property.subdistrict, property.district, property.province]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
        </div>
        {editingPriceId === property.id ? (
          <div className="rounded-2xl border border-gold-200 bg-gold-50 p-3">
            <label
              htmlFor={`price-${property.id}`}
              className="mb-2 block text-sm font-semibold text-navy-950"
            >
              ราคา (บาท)
            </label>
            <input
              id={`price-${property.id}`}
              type="text"
              inputMode="decimal"
              autoFocus
              value={inlinePriceInput}
              onChange={(event) => setInlinePriceInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSaveInlinePrice(property.id);
                if (event.key === 'Escape' && inlineUpdatingId === null) onCancelEditPrice();
              }}
              disabled={inlineUpdatingId !== null}
              className="min-h-11 w-full rounded-xl border border-gold-300 bg-white px-3 text-base font-semibold text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { value: -100000, label: '−100,000' },
                { value: 100000, label: '+100,000' },
                { value: 500000, label: '+500,000' },
              ].map((adjustment) => (
                <button
                  key={adjustment.value}
                  type="button"
                  disabled={inlineUpdatingId !== null}
                  onClick={() => {
                    const current = Number(inlinePriceInput.replace(/,/g, '').trim());
                    if (Number.isFinite(current))
                      setInlinePriceInput(String(Math.max(0, current + adjustment.value)));
                  }}
                  className="min-h-9 rounded-lg border border-gold-200 bg-white px-2.5 text-xs font-medium text-navy-950 disabled:opacity-50"
                >
                  {adjustment.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onSaveInlinePrice(property.id)}
                disabled={inlineUpdatingId !== null}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy-950 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {inlineUpdatingId === property.id && <Loader2 className="h-4 w-4 animate-spin" />}
                บันทึกราคา
              </button>
              <button
                type="button"
                onClick={onCancelEditPrice}
                disabled={inlineUpdatingId !== null}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:opacity-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3">
            <p className="text-xl font-bold tracking-tight text-navy-950">
              {formatPrice(property.price, property.status)}
            </p>
            <button
              type="button"
              disabled={updating}
              onClick={() => onStartEditPrice(property)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-navy-950 shadow-sm disabled:opacity-50"
            >
              <Edit3 className="h-3.5 w-3.5" />
              แก้ราคา
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/admin/properties/new?id=${encodeURIComponent(property.id)}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy-950 px-2 text-sm font-semibold text-white hover:bg-navy-900"
          >
            <Edit3 className="h-4 w-4 shrink-0" />
            แก้ไขทรัพย์
          </Link>
          <button
            type="button"
            disabled={updating || !property.published || !onOpenLineModal}
            onClick={() => onOpenLineModal?.(property)}
            title={
              property.published
                ? 'ตรวจข้อมูลก่อนส่งถึงผู้ติดตาม OA ทั้งหมด'
                : 'เผยแพร่ทรัพย์ก่อนส่ง LINE'
            }
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            ส่ง LINE
          </button>
        </div>
        <button
          type="button"
          onClick={() => onToggleExpand(property.id)}
          aria-expanded={isExpanded}
          aria-controls={detailId}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            เครื่องมือ บันทึก และประวัติ
            {property.internal_notes && (
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-label="มีบันทึกภายใน" />
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {isExpanded && (
          <div id={detailId} className="space-y-5 border-t border-slate-100 pt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-navy-950">สถานะประกาศ</h3>
              <label
                htmlFor={`status-${property.id}`}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600"
              >
                ประเภทการขาย
                <select
                  id={`status-${property.id}`}
                  value={property.status}
                  disabled={updating}
                  onChange={(event) =>
                    onInlineUpdateStatus(property.id, event.target.value as PropertyStatus)
                  }
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-950 disabled:opacity-50"
                >
                  <option value="sale">ขาย</option>
                  <option value="rent">ให้เช่า</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onTogglePublished(property)}
                  className={toolClass}
                >
                  <Tag className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{property.published ? 'เปลี่ยนเป็นแบบร่าง' : 'เผยแพร่ทรัพย์'}</span>
                </button>
                <button
                  type="button"
                  disabled={updating}
                  aria-pressed={property.featured}
                  onClick={() => onToggleFeatured(property)}
                  className={toolClass}
                >
                  <Star
                    className={`h-4 w-4 shrink-0 ${property.featured ? 'fill-gold-400 text-gold-600' : 'text-slate-400'}`}
                  />
                  <span>{property.featured ? 'ยกเลิกทรัพย์เด่น' : 'ตั้งเป็นทรัพย์เด่น'}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onCopyLink(property)} className={toolClass}>
                {copiedId === property.id ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span>{copiedId === property.id ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์'}</span>
              </button>
              <button type="button" onClick={() => onCopySnippet(property)} className={toolClass}>
                {copiedSnippetId === property.id ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <ClipboardCopy className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span>
                  {copiedSnippetId === property.id ? 'คัดลอกข้อมูลแล้ว' : 'คัดลอกข้อมูลโพสต์'}
                </span>
              </button>
              <button type="button" onClick={() => onOpenLandsMaps(property)} className={toolClass}>
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                <span>แผนที่ / โฉนด</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHistoryModal(property)}
                className={toolClass}
              >
                <History className="h-4 w-4 shrink-0 text-slate-400" />
                <span>ประวัติฉบับเต็ม</span>
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => onDuplicate(property)}
                className={toolClass}
              >
                <CopyPlus className="h-4 w-4 shrink-0 text-slate-400" />
                <span>คัดลอกเป็นแบบร่าง</span>
              </button>
              <Link
                href={`/admin/automation?propertyId=${encodeURIComponent(property.id)}`}
                className={toolClass}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-gold-600" />
                <span>เครื่องมือ AI</span>
              </Link>
              <Link
                href={propertyHref(property.slug)}
                target="_blank"
                rel="noreferrer"
                className={toolClass}
              >
                <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                <span>ดูหน้าเว็บ</span>
              </Link>
              <button
                type="button"
                disabled={updating}
                onClick={() => onDeleteConfirm(property.id)}
                className={`${toolClass} !border-red-100 !text-red-600 hover:!bg-red-50`}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>ลบทรัพย์</span>
              </button>
            </div>
            <dl className="space-y-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
              <div className="flex items-start justify-between gap-2">
                <dt className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  ผู้ดูแล
                </dt>
                <dd className="break-words text-right font-medium text-navy-950">
                  {property.agent?.name || 'ยังไม่ได้ระบุ'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  วันที่ลง
                </dt>
                <dd>{formatThaiDate(property.created_at)}</dd>
              </div>
              {property.facing_direction && (
                <div className="flex justify-between gap-2">
                  <dt>ทิศทาง</dt>
                  <dd>{property.facing_direction}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt>ความครบถ้วนของข้อมูล</dt>
                <dd className="font-semibold text-navy-950">{completionScore}%</dd>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gold-400"
                  style={{ width: `${completionScore}%` }}
                />
              </div>
            </dl>
            <section className="rounded-2xl border border-gold-200 bg-gold-50/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy-950">
                  <Lock className="h-4 w-4 text-gold-700" />
                  บันทึกภายในทีม
                </h3>
                {!isEditingNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNotes(true);
                      setNotesSuccess(false);
                      setNotesError('');
                    }}
                    className="min-h-10 rounded-lg bg-white px-3 text-xs font-semibold text-navy-950"
                  >
                    {property.internal_notes ? 'แก้ไขบันทึก' : 'เพิ่มบันทึก'}
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-slate-500">แสดงเฉพาะทีมงานในหลังบ้าน</p>
              {notesSuccess && (
                <p role="status" className="mb-2 text-sm text-emerald-700">
                  บันทึกเรียบร้อยแล้ว
                </p>
              )}
              {notesError && (
                <p role="alert" className="mb-2 text-sm text-red-600">
                  {notesError}
                </p>
              )}
              {isEditingNotes ? (
                <div className="space-y-2">
                  <label htmlFor={`notes-${property.id}`} className="sr-only">
                    บันทึกภายในทีม
                  </label>
                  <textarea
                    id={`notes-${property.id}`}
                    rows={4}
                    autoFocus
                    value={notesInput}
                    onChange={(event) => setNotesInput(event.target.value)}
                    disabled={savingNotes}
                    placeholder="ข้อตกลงเจ้าของทรัพย์หรือข้อมูลที่ทีมต้องทราบ"
                    className="w-full rounded-xl border border-gold-200 bg-white p-3 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy-950 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingNotes && <Loader2 className="h-4 w-4 animate-spin" />}บันทึก
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotesError('');
                      }}
                      disabled={savingNotes}
                      className="min-h-11 rounded-xl bg-white px-3 text-sm text-slate-600"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-navy-950">
                  {property.internal_notes || 'ยังไม่มีบันทึกภายใน'}
                </p>
              )}
            </section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-950">
                <History className="h-4 w-4 text-slate-400" />
                ประวัติล่าสุด
              </h3>
              {loadingHistory ? (
                <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลดประวัติ…
                </p>
              ) : historyError ? (
                <div role="alert" className="text-sm text-red-600">
                  {historyError}
                  <button
                    type="button"
                    onClick={() => setHistoryReload((value) => value + 1)}
                    className="ml-2 min-h-10 font-semibold underline"
                  >
                    โหลดใหม่
                  </button>
                </div>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีประวัติการปรับปรุง</p>
              ) : (
                <ol className="space-y-3 border-l border-slate-200 pl-3">
                  {historyLogs.slice(0, 3).map((log) => (
                    <li key={log.id}>
                      <p className="break-words text-sm text-navy-950">{log.diff_summary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actor_name} · {formatThaiDate(log.timestamp)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </article>
  );
}
