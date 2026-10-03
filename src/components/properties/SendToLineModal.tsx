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
import { PropertyLineData, generatePropertyLineMessage, getLineShareUrl, OFFICIAL_LINE_OA_URL } from '@/lib/line-inquiry';
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

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const message = property ? generatePropertyLineMessage(property, origin) : '';
  const lineShareUrl = getLineShareUrl(message);

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
          agent: property.agent || undefined,
        })
      });

      const data = await res.json();
      if (data.success && data.isRealSent) {
        setPushSuccess(true);
        setPushMessage('LINE รับคำขอส่งการ์ดถึงเจ้าหน้าที่ที่ตั้งค่าไว้แล้ว กรุณาตรวจการได้รับข้อความใน LINE');
      } else if (data.success) {
        setPushSuccess(true);
        setPushMessage('✨ จัดเตรียมข้อความสำเร็จ พร้อมส่งต่อเข้า LINE OA');
      } else {
        setPushMessage(data.error || 'ระบบไม่สามารถส่งแจ้งเตือนได้ กรุณาใช้ปุ่มเปิดแชท LINE OA');
      }
    } catch (err) {
      setPushMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณากดปุ่มเปิดแชท LINE OA โดยตรง');
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

          {/* Action 1 (Primary): Direct Native Link to Official LINE OA */}
          <div className="space-y-2.5 pt-1">
            <a
              href={OFFICIAL_LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCopyText}
              className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer group"
            >
              <MessageCircle className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
              <span>เปิดแชทคุยใน LINE OA ทันที</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </a>

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
                    <span className="text-emerald-300">แจ้งเตือนสำเร็จแล้ว</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                    <span>ส่งแจ้งเตือนเข้าระบบ</span>
                  </>
                )}
              </button>

              {/* Action 3: LINE Share to Friends / Groups */}
              <a
                href={lineShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyText}
                className="py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>แชร์ข้อความเข้า LINE</span>
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
