'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchStaffApi } from '@/lib/staff-api';
import { 
  Building2, 
  Trash2, 
  Edit3, 
  Eye, 
  Copy, 
  CheckCircle2, 
  CopyPlus, 
  CheckSquare, 
  Square, 
  Check, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  Loader2, 
  History,
  Lock,
  FileText,
  Clock,
  DollarSign,
  Tag,
  UserCheck,
  Globe,
  Star,
  MapPin,
  Save,
  ShieldCheck,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  ClipboardCopy,
  ClipboardCheck
} from 'lucide-react';
import { Property, PropertyStatus, PropertyHistoryLog, PropertyHistoryChangeType } from '@/lib/types';
import { fetchPropertyHistory } from '@/lib/store/property-history-store';
import { 
  formatPrice, 
  propertyHref, 
  formatThaiDate, 
  formatPropertyCode,
  formatPropertySnippet
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
  onDuplicate,
  onDeleteConfirm,
  onUpdateNotes,
  completionScore,
  busy
}: CollapsiblePropertyCardProps) {
  const [historyLogs, setHistoryLogs] = useState<PropertyHistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  // In-card Copy Snippet local state
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

  useEffect(() => {
    setNotesInput(property.internal_notes || '');
  }, [property.internal_notes]);

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
          console.error('Failed to load history for mobile property', property.id, err);
        })
        .finally(() => {
          if (isMounted) setLoadingHistory(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isExpanded, hasLoadedHistory, property]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
      case 'price_change': return <DollarSign className="w-3 h-3 text-amber-500" />;
      case 'status_change': return <Tag className="w-3 h-3 text-emerald-500" />;
      case 'agent_change': return <UserCheck className="w-3 h-3 text-blue-500" />;
      case 'published_change': return <Globe className="w-3 h-3 text-indigo-500" />;
      case 'featured_change': return <Star className="w-3 h-3 text-amber-400 fill-amber-400" />;
      case 'created': return <Sparkles className="w-3 h-3 text-gold-500" />;
      case 'manual_note': return <FileText className="w-3 h-3 text-teal-500" />;
      default: return <Clock className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`rounded-2xl border space-y-3 transition-all duration-300 ease-in-out cursor-pointer ${
        isHighlighted 
          ? 'animate-inline-success-mobile z-10 relative p-4' 
          : isExpanded
            ? 'border-gold-400 bg-amber-50/30 ring-1 ring-gold-400/50 shadow-md p-4'
            : isSelected 
              ? 'border-gold-500 bg-gold-50/20 shadow-xs p-4' 
              : 'bg-white border-gray-200 shadow-xs hover:border-gray-300 p-4'
      }`}
    >
      {/* Primary Details Row on Mobile */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(property.id);
          }}
          className="mt-1 text-gray-400 hover:text-navy-950 cursor-pointer"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-gold-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-300" />
          )}
        </button>

        {/* Thumbnail with Status Tag */}
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
          <Image
            src={property.cover_image}
            alt={property.title}
            fill
            unoptimized
            referrerPolicy="no-referrer"
            className="object-cover"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInlineUpdateStatus(property.id, property.status === 'rent' ? 'sale' : 'rent');
            }}
            disabled={inlineUpdatingId === property.id}
            className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold shadow-xs flex items-center gap-0.5 cursor-pointer border transition-all active:scale-95 ${
              property.status === 'rent' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-gold-500 text-navy-950 border-gold-600'
            }`}
            title="แตะสลับสถานะ ขาย/เช่า ทันที"
          >
            {inlineUpdatingId === property.id ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <span>{property.status === 'rent' ? '🔑 เช่า' : '🏷️ ขาย'}</span>
            )}
          </button>
        </div>

        {/* Title, Completion Bar, Price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <Link
                href={propertyHref(property.slug)}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-navy-950 hover:text-gold-600 line-clamp-2 text-xs leading-snug"
              >
                {property.title}
              </Link>
              {/* Visual Progress Bar */}
              <div className="mt-1 flex items-center space-x-1.5 text-[9px] text-gray-500 font-medium">
                <span>ความสมบูรณ์:</span>
                <div className="w-12 bg-gray-100 rounded-full h-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      completionScore >= 90 ? 'bg-emerald-500' : completionScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${completionScore}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-gray-700 tabular-nums">{completionScore}%</span>
              </div>
            </div>

            {/* Quick Expand Toggle Chevron on top right */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(property.id);
              }}
              className="p-1 text-gray-400 hover:text-gold-600 transition-colors"
              title={isExpanded ? 'ย่อรายละเอียด' : 'ขยายดูบันทึกและประวัติ'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gold-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>

          {/* Price inline on Mobile */}
          {editingPriceId === property.id ? (
            <div className="mt-1.5 p-2 bg-amber-50 rounded-lg border border-gold-300" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                autoFocus
                value={inlinePriceInput}
                onChange={(e) => setInlinePriceInput(e.target.value)}
                className="w-full text-xs font-bold p-1 bg-white border border-gray-300 rounded"
              />
              <div className="flex gap-1 mt-1 justify-end">
                <button 
                  type="button" 
                  onClick={onCancelEditPrice} 
                  className="px-2 py-0.5 text-[10px] text-gray-600 bg-white border rounded"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  onClick={() => onSaveInlinePrice(property.id)} 
                  className="px-2 py-0.5 text-[10px] font-bold text-navy-950 bg-gold-400 rounded"
                >
                  บันทึก
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="text-sm font-black text-navy-950 tabular-nums">
                {formatPrice(property.price, property.status)}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEditPrice(property);
                }}
                className="p-1 text-gray-400 hover:text-navy-950 hover:bg-gold-50 rounded"
                title="แก้ไขราคาด่วน"
              >
                <Edit3 className="w-3 h-3 text-gold-600" />
              </button>
            </div>
          )}

          {/* Location & Code */}
          <div className="text-[11px] text-gray-500 flex items-center justify-between mt-0.5">
            <span className="flex items-center truncate">
              <MapPin className="w-3 h-3 mr-1 text-gray-400 shrink-0" />
              <span className="truncate">{property.district}</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopyCode(property.id);
              }}
              className="font-mono text-gray-600 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1"
            >
              <span>{formatPropertyCode(property.id)}</span>
              {copiedCodeId === property.id && <Check className="w-2.5 h-2.5 text-emerald-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* Accordion Trigger Strip on Mobile */}
      <div 
        onClick={() => onToggleExpand(property.id)}
        className="px-3 py-1.5 bg-gray-50 hover:bg-amber-50/60 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gold-600" />
          <span>บันทึกนายหน้า & ประวัติไทม์ไลน์</span>
          {property.internal_notes && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="มีบันทึกข้อความ" />
          )}
        </span>
        <span className="text-[10px] text-gold-700 font-bold flex items-center gap-0.5">
          {isExpanded ? 'ซ่อน' : 'เปิดดู'}
          {isExpanded ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </div>

      {/* Expanded Collapsible Section for Mobile */}
      {isExpanded && (
        <div className="pt-2 border-t border-gold-200 space-y-3 animate-in fade-in duration-200">
          
          {/* Quick Copy Snippet Banner in Mobile Expanded */}
          <div className="flex items-center justify-between bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold text-navy-950 flex items-center gap-1.5">
              <ClipboardCopy className="w-3.5 h-3.5 text-amber-700" />
              <span>สรุปข้อมูลทรัพย์ High-Converting</span>
            </span>
            <button
              type="button"
              onClick={handleCopySnippet}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 cursor-pointer transition-all ${
                isSnippetCopied
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-navy-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {isSnippetCopied ? (
                <>
                  <ClipboardCheck className="w-3 h-3 text-white" />
                  <span>คัดลอกแล้ว!</span>
                </>
              ) : (
                <span>คัดลอกข้อมูลสรุป</span>
              )}
            </button>
          </div>

          {/* Agent Notes */}
          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-navy-950 flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-amber-700" />
                <span>บันทึกภายในสำหรับนายหน้า (ซ่อน)</span>
              </span>
              {!isEditingNotes && (
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(true)}
                  className="text-[10px] font-bold text-gold-700 hover:underline"
                >
                  {property.internal_notes ? 'แก้ไข' : '+ เพิ่ม'}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-1.5 mt-2">
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="เพิ่มบันทึกสำหรับทีมงาน เช่น เบอร์โทรลับเจ้าของทรัพย์ หรือค่าคอมมิชชัน..."
                  className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg focus:outline-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    className="px-2 py-1 text-[10px] text-gray-600 bg-white border rounded"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-2.5 py-1 text-[10px] font-bold text-navy-950 bg-gold-400 rounded flex items-center gap-1"
                  >
                    {savingNotes && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    <span>บันทึก</span>
                  </button>
                </div>
              </div>
            ) : property.internal_notes ? (
              <p className="text-navy-950 whitespace-pre-line text-[11px] leading-relaxed">
                {property.internal_notes}
              </p>
            ) : (
              <p className="text-gray-400 text-[10px] italic">ไม่มีบันทึกข้อมูลลับภายใน</p>
            )}
          </div>

          {/* History Timeline Logs */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-navy-950 flex items-center gap-1 text-[11px]">
                <History className="w-3 h-3 text-blue-600" />
                <span>ประวัติไทม์ไลน์ล่าสุด</span>
              </span>
              <button
                type="button"
                onClick={() => onOpenHistoryModal(property)}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                ดูฉบับเต็ม
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-3 text-center text-gray-400 flex items-center justify-center gap-1 text-[11px]">
                <Loader2 className="w-3 h-3 animate-spin text-gold-600" />
                <span>กำลังโหลดประวัติ...</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="text-gray-400 text-[10px]">ยังไม่มีประวัติการปรับปรุง</p>
            ) : (
              <div className="space-y-1.5">
                {historyLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="text-[10px] bg-white p-1.5 rounded border border-gray-100 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">{getLogIcon(log.change_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy-950 truncate">{log.diff_summary}</p>
                      <p className="text-gray-400 text-[9px]">{new Date(log.timestamp).toLocaleDateString('th-TH')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Bottom Action Strip on Mobile */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5" data-no-expand="true">
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePublished(property);
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 ${
            property.published !== false
              ? 'bg-blue-50 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          <span>{property.published !== false ? '🌐 ออนไลน์' : '📝 แบบร่าง'}</span>
        </button>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink(property);
            }}
            className="p-1.5 text-navy-700 hover:bg-gray-100 rounded-lg text-[11px] border border-gray-200"
            title="คัดลอกลิงก์ส่งต่อลูกค้า"
          >
            {copiedId === property.id ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>

          <button
            type="button"
            onClick={handleCopySnippet}
            className={`p-1.5 rounded-lg text-[11px] border transition-all ${
              isSnippetCopied
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 shadow-xs'
                : 'text-amber-700 hover:text-amber-950 hover:bg-amber-100/80 border-amber-200'
            }`}
            title="คัดลอกข้อมูลสรุปทรัพย์สำหรับโพสต์/ส่งลูกค้า (Copy Property Details)"
          >
            {isSnippetCopied ? (
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
            ) : (
              <ClipboardCopy className="w-3.5 h-3.5 text-amber-700" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLandsMaps(property);
            }}
            className="p-1.5 text-navy-800 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg border border-emerald-200"
            title="ตรวจสอบระวาง & โฉนดกรมที่ดิน (DOL LandsMaps Overlay)"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistoryModal(property);
            }}
            className="p-1.5 text-navy-800 hover:bg-gold-50 hover:text-gold-700 rounded-lg border border-gold-200"
            title="ดูประวัติการแก้ไขและปรับราคา (Property History)"
          >
            <History className="w-3.5 h-3.5 text-gold-600" />
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(property);
            }}
            className="p-1.5 text-navy-700 hover:bg-navy-50 rounded-lg border border-gray-200"
            title="คัดลอกเป็นทรัพย์ใหม่ (Clone)"
          >
            <CopyPlus className="w-3.5 h-3.5 text-navy-800" />
          </button>

          <button
            type="button"
            disabled={sendingLine}
            onClick={(e) => {
              e.stopPropagation();
              handleSendToLine();
            }}
            className="p-1.5 text-[#06C755] hover:bg-emerald-50 rounded-lg border border-emerald-200"
            title="เด้งแจ้งเตือนเข้า LINE OA (https://lin.ee/NMSe28T3)"
          >
            {sendingLine ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#06C755]" />
            ) : lineSent ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5 fill-current text-[#06C755]" />
            )}
          </button>

          <Link
            href={`/admin/automation?propertyId=${encodeURIComponent(property.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-gold-600 hover:text-gold-700 hover:bg-gold-50 rounded-lg border border-gold-200"
            title="ระบบอัตโนมัติ AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Link>

          <Link
            href={propertyHref(property.slug)}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-gray-600 hover:text-navy-950 hover:bg-gray-100 rounded-lg border border-gray-200"
            title="ดูหน้าเว็บ"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>

          <Link
            href={`/admin/properties/new?id=${encodeURIComponent(property.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
            title="แก้ไข"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConfirm(property.id);
            }}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"
            title="ลบ"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
