'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageCircle, 
  Check, 
  Copy, 
  ExternalLink, 
  X, 
  Send,
  ShieldCheck,
  Building2,
  Share2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  PropertyLineData, 
  generatePropertyLineMessage, 
  getLineShareUrl, 
  getLineOaChatUrl,
  OFFICIAL_LINE_OA_URL 
} from '@/lib/line-inquiry';
import { OFFICIAL_LINE_BASIC_ID } from '@/lib/line-auth';
import { fetchStaffApi } from '@/lib/staff-api';

interface SendToLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyLineData | null;
  autoSend?: boolean;
}

export default function SendToLineModal({ isOpen, onClose, property, autoSend = false }: SendToLineModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [origin, setOrigin] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const [lineChat, setLineChat] = useState<{ url: string; mode: 'app' | 'web' }>({ url: OFFICIAL_LINE_OA_URL, mode: 'web' });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const message = property ? generatePropertyLineMessage(property, origin) : '';
  const lineShareUrl = getLineShareUrl(message);
  // เลือกลิงก์ตามอุปกรณ์: มือถือเปิดแอป LINE พร้อมข้อความ / คอมเปิดหน้าโปรไฟล์ OA
  useEffect(() => {
    setLineChat(property ? getLineOaChatUrl(message) : { url: OFFICIAL_LINE_OA_URL, mode: 'web' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, origin]);

  const handleCopyText = async () => {
    if (!message) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleCopyLineId = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(OFFICIAL_LINE_BASIC_ID);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 3000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleDirectPushNotify = React.useCallback(async () => {
    if (!property) return;
    setPushing(true);
    setPushSuccess(false);
    setPushMessage('');

    try {
      const res = await fetchStaffApi('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualSend: true,
          title: property.title,
          price: property.price,
          status: property.status || 'sale',
          district: property.district || 'หาดใหญ่',
          subdistrict: property.subdistrict || 'ควนลัง',
          province: property.province || 'สงขลา',
          slug: property.slug,
          id: property.id,
          cover_image: property.cover_image || (property.images && property.images[0]) || undefined,
          images: property.images || undefined,
          property_type: property.property_type,
          video_url: property.video_url,
          agent: property.agent || undefined,
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.isRealSent) {
        setPushSuccess(true);
        setPushMessage('LINE รับคำขอส่งการ์ดถึงเจ้าหน้าที่ที่ตั้งค่าไว้แล้ว กรุณาตรวจการได้รับข้อความใน LINE');
      } else {
        setPushMessage(data.error || data.message || 'ยังไม่ได้ส่งแจ้งเตือน กรุณาลองใหม่หรือเปิดแชท LINE OA');
      }
    } catch (err) {
      setPushMessage(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณากดปุ่มเปิดแชท LINE OA โดยตรง');
    } finally {
      setPushing(false);
    }
  }, [property]);

  useEffect(() => {
    if (isOpen && autoSend && property && !pushSuccess) {
      handleDirectPushNotify();
    }
  }, [isOpen, autoSend, property, pushSuccess, handleDirectPushNotify]);

  if (!isOpen || !property || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden space-y-4 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-[#06C755] to-emerald-500 p-5 text-white flex items-start justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <MessageCircle className="w-6 h-6 text-white fill-current" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                ติดต่อส่งข้อมูลทรัพย์ทาง LINE
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Chantakorn Property Official Account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Official Account Identification Bar */}
          <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#06C755] animate-pulse" />
              <span className="text-emerald-950 font-bold">LINE ID:</span>
              <span className="font-mono text-emerald-900 font-extrabold text-sm">{OFFICIAL_LINE_BASIC_ID}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLineId}
              className="text-[#06C755] hover:text-emerald-800 font-bold flex items-center space-x-1 cursor-pointer"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">คัดลอกไอดีแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกไอดี</span>
                </>
              )}
            </button>
          </div>

          {/* Action 1 (Primary): Open LINE OA chat — platform-aware URL */}
          <div className="space-y-2.5 pt-1">
            <a
              href={lineChat.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                handleCopyText();
              }}
              className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 via-[#06C755] to-emerald-500 hover:from-emerald-500 hover:to-[#05b34c] active:scale-[0.99] text-white rounded-2xl font-black text-sm sm:text-base shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer group"
            >
              <MessageCircle className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
              <span>
                {lineChat.mode === 'app'
                  ? 'เปิด LINE พร้อมข้อความ แล้วกดส่งในแชท'
                  : `เปิดหน้า LINE OA (${OFFICIAL_LINE_BASIC_ID})`}
              </span>
              <ExternalLink className="w-4 h-4 ml-1 opacity-90" />
            </a>

            {lineChat.mode === 'web' && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-[11px] text-sky-900 space-y-1">
                <span className="font-bold flex items-center space-x-1 text-sky-800">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>วิธีส่งข้อความจากคอมพิวเตอร์:</span>
                </span>
                <p className="leading-relaxed">
                  1. ข้อความสอบถามถูกคัดลอกไว้แล้วอัตโนมัติ · 2. กดปุ่มด้านบนเพื่อเปิดหน้า LINE OA
                  แล้วกด <strong>&ldquo;เพิ่มเพื่อน&rdquo;</strong> (หรือสแกน QR ด้วยมือถือ) · 3.
                  เปิดแชทกับ @930xzcyi แล้ววางข้อความกดส่ง — หากมีแอป LINE บนมือถือ
                  เปิดเว็บนี้บนมือถือแล้วกดปุ่มเดียวจะเด้งเข้าแชทพร้อมข้อความทันที
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Action 2: Direct Server Push Notification */}
              <button
                type="button"
                onClick={handleDirectPushNotify}
                disabled={pushing || pushSuccess}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-emerald-900 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:cursor-default shadow-sm"
              >
                {pushing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gold-400" />
                    <span>กำลังส่งข้อมูล...</span>
                  </>
                ) : pushSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">แจ้งเตือนเข้าระบบแล้ว</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                    <span>⚡ แจ้งเตือนเข้าหลังบ้าน LINE</span>
                  </>
                )}
              </button>

              {/* Action 3: Open Empty LINE OA Chat */}
              <a
                href={OFFICIAL_LINE_OA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#06C755] fill-current" />
                <span>เปิดห้องแชท LINE OA</span>
              </a>
            </div>

            {pushMessage && (
              <p className={`text-xs p-2.5 rounded-xl font-medium ${
                pushSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {pushMessage}
              </p>
            )}
          </div>

          {/* Pre-filled Message Preview Box */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500 font-semibold">
              <span>ข้อความที่จะส่ง (คัดลอกให้อัตโนมัติเมื่อกดเปิด LINE):</span>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[#06C755] hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">คัดลอกข้อความแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 font-sans leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line shadow-inner">
              {message}
            </div>
          </div>

          {/* Quick Notice */}
          <p className="text-[10px] text-center text-gray-400">
            * หาก LINE ไม่เปิดขึ้นมาอัตโนมัติ คุณสามารถกดคัดลอกข้อความ แล้วนำไปส่งในห้องแชท LINE OA ได้ทันที
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
