'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Check, 
  Copy, 
  ExternalLink, 
  X, 
  Send,
  ShieldCheck,
  Building2,
  Share2
} from 'lucide-react';
import { PropertyLineData, generatePropertyLineMessage, getLineShareUrl, OFFICIAL_LINE_OA_URL } from '@/lib/line-inquiry';

interface SendToLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyLineData | null;
}

export default function SendToLineModal({ isOpen, onClose, property }: SendToLineModalProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!isOpen || !property) return null;

  const message = generatePropertyLineMessage(property, origin);
  const lineShareUrl = getLineShareUrl(message);

  const handleCopyText = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleOpenLineShare = () => {
    handleCopyText();
    window.open(lineShareUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenLineOA = () => {
    handleCopyText();
    window.open(OFFICIAL_LINE_OA_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-[#06C755] to-emerald-500 p-5 text-white flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <MessageCircle className="w-6 h-6 text-white fill-current" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                ส่งทรัพย์นี้ให้ทีมงานทาง LINE
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

        <div className="p-5 sm:p-6 space-y-4">
          {/* Instructions Box */}
          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-xs text-emerald-950 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-bold text-emerald-900">
                ระบบจัดเตรียมข้อความพร้อมส่งให้เรียบร้อยแล้ว
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                คุณสามารถตรวจดูข้อความด้านล่าง จากนั้นกดเปิด LINE เพื่อส่งข้อความหรือแชร์ให้ทีมงานได้ทันที
              </p>
            </div>
          </div>

          {/* Pre-filled Message Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500 font-semibold">
              <span>ข้อความที่จะส่งไปยัง LINE:</span>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[#06C755] hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-800 font-sans leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line shadow-inner">
              {message}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {/* Button 1: Open LINE OA Direct */}
            <button
              type="button"
              onClick={handleOpenLineOA}
              className="w-full py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>เปิดแชท LINE OA (https://lin.ee/NMSe28T3)</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </button>

            {/* Button 2: LINE Share Link */}
            <button
              type="button"
              onClick={handleOpenLineShare}
              className="w-full py-2.5 px-4 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>ส่งผ่าน LINE Share (เลือกห้องแชทเอง)</span>
            </button>
          </div>

          {/* Transparent Notice */}
          <p className="text-[10px] text-center text-gray-400 pt-1">
            * ระบบไม่มีการเก็บข้อมูลส่วนบุคคลเพิ่ม และเปิดแอปพลิเคชัน LINE ให้คุณเป็นผู้กดยืนยันการส่งด้วยตนเอง
          </p>
        </div>
      </div>
    </div>
  );
}
