'use client';

import { fetchStaffApi } from '@/lib/staff-api';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  Trash2, 
  Edit3, 
  Eye, 
  Star, 
  Copy, 
  CheckCircle2, 
  CopyPlus, 
  CheckSquare, 
  Square, 
  Check, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronRight,
  Loader2, 
  Tag, 
  History,
  Lock,
  FileText,
  Clock,
  UserCheck,
  Globe,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Save,
  ShieldCheck,
  AlertCircle,
  MessageCircle,
  ClipboardCopy,
  ClipboardCheck
} from 'lucide-react';
import { Property, PropertyStatus, PropertyHistoryLog, PropertyHistoryChangeType } from '@/lib/types';
import { fetchPropertyHistory } from '@/lib/store/property-history-store';
import { 
  formatPrice, 
  propertyHref, 
  formatThaiDate, 
  getPropertyTypeName,
  formatPropertyCode,
  formatPropertySnippet
} from '@/lib/utils';

interface CollapsiblePropertyRowProps {
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
  onCopySnippet?: (property: Property) => void;
  copiedSnippetId?: string | null;
  onOpenLandsMaps: (property: Property) => void;
  onOpenHistoryModal: (property: Property) => void;
  onDuplicate: (property: Property) => void;
  onDeleteConfirm: (id: string) => void;
  onUpdateNotes?: (id: string, notes: string) => Promise<void>;
  completionScore: number;
  busy: boolean;
}

export default function CollapsiblePropertyRow({
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
  onDuplicate,
  onDeleteConfirm,
  onUpdateNotes,
  completionScore,
  busy
}: CollapsiblePropertyRowProps) {
  // History logs for expanded view
  const [historyLogs, setHistoryLogs] = useState<PropertyHistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  // In-row Copy Snippet local state
  const [localCopiedSnippet, setLocalCopiedSnippet] = useState(false);

  const handleCopySnippet = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onCopySnippet) {
      onCopySnippet(property);
    } else {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const snippet = formatPropertySnippet(property, { origin });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(snippet);
      }
    }
    setLocalCopiedSnippet(true);
    setTimeout(() => setLocalCopiedSnippet(false), 2500);
  };

  const isSnippetCopied = copiedSnippetId === property.id || localCopiedSnippet;

  // In-row Agent Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(property.internal_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  const [notesError, setNotesError] = useState('');

  const [sendingLine, setSendingLine] = useState(false);
  const [lineSent, setLineSent] = useState(false);

  const handleSendToLine = async () => {
    setSendingLine(true);
    try {
      const res = await fetchStaffApi('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      });
      const data = await res.json();
      setLineSent(true);
      setTimeout(() => setLineSent(false), 3000);
      if (data.shareUrl && typeof window !== 'undefined') {
        window.open(data.shareUrl, '_blank');
      }
    } catch (err) {
      console.warn('Failed to send LINE notification:', err);
    } finally {
      setSendingLine(false);
    }
  };

  // Sync notes when property prop changes
  useEffect(() => {
    setNotesInput(property.internal_notes || '');
  }, [property.internal_notes]);

  // Lazy-load history logs when row is expanded
  useEffect(() => {
    let isMounted = true;
    if (isExpanded && !hasLoadedHistory) {
      setLoadingHistory(true);
      fetchPropertyHistory(property)
        .then((logs) => {
          if (isMounted) {
            setHistoryLogs(logs);
            setHasLoadedHistory(true);
          }
        })
        .catch((err) => {
          console.error('Failed to load history for property', property.id, err);
        })
        .finally(() => {
          if (isMounted) setLoadingHistory(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isExpanded, hasLoadedHistory, property]);

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Prevent expanding if clicking on buttons, links, inputs, or interactive controls
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-expand="true"]')) {
      return;
    }
    onToggleExpand(property.id);
  };

  const handleSaveNotes = async () => {
    if (!onUpdateNotes) return;
    setSavingNotes(true);
    setNotesError('');
    try {
      await onUpdateNotes(property.id, notesInput.trim());
      setIsEditingNotes(false);
      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 3000);
      // Refresh history to show recent note if available
      const updatedLogs = await fetchPropertyHistory(property);
      setHistoryLogs(updatedLogs);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingNotes(false);
    }
  };

  const getLogIcon = (type: PropertyHistoryChangeType) => {
    switch (type) {
      case 'price_change':
        return <DollarSign className="w-3.5 h-3.5 text-amber-500" />;
      case 'status_change':
        return <Tag className="w-3.5 h-3.5 text-emerald-500" />;
      case 'agent_change':
        return <UserCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'published_change':
        return <Globe className="w-3.5 h-3.5 text-indigo-500" />;
      case 'featured_change':
        return <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
      case 'created':
        return <Sparkles className="w-3.5 h-3.5 text-gold-500" />;
      case 'manual_note':
        return <FileText className="w-3.5 h-3.5 text-teal-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <React.Fragment>
      {/* Primary Table Row */}
      <tr 
        onClick={handleRowClick}
        className={`transition-all duration-300 ease-in-out cursor-pointer select-none ${
          isHighlighted
            ? 'animate-inline-success border-l-4 border-l-gold-500 shadow-sm'
            : isExpanded
              ? 'bg-amber-50/40 border-l-4 border-l-gold-500 hover:bg-amber-50/60'
              : isSelected 
                ? 'bg-gold-50/40 hover:bg-gold-50/70' 
                : 'hover:bg-gray-50/90'
        }`}
        title="คลิกแถวเพื่อขยายดูบันทึกนายหน้าและประวัติไทม์ไลน์"
      >
        {/* Expand Chevron & Checkbox */}
        <td className="p-3 text-center">
          <div className="flex items-center justify-center space-x-1.5" data-no-expand="true">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(property.id);
              }}
              className="p-1 text-gray-400 hover:text-gold-600 transition-transform rounded cursor-pointer"
              title={isExpanded ? 'ย่อรายละเอียด' : 'ขยายดูบันทึกและประวัติ'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gold-600 font-bold transition-transform duration-200" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 transition-transform duration-200" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(property.id);
              }}
              className="text-gray-400 hover:text-navy-950 cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-gold-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>

        {/* Thumbnail Image */}
        <td className="p-3.5">
          <div className="relative w-14 h-11 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
            <Image
              src={property.cover_image}
              alt={property.title}
              fill
              unoptimized
              referrerPolicy="no-referrer"
              className="object-cover"
            />
          </div>
        </td>

        {/* Property Title & Code & Completion */}
        <td className="p-3.5 max-w-xs">
          <div className="flex items-center gap-1.5">
            <Link
              href={propertyHref(property.slug)}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-navy-950 hover:text-gold-600 line-clamp-1 text-xs"
              title={property.title}
            >
              {property.title}
            </Link>
            {property.internal_notes && (
              <span 
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold text-amber-900 bg-amber-100/90 border border-amber-300"
                title={`มีบันทึกภายใน: ${property.internal_notes}`}
              >
                <Lock className="w-2.5 h-2.5 text-amber-700" />
                <span>โน้ต</span>
              </span>
            )}
          </div>

          {/* Visual Progress Bar for Listing Completion */}
          <div className="mt-1 flex items-center space-x-2 text-[10px] text-gray-500 font-medium">
            <span>ความสมบูรณ์:</span>
            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  completionScore >= 90 ? 'bg-emerald-500' : completionScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${completionScore}%` }}
              />
            </div>
            <span className="font-mono font-bold text-gray-700 tabular-nums">{completionScore}%</span>
          </div>

          <div className="flex items-center space-x-1.5 mt-1" data-no-expand="true">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopyCode(property.id);
              }}
              className="text-[10px] text-gray-600 font-mono font-medium hover:text-navy-950 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.2 rounded border border-gray-200 inline-flex items-center gap-1 cursor-pointer"
              title="คลิกเพื่อคัดลอกรหัสทรัพย์"
            >
              <span>รหัส: <strong className="font-bold">{formatPropertyCode(property.id)}</strong></span>
              {copiedCodeId === property.id && <Check className="w-2.5 h-2.5 text-emerald-600" />}
            </button>
            {property.facing_direction && (
              <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                ☯ {property.facing_direction}
              </span>
            )}
          </div>
        </td>

        {/* Property Type */}
        <td className="p-3.5 text-gray-700 font-medium whitespace-nowrap">
          {getPropertyTypeName(property.property_type)}
        </td>

        {/* Price Column (Primary Detail with Inline Edit) */}
        <td className="p-3.5 whitespace-nowrap" data-no-expand="true">
          {editingPriceId === property.id ? (
            <div 
              className="relative z-20 flex flex-col gap-1.5 p-2 bg-amber-50/95 border border-gold-400 rounded-xl shadow-lg min-w-[190px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-navy-950">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-gold-600" />
                  <span>แก้ไขราคา</span>
                </span>
                <span className="text-[9px] text-gray-500 font-normal">Enter: บันทึก</span>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-gray-500 font-bold text-xs">฿</span>
                <input
                  type="text"
                  autoFocus
                  value={inlinePriceInput}
                  onChange={(e) => setInlinePriceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveInlinePrice(property.id);
                    if (e.key === 'Escape') onCancelEditPrice();
                  }}
                  disabled={inlineUpdatingId === property.id}
                  className="w-full pl-6 pr-2 py-1 text-xs font-bold text-navy-950 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 shadow-inner"
                  placeholder="ระบุราคา..."
                />
              </div>

              {/* Quick adjustment pills */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                    setInlinePriceInput(String(Math.max(0, cur - 100000)));
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                >
                  -100k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                    setInlinePriceInput(String(cur + 100000));
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                >
                  +100k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                    setInlinePriceInput(String(cur + 500000));
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                >
                  +500k
                </button>
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-gold-200">
                <button
                  type="button"
                  onClick={() => onSaveInlinePrice(property.id)}
                  disabled={inlineUpdatingId === property.id}
                  className="flex-1 py-1 px-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {inlineUpdatingId === property.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3 text-gold-400" />
                  )}
                  <span>บันทึก</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelEditPrice}
                  disabled={inlineUpdatingId === property.id}
                  className="py-1 px-2 bg-white hover:bg-gray-100 text-gray-600 font-semibold text-[11px] rounded-lg border border-gray-200 flex items-center justify-center gap-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>ยกเลิก</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="group/price relative flex items-center gap-1.5">
              <span className="font-extrabold text-navy-950 text-xs tabular-nums">
                {formatPrice(property.price, property.status)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEditPrice(property);
                }}
                title="คลิกเพื่อแก้ไขราคาด่วน (Inline Edit)"
                className="opacity-0 group-hover/price:opacity-100 transition-opacity p-1 text-gray-400 hover:text-navy-950 hover:bg-gold-100 rounded-md border border-transparent hover:border-gold-300 cursor-pointer"
              >
                <Edit3 className="w-3 h-3 text-gold-600" />
              </button>
            </div>
          )}
        </td>

        {/* Location */}
        <td className="p-3.5 text-gray-600 whitespace-nowrap">
          {property.district}, {property.province}
        </td>

        {/* Status Column (Primary Detail with Quick-Action Chips) */}
        <td className="p-3.5 whitespace-nowrap" data-no-expand="true">
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={inlineUpdatingId === property.id}
              onClick={() => {
                if (property.status !== 'sale') onInlineUpdateStatus(property.id, 'sale');
              }}
              title="สลับสถานะเป็น 'ขาย'"
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                property.status === 'sale'
                  ? 'bg-gold-500 text-navy-950 border-gold-600 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <span>🏷️ ขาย</span>
            </button>
            <button
              type="button"
              disabled={inlineUpdatingId === property.id}
              onClick={() => {
                if (property.status !== 'rent') onInlineUpdateStatus(property.id, 'rent');
              }}
              title="สลับสถานะเป็น 'เช่า'"
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                property.status === 'rent'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <span>🔑 เช่า</span>
            </button>
          </div>
        </td>

        {/* Agent */}
        <td className="p-3.5">
          <div className="space-y-0.5 min-w-[120px]">
            <div className="font-bold text-navy-950 text-xs truncate max-w-[130px]" title={property.agent?.name}>
              {property.agent?.name || 'Chantakorn Property'}
            </div>
            <div className="flex items-center gap-1">
              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                property.agent?.rank === 'แอดมิน' ? 'bg-gold-100 text-gold-800 border border-gold-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}>
                {property.agent?.rank === 'แอดมิน' ? '🛡️ แอดมิน' : '👔 นายหน้า'}
              </span>
            </div>
          </div>
        </td>

        {/* Published Quick Chips */}
        <td className="p-3.5 whitespace-nowrap" data-no-expand="true">
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (property.published === false) onTogglePublished(property);
              }}
              title="สลับสถานะเป็น 'ออนไลน์'"
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                property.published !== false
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <span>🌐 ออนไลน์</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (property.published !== false) onTogglePublished(property);
              }}
              title="สลับสถานะเป็น 'แบบร่าง'"
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                property.published === false
                  ? 'bg-slate-700 text-white border-slate-800 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <span>📝 ร่าง</span>
            </button>
          </div>
        </td>

        {/* Featured Quick Chips */}
        <td className="p-3.5 whitespace-nowrap" data-no-expand="true">
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!property.featured) onToggleFeatured(property);
              }}
              title="ตั้งเป็น 'ทรัพย์เด่น'"
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                property.featured
                  ? 'bg-amber-500 text-navy-950 border-amber-600 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <Star className="w-3 h-3 fill-current text-navy-950" />
              <span>เด่น</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (property.featured) onToggleFeatured(property);
              }}
              title="ตั้งเป็น 'ทรัพย์ทั่วไป'"
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                !property.featured
                  ? 'bg-slate-400 text-white border-slate-500 shadow-xs scale-105'
                  : 'bg-gray-100/70 text-gray-400 border-gray-200/50 hover:bg-gray-200/70 hover:text-navy-950 hover:border-gray-300'
              }`}
            >
              <span>ทั่วไป</span>
            </button>
          </div>
        </td>

        {/* Created Date */}
        <td className="p-3.5 text-gray-500 text-[11px] whitespace-nowrap tabular-nums">
          {formatThaiDate(property.created_at)}
        </td>

        {/* Actions */}
        <td className="p-3.5 text-right whitespace-nowrap" data-no-expand="true">
          <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onCopyLink(property)}
              className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
              title="คัดลอกลิงก์ส่งต่อลูกค้า"
            >
              {copiedId === property.id ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleCopySnippet}
              className={`p-1.5 rounded-lg cursor-pointer transition-all border ${
                isSnippetCopied
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 shadow-xs'
                  : 'text-amber-700 hover:text-amber-950 hover:bg-amber-100/80 border-transparent hover:border-amber-200'
              }`}
              title="คัดลอกข้อมูลสรุปทรัพย์สำหรับโพสต์/ส่งลูกค้า (Copy Property Details)"
            >
              {isSnippetCopied ? (
                <ClipboardCheck className="w-4 h-4 text-emerald-600 animate-in zoom-in-50" />
              ) : (
                <ClipboardCopy className="w-4 h-4" />
              )}
            </button>
            
            <button
              type="button"
              onClick={() => onOpenLandsMaps(property)}
              className="p-1.5 text-navy-800 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer border border-transparent hover:border-emerald-300 transition-colors"
              title="ตรวจสอบระวาง & โฉนดกรมที่ดิน (DOL LandsMaps Overlay)"
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              type="button"
              onClick={() => onOpenHistoryModal(property)}
              className="p-1.5 text-navy-800 hover:text-gold-700 hover:bg-gold-50 rounded-lg cursor-pointer border border-transparent hover:border-gold-300 transition-colors"
              title="ดูประวัติการแก้ไขและปรับราคา (Property History)"
            >
              <History className="w-4 h-4 text-gold-600" />
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => onDuplicate(property)}
              className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
              title="คัดลอกเป็นทรัพย์ใหม่ (Clone)"
            >
              <CopyPlus className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={sendingLine}
              onClick={handleSendToLine}
              className="p-1.5 text-[#06C755] hover:text-[#05b34c] hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
              title="เด้งแจ้งเตือนเข้า LINE OA (https://lin.ee/NMSe28T3)"
            >
              {sendingLine ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#06C755]" />
              ) : lineSent ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <MessageCircle className="w-4 h-4 fill-current text-[#06C755]" />
              )}
            </button>

            <Link
              href={`/admin/automation?propertyId=${encodeURIComponent(property.id)}`}
              className="p-1.5 text-gold-600 hover:text-gold-700 hover:bg-gold-50 rounded-lg cursor-pointer"
              title="ระบบอัตโนมัติ AI (สร้างโพสต์/ร่างสัญญา/คำนวณ Yield)"
            >
              <Sparkles className="w-4 h-4 text-gold-600" />
            </Link>

            <Link
              href={propertyHref(property.slug)}
              target="_blank"
              className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
              title="ดูบนเว็บไซต์"
            >
              <Eye className="w-4 h-4" />
            </Link>

            <Link 
              href={`/admin/properties/new?id=${encodeURIComponent(property.id)}`} 
              title="แก้ไขรายการเต็มรูปแบบ" 
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </Link>

            <button
              type="button"
              disabled={busy}
              onClick={() => onDeleteConfirm(property.id)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
              title="ลบรายการนี้"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Collapsible Expanded Panel (Agent Notes & History Logs) */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-amber-50/40 via-slate-50/60 to-gray-50/80 border-b-2 border-gold-300/80 shadow-inner animate-in fade-in duration-300">
          <td colSpan={12} className="p-0">
            <div className="p-4 sm:p-6 space-y-4">
              
              {/* Header inside collapsible panel */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200/80 gap-2">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-navy-950 text-gold-400 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-navy-950 text-sm">
                        รายละเอียดเชิงลึก: {property.title}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {formatPropertyCode(property.id)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      ทำเล: {property.district}, {property.province} · ประเภท: {getPropertyTypeName(property.property_type)} · ราคา: {formatPrice(property.price, property.status)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
                      isSnippetCopied
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200'
                        : 'text-navy-950 bg-amber-50 hover:bg-amber-100 border-amber-300'
                    }`}
                    title="คัดลอกข้อมูลสรุปทรัพย์สำหรับโพสต์หรือส่งลูกค้าในคลิกเดียว (Copy Property Details)"
                  >
                    {isSnippetCopied ? (
                      <>
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">คัดลอกข้อมูลสรุปแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3.5 h-3.5 text-amber-700" />
                        <span>คัดลอกข้อมูลสรุปทรัพย์</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenHistoryModal(property)}
                    className="px-3 py-1.5 text-xs font-bold text-navy-950 bg-white hover:bg-gold-50 border border-gold-300 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-gold-600" />
                    <span>ประวัติฉบับเต็ม</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleExpand(property.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-navy-950 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>ซ่อนรายละเอียด</span>
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              </div>

              {/* 2-Column Responsive Layout: Agent Notes & History Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* COLUMN 1: Agent & Admin Internal Notes (5 cols) */}
                <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-amber-100 mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg">
                          <Lock className="w-4 h-4 text-amber-800" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-navy-950 flex items-center gap-1.5">
                            <span>บันทึกภายในสำหรับนายหน้า & แอดมิน</span>
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                              ซ่อนไม่แสดงหน้าเว็บ
                            </span>
                          </h4>
                          <p className="text-[10px] text-gray-500">
                            Agent Internal Notes (Confidential)
                          </p>
                        </div>
                      </div>

                      {!isEditingNotes && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingNotes(true);
                            setNotesInput(property.internal_notes || '');
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-gold-700 hover:text-gold-900 bg-gold-50 hover:bg-gold-100 border border-gold-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3 h-3 text-gold-600" />
                          <span>{property.internal_notes ? 'แก้ไขบันทึก' : '+ เพิ่มบันทึก'}</span>
                        </button>
                      )}
                    </div>

                    {/* Notification states */}
                    {notesSuccess && (
                      <div className="mb-3 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-in fade-in">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>บันทึกโน้ตภายในสำเร็จแล้ว</span>
                      </div>
                    )}

                    {notesError && (
                      <div className="mb-3 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{notesError}</span>
                      </div>
                    )}

                    {/* Content View / Edit Mode */}
                    {isEditingNotes ? (
                      <div className="space-y-2.5">
                        <textarea
                          rows={4}
                          value={notesInput}
                          onChange={(e) => setNotesInput(e.target.value)}
                          placeholder="ระบุข้อตกลงพิเศษ, เบอร์โทรลับเจ้าของทรัพย์, ค่าคอมมิชชันพิเศษ, ข้อมูลจำนอง หรือเงื่อนไขที่ต้องการแจ้งให้นายหน้าและทีมงานทราบ..."
                          className="w-full text-xs text-navy-950 p-3 bg-amber-50/50 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500 font-sans leading-relaxed"
                          autoFocus
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingNotes(false);
                              setNotesInput(property.internal_notes || '');
                            }}
                            disabled={savingNotes}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="px-3.5 py-1.5 text-xs font-bold text-navy-950 bg-gold-400 hover:bg-gold-500 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {savingNotes ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            <span>บันทึกโน้ต</span>
                          </button>
                        </div>
                      </div>
                    ) : property.internal_notes ? (
                      <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-navy-950 leading-relaxed font-sans whitespace-pre-line">
                        {property.internal_notes}
                      </div>
                    ) : (
                      <div className="p-5 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-xl">
                        <Lock className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                        <p className="text-xs text-gray-500 font-medium">ยังไม่มีบันทึกข้อมูลลับภายใน</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          คุณสามารถคลิกปุ่ม &quot;+ เพิ่มบันทึก&quot; ด้านบนเพื่อจดบันทึกเฉพาะทีมงานได้ทันที
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>เข้าถึงได้เฉพาะบัญชี Admin & Agent</span>
                    </span>
                    <span>อัปเดตล่าสุด: {formatThaiDate(property.updated_at || property.created_at)}</span>
                  </div>
                </div>

                {/* COLUMN 2: History Logs & Audit Timeline (7 cols) */}
                <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-blue-50 text-blue-800 rounded-lg">
                          <History className="w-4 h-4 text-blue-700" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-navy-950 flex items-center gap-1.5">
                            <span>ประวัติการปรับปรุง & ไทม์ไลน์</span>
                            {historyLogs.length > 0 && (
                              <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded-full tabular-nums">
                                {historyLogs.length} รายการ
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-gray-500">
                            Property History & Modification Audit Logs
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenHistoryModal(property)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>เปิดไทม์ไลน์ฉบับเต็ม</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Timeline List */}
                    {loadingHistory ? (
                      <div className="py-8 flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-gold-600" />
                        <span className="text-xs">กำลังโหลดประวัติของทรัพย์นี้...</span>
                      </div>
                    ) : historyLogs.length === 0 ? (
                      <div className="p-5 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
                        ยังไม่มีประวัติการปรับปรุงที่บันทึกไว้
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {historyLogs.slice(0, 4).map((log) => (
                          <div 
                            key={log.id} 
                            className="p-2.5 bg-gray-50/80 hover:bg-gray-100/80 rounded-xl border border-gray-100 text-xs flex items-start justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="p-1 rounded-lg bg-white border border-gray-200 shrink-0 mt-0.5">
                                {getLogIcon(log.change_type)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-navy-950 text-xs truncate">
                                  {log.diff_summary}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                                  <span>โดย: <strong className="text-gray-700">{log.actor_name}</strong></span>
                                  {log.actor_role && (
                                    <span className="text-[9px] px-1 py-0.2 bg-gray-200/80 text-gray-700 rounded font-semibold">
                                      {log.actor_role}
                                    </span>
                                  )}
                                  {log.notes && (
                                    <span className="text-gray-400 truncate max-w-[150px]">· {log.notes}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 tabular-nums">
                              {new Date(log.timestamp).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        ))}

                        {historyLogs.length > 4 && (
                          <div className="text-center pt-1">
                            <button
                              type="button"
                              onClick={() => onOpenHistoryModal(property)}
                              className="text-[11px] font-bold text-gold-700 hover:text-gold-900 cursor-pointer hover:underline"
                            >
                              + ดูประวัติย้อนหลังเพิ่มเติมอีก {historyLogs.length - 4} รายการ
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary footer strip */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>ลงประกาศเมื่อ: {formatThaiDate(property.created_at)}</span>
                    </span>
                    <span className="font-medium">
                      สถานะปัจจุบัน: <strong className="text-navy-950">{property.status === 'rent' ? '🔑 ให้เช่า' : '🏷️ เปิดขาย'}</strong>
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
