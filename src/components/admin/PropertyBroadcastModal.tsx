'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { CheckCircle2, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { fetchStaffApi } from '@/lib/staff-api';
import { OFFICIAL_LINE_BASIC_ID } from '@/lib/line-auth';
import { getPropertyTypeName } from '@/lib/utils';

type Preview = {
  previewRevision: string;
  property: {
    id: string;
    title: string;
    price: number;
    type: string;
    status: string;
    location: string;
    detailUrl: string;
    imageUrl?: string;
  };
};
type Attempt = { retryKey: string; previewRevision: string; startedAt: number; uncertain?: boolean };
const ATTEMPT_PREFIX = 'chantakorn_line_broadcast:';
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const memoryAttempts = new Map<string, Attempt>();

function storedAttempt(propertyId: string): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ATTEMPT_PREFIX + propertyId) || 'null');
    if (value && typeof value.retryKey === 'string' && typeof value.previewRevision === 'string' && typeof value.startedAt === 'number') {
      memoryAttempts.set(propertyId, value);
      return value;
    }
  } catch { /* Keep the in-memory attempt when browser storage is unavailable. */ }
  return memoryAttempts.get(propertyId) || null;
}

function saveAttempt(propertyId: string, attempt: Attempt | null) {
  if (attempt) memoryAttempts.set(propertyId, attempt);
  else memoryAttempts.delete(propertyId);
  try {
    if (attempt) sessionStorage.setItem(ATTEMPT_PREFIX + propertyId, JSON.stringify(attempt));
    else sessionStorage.removeItem(ATTEMPT_PREFIX + propertyId);
  } catch { /* Preserve the key across dialog remounts when browser storage is unavailable. */ }
}

export default function PropertyBroadcastModal({ isOpen, propertyId, onClose }: {
  isOpen: boolean;
  propertyId: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [needsNewAttempt, setNeedsNewAttempt] = useState(false);
  const attemptRef = useRef<Attempt | null>(null);
  const sendingRef = useRef(false);
  const acceptedRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setPreview(null);
    setLoading(true);
    setMessage('');
    setAccepted(false);
    setNeedsNewAttempt(false);
    acceptedRef.current = false;
    attemptRef.current = storedAttempt(propertyId);

    async function loadPreview() {
      try {
        const response = await fetchStaffApi(`/api/line/broadcast?propertyId=${encodeURIComponent(propertyId)}`, {
          cache: 'no-store', signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.property || !data.previewRevision) {
          throw new Error(data.message || 'ยังเตรียมทรัพย์สำหรับส่งไม่ได้ กรุณาลองใหม่');
        }
        if (active) setPreview({ property: data.property, previewRevision: data.previewRevision });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'เตรียมทรัพย์สำหรับส่งไม่ได้');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPreview();
    return () => { active = false; };
  }, [isOpen, propertyId]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sendingRef.current) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  async function send() {
    if (!preview || loading || sendingRef.current || acceptedRef.current || needsNewAttempt) return;
    const pending = attemptRef.current;
    const previousUncertain = pending?.uncertain === true;
    if (pending && (pending.previewRevision !== preview.previewRevision || Date.now() - pending.startedAt >= RETRY_WINDOW_MS)) {
      setNeedsNewAttempt(true);
      setMessage('มีคำขอครั้งก่อนที่ยังไม่ได้ยืนยันผล และข้อมูลหรือระยะเวลาการส่งเปลี่ยนไป กรุณาตรวจข้อความใน LINE ก่อนเริ่มส่งครั้งใหม่');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setMessage('');
    try {
      const attempt = pending || { retryKey: crypto.randomUUID(), previewRevision: preview.previewRevision, startedAt: Date.now() };
      // A refresh after dispatch may lose the response even if LINE already accepted it.
      attempt.uncertain = true;
      attemptRef.current = attempt;
      saveAttempt(propertyId, attempt);
      const response = await fetchStaffApi('/api/line/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, retryKey: attempt.retryKey, previewRevision: preview.previewRevision }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (response.ok && data.success && data.deliveryStatus === 'accepted') {
        acceptedRef.current = true;
        setAccepted(true);
        saveAttempt(propertyId, null);
        setMessage(data.message || 'LINE รับคำขอส่งทรัพย์ถึงผู้ติดตาม OA ทั้งหมดแล้ว กรุณาตรวจการได้รับข้อความใน LINE');
      } else {
        if (data.deliveryStatus === 'rejected' && !previousUncertain) {
          attemptRef.current = null;
          saveAttempt(propertyId, null);
        } else if (data.deliveryStatus !== 'rejected') {
          attempt.uncertain = true;
          saveAttempt(propertyId, attempt);
        }
        if (data.code === 'PROPERTY_CHANGED') setPreview(null);
        setMessage(data.message || 'ยังยืนยันการส่งไม่ได้ กรุณาลองอีกครั้ง');
      }
    } catch {
      if (attemptRef.current) {
        attemptRef.current.uncertain = true;
        saveAttempt(propertyId, attemptRef.current);
      }
      setMessage('ยังยืนยันการส่งไม่ได้ กรุณากดส่งอีกครั้งในหน้าต่างนี้ ระบบจะตรวจคำขอเดิมเพื่อป้องกันข้อความซ้ำ');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (!isOpen || !mounted) return null;
  const property = preview?.property;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center" onClick={() => { if (!sendingRef.current) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="property-broadcast-title" className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="bg-[#06C755] text-white p-5 flex justify-between items-start">
          <div>
            <h2 id="property-broadcast-title" className="font-extrabold text-lg">ส่งทรัพย์ให้ลูกค้าทาง LINE</h2>
            <p className="text-sm mt-1">ผู้รับ: ผู้ติดตาม OA {OFFICIAL_LINE_BASIC_ID} ทั้งหมด</p>
          </div>
          <button type="button" aria-label="ปิดหน้าต่างส่งทรัพย์" autoFocus disabled={sending} onClick={onClose} className="p-2 rounded-full hover:bg-white/20 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {loading && <p role="status" className="flex gap-2 items-center text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />กำลังเตรียมตัวอย่างทรัพย์...</p>}
          {property && <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {property.imageUrl && <div className="relative w-full h-48"><Image src={property.imageUrl} alt={property.title} fill unoptimized className="object-cover" /></div>}
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500">{getPropertyTypeName(property.type)} · {property.status === 'rent' ? 'ให้เช่า' : 'ขาย'}</p>
              <h3 className="font-bold text-navy-950">{property.title}</h3>
              <p className="font-bold text-lg text-emerald-700">{property.price > 0 ? `฿${new Intl.NumberFormat('th-TH').format(property.price)}${property.status === 'rent' ? ' / เดือน' : ''}` : 'ติดต่อสอบถามราคา'}</p>
              <p className="text-sm text-gray-600">{property.location}</p>
              <a href={property.detailUrl} target="_blank" rel="noopener noreferrer" className="block text-center rounded-xl py-2 border border-emerald-300 text-emerald-700 text-sm font-bold">ดูรายละเอียดทรัพย์</a>
            </div>
          </div>}
          <p className="text-xs text-gray-600">เมื่อกดส่ง ระบบจะขอให้ LINE ส่งการ์ดทรัพย์นี้ถึงผู้ติดตาม OA ทั้งหมด การส่งใช้โควตาข้อความของบัญชี LINE OA</p>
          {message && <p role={accepted ? 'status' : 'alert'} className={`text-sm rounded-xl p-3 ${accepted ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{message}</p>}
          {needsNewAttempt && <button type="button" className="text-sm font-bold text-amber-800 underline" onClick={() => {
            attemptRef.current = null;
            saveAttempt(propertyId, null);
            setNeedsNewAttempt(false);
            setMessage('พร้อมเริ่มคำขอใหม่ กรุณาตรวจตัวอย่างแล้วกดส่ง');
          }}>ตรวจข้อความเดิมแล้ว เริ่มการส่งครั้งใหม่</button>}
          <div className="flex gap-2">
            <button type="button" disabled={sending} onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-bold disabled:opacity-50">{accepted ? 'ปิด' : 'ยกเลิก'}</button>
            <button type="button" disabled={loading || sending || accepted || !preview || needsNewAttempt} onClick={send} className="flex-[2] py-3 rounded-xl bg-[#06C755] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : accepted ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {sending ? 'กำลังส่ง...' : accepted ? 'LINE รับคำขอแล้ว' : 'ส่งถึงผู้ติดตามทั้งหมด'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 flex gap-1 items-center"><MessageCircle className="w-3 h-3" />ผลสำเร็จหมายถึง LINE รับคำขอ กรุณาตรวจข้อความจาก LINE ของผู้ติดตามด้วย</p>
        </div>
      </section>
    </div>, document.body,
  );
}
