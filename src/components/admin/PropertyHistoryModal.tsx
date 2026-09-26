'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  X, 
  History, 
  DollarSign, 
  Tag, 
  UserCheck, 
  Globe, 
  Star, 
  Edit3, 
  PlusCircle, 
  Clock, 
  Calendar, 
  Check, 
  Copy, 
  TrendingDown, 
  TrendingUp, 
  Sparkles, 
  FileText, 
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Property, PropertyHistoryLog, PropertyHistoryChangeType } from '@/lib/types';
import { fetchPropertyHistory, recordPropertyHistory } from '@/lib/store/property-history-store';
import { formatPrice, formatThaiDate, formatPropertyCode } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth-helpers';

interface PropertyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  onRefreshProperty?: () => void;
}

export default function PropertyHistoryModal({
  isOpen,
  onClose,
  property,
  onRefreshProperty
}: PropertyHistoryModalProps) {
  const [logs, setLogs] = useState<PropertyHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'price' | 'status' | 'agent' | 'other'>('all');
  const [copied, setCopied] = useState(false);
  
  // New manual note state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [manualNoteText, setManualNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!property) return;
    setLoading(true);
    try {
      const historyData = await fetchPropertyHistory(property);
      setLogs(historyData);
    } catch (err) {
      console.error('Failed to load property history:', err);
    } finally {
      setLoading(false);
    }
  }, [property]);

  useEffect(() => {
    if (isOpen && property) {
      loadHistory();
      setIsAddingNote(false);
      setManualNoteText('');
      setFilterType('all');
    }
  }, [isOpen, property, loadHistory]);

  if (!isOpen || !property) return null;

  // Compute summary stats
  const priceLogs = logs.filter(l => l.change_type === 'price_change');
  const statusLogs = logs.filter(l => l.change_type === 'status_change');
  const agentLogs = logs.filter(l => l.change_type === 'agent_change');
  
  // Calculate price trend if available
  let initialPrice = property.price;
  const oldestPriceLog = [...priceLogs].reverse()[0];
  if (oldestPriceLog && typeof oldestPriceLog.previous_value === 'number') {
    initialPrice = oldestPriceLog.previous_value;
  }
  const netPriceDiff = property.price - initialPrice;

  // Days on system
  const createdDate = new Date(property.created_at || Date.now());
  const daysOnMarket = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Filtered logs
  const filteredLogs = logs.filter(l => {
    if (filterType === 'all') return true;
    if (filterType === 'price') return l.change_type === 'price_change';
    if (filterType === 'status') return l.change_type === 'status_change';
    if (filterType === 'agent') return l.change_type === 'agent_change';
    if (filterType === 'other') return !['price_change', 'status_change', 'agent_change'].includes(l.change_type);
    return true;
  });

  const handleSaveManualNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNoteText.trim() || !property) return;
    setSavingNote(true);
    try {
      const currentUser = getStoredUser();
      await recordPropertyHistory({
        property_id: property.id,
        property_title: property.title,
        change_type: 'manual_note',
        diff_summary: manualNoteText.trim(),
        actor_name: currentUser?.full_name || 'คุณฉันทากร (ผู้ดูแลระบบ)',
        actor_role: currentUser?.role || 'ADMIN',
        notes: 'บันทึกเพิ่มเติมจากแอดมิน',
      });
      setManualNoteText('');
      setIsAddingNote(false);
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 3000);
      await loadHistory();
    } catch (err) {
      console.error('Failed to save manual note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleCopySummary = () => {
    if (!property) return;
    const summaryLines = [
      `📋 ประวัติการแก้ไขทรัพย์: ${property.title} (${formatPropertyCode(property.id)})`,
      `💰 ราคาปัจจุบัน: ${formatPrice(property.price, property.status)}`,
      `🏷️ สถานะ: ${property.status === 'rent' ? 'เช่า' : 'ขาย'}`,
      `👤 นายหน้าผู้ดูแล: ${property.agent?.name || 'Chantakorn Property'}`,
      `📅 ลงประกาศเมื่อ: ${formatThaiDate(property.created_at)} (รวม ${daysOnMarket} วัน)`,
      `───────────────────────────────`,
      ...logs.map((l, i) => `${i + 1}. [${new Date(l.timestamp).toLocaleDateString('th-TH')}] ${l.diff_summary} (โดย: ${l.actor_name})`),
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summaryLines);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const getLogIcon = (type: PropertyHistoryChangeType) => {
    switch (type) {
      case 'price_change':
        return <DollarSign className="w-4 h-4 text-amber-500" />;
      case 'status_change':
        return <Tag className="w-4 h-4 text-emerald-500" />;
      case 'agent_change':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'published_change':
        return <Globe className="w-4 h-4 text-indigo-500" />;
      case 'featured_change':
        return <Star className="w-4 h-4 text-amber-400 fill-amber-400" />;
      case 'created':
        return <Sparkles className="w-4 h-4 text-gold-500" />;
      case 'manual_note':
        return <MessageSquare className="w-4 h-4 text-teal-500" />;
      default:
        return <Edit3 className="w-4 h-4 text-gray-500" />;
    }
  };

  const getBadgeStyle = (type: PropertyHistoryChangeType) => {
    switch (type) {
      case 'price_change':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'status_change':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'agent_change':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'published_change':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'featured_change':
        return 'bg-gold-50 text-navy-950 border-gold-300';
      case 'created':
        return 'bg-gold-100 text-gold-950 border-gold-300 font-bold';
      case 'manual_note':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getLogTypeLabel = (type: PropertyHistoryChangeType) => {
    switch (type) {
      case 'price_change': return 'ปรับราคา';
      case 'status_change': return 'เปลี่ยนสถานะ';
      case 'agent_change': return 'โอนย้ายนายหน้า';
      case 'published_change': return 'การเผยแพร่';
      case 'featured_change': return 'ทรัพย์เด่น';
      case 'created': return 'สร้างประกาศ';
      case 'manual_note': return 'บันทึกภายใน';
      default: return 'แก้ไขข้อมูล';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 to-blue-950 text-white flex items-start justify-between gap-3 border-b border-navy-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-navy-900 border border-gold-500/40 flex-shrink-0">
              <Image
                src={property.cover_image}
                alt={property.title}
                fill
                unoptimized
                referrerPolicy="no-referrer"
                className="object-cover"
              />
              <span className={`absolute top-0.5 left-0.5 px-1 py-0.2 rounded text-[8px] font-bold ${
                property.status === 'rent' ? 'bg-emerald-600 text-white' : 'bg-gold-500 text-navy-950'
              }`}>
                {property.status === 'rent' ? 'เช่า' : 'ขาย'}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold bg-gold-500/20 text-gold-300 px-1.5 py-0.2 rounded border border-gold-500/30">
                  {formatPropertyCode(property.id)}
                </span>
                <span className="text-[11px] text-gray-300 font-medium truncate">
                  {property.district}, {property.province}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5 leading-snug">
                {property.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gold-400 font-extrabold text-xs sm:text-sm">
                  {formatPrice(property.price, property.status)}
                </span>
                <span className="text-gray-400 text-[10px]">
                  • ผู้ดูแล: <strong className="text-gray-200">{property.agent?.name || 'Chantakorn'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadHistory}
              disabled={loading}
              title="รีเฟรชประวัติ"
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-white p-2 rounded-xl border border-gray-200">
            <div className="text-[10px] text-gray-500 font-medium">การแก้ไขทั้งหมด</div>
            <div className="text-sm font-extrabold text-navy-950 flex items-center justify-center gap-1 mt-0.5">
              <History className="w-3.5 h-3.5 text-gold-600" />
              <span>{logs.length} ครั้ง</span>
            </div>
          </div>

          <div className="bg-white p-2 rounded-xl border border-gray-200">
            <div className="text-[10px] text-gray-500 font-medium">ปรับราคา</div>
            <div className="text-sm font-extrabold text-navy-950 flex items-center justify-center gap-1 mt-0.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span>{priceLogs.length} ครั้ง</span>
            </div>
          </div>

          <div className="bg-white p-2 rounded-xl border border-gray-200">
            <div className="text-[10px] text-gray-500 font-medium">แนวโน้มราคา</div>
            <div className={`text-xs font-bold flex items-center justify-center gap-0.5 mt-0.5 ${
              netPriceDiff < 0 ? 'text-emerald-600' : netPriceDiff > 0 ? 'text-amber-600' : 'text-gray-600'
            }`}>
              {netPriceDiff < 0 ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>-฿{Math.abs(netPriceDiff).toLocaleString()}</span>
                </>
              ) : netPriceDiff > 0 ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+฿{netPriceDiff.toLocaleString()}</span>
                </>
              ) : (
                <span>ราคาคงที่</span>
              )}
            </div>
          </div>

          <div className="bg-white p-2 rounded-xl border border-gray-200">
            <div className="text-[10px] text-gray-500 font-medium">ระยะเวลาในระบบ</div>
            <div className="text-sm font-extrabold text-navy-950 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>{daysOnMarket} วัน</span>
            </div>
          </div>
        </div>

        {/* Filter and Action Header */}
        <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-navy-950 text-gold-400 shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ทั้งหมด ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('price')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'price'
                  ? 'bg-amber-500 text-navy-950 shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>ราคา ({priceLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('status')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'status'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>สถานะ ({statusLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('agent')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'agent'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>นายหน้า ({agentLogs.length})</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center gap-1 transition-all cursor-pointer"
              title="คัดลอกสรุปประวัติ"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกประวัติ'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-navy-950 bg-gold-400 hover:bg-gold-300 border border-gold-500 shadow-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ เพิ่มบันทึก</span>
            </button>
          </div>
        </div>

        {/* Add Note Form Drawer */}
        {isAddingNote && (
          <form onSubmit={handleSaveManualNote} className="p-3 bg-amber-50/70 border-b border-amber-200 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between text-xs font-bold text-navy-950">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-gold-600" />
                <span>เพิ่มบันทึกความคืบหน้า / กิจกรรมของทรัพย์นี้</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingNote(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <textarea
              rows={2}
              value={manualNoteText}
              onChange={(e) => setManualNoteText(e.target.value)}
              placeholder="ระบุบันทึก เช่น เจ้าของทรัพย์ยินยอมลดราคาพิเศษ 2 แสน, ลูกค้าคุณสมชายนัดดูบ้านวันเสาร์นี้..."
              className="w-full p-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500 font-medium"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNote(false)}
                className="px-3 py-1 bg-white text-gray-600 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingNote || !manualNoteText.trim()}
                className="px-3 py-1 bg-navy-950 text-gold-400 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 hover:bg-navy-900 disabled:opacity-50"
              >
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>บันทึกลงประวัติ</span>
              </button>
            </div>
          </form>
        )}

        {/* Success toast */}
        {noteSuccess && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-4 py-1.5 text-xs font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>บันทึกประวัติสำเร็จและซิงก์ข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว</span>
          </div>
        )}

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gold-500" />
              <p className="text-xs font-medium">กำลังโหลดประวัติการแก้ไขทรัพย์...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-xs font-semibold text-gray-500">ไม่พบประวัติในหมวดหมู่ที่เลือก</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {filteredLogs.map((log, index) => {
                const isLatest = index === 0;
                const logDate = new Date(log.timestamp);
                const timeString = isNaN(logDate.getTime()) 
                  ? log.timestamp 
                  : logDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
                const dateString = isNaN(logDate.getTime()) 
                  ? log.timestamp 
                  : formatThaiDate(log.timestamp);

                return (
                  <div key={log.id} className="relative group">
                    {/* Node Dot */}
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs ${
                      isLatest 
                        ? 'bg-gold-500 border-navy-950 text-navy-950' 
                        : 'bg-white border-gray-300 text-gray-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-navy-950' : 'bg-gray-400'}`} />
                    </div>

                    {/* Content Card */}
                    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-200 shadow-2xs hover:shadow-xs transition-shadow space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${getBadgeStyle(log.change_type)}`}>
                            {getLogIcon(log.change_type)}
                            <span>{getLogTypeLabel(log.change_type)}</span>
                          </span>

                          {isLatest && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                              ล่าสุด
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateString}</span>
                          <span>•</span>
                          <span>{timeString}</span>
                        </div>
                      </div>

                      {/* Diff summary */}
                      <div className="text-xs sm:text-sm font-bold text-navy-950 leading-relaxed">
                        {log.diff_summary}
                      </div>

                      {/* Optional Notes */}
                      {log.notes && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-xl border border-gray-100 italic">
                          &ldquo;{log.notes}&rdquo;
                        </div>
                      )}

                      {/* Actor footer */}
                      <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <span>บันทึกโดย:</span>
                          <strong className="text-navy-950 font-bold">{log.actor_name}</strong>
                          {log.actor_role && (
                            <span className="bg-gray-100 text-gray-600 px-1 py-0.2 rounded text-[9px]">
                              {log.actor_role}
                            </span>
                          )}
                        </span>
                        
                        <span className="font-mono text-[9px] text-gray-400">
                          ID: {log.id.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" />
            <span>ระบบบันทึก Audit Trail และ Price History อัตโนมัติทุกครั้งที่มีการแก้ไข</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
