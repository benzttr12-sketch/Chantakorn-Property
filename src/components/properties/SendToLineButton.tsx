'use client';

import React, { useState } from 'react';
import { MessageCircle, Check, Send } from 'lucide-react';
import { PropertyLineData, generatePropertyLineMessage, getLineShareUrl, OFFICIAL_LINE_OA_URL } from '@/lib/line-inquiry';
import SendToLineModal from './SendToLineModal';

interface SendToLineButtonProps {
  property: PropertyLineData;
  variant?: 'card' | 'banner' | 'sidebar' | 'mobile-sticky' | 'icon';
  className?: string;
  label?: string;
}

export default function SendToLineButton({
  property,
  variant = 'card',
  className = '',
  label
}: SendToLineButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Copy pre-filled message to clipboard immediately as fallback
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const msg = generatePropertyLineMessage(property, window.location.origin);
      navigator.clipboard.writeText(msg).catch(() => {});
    }

    setModalOpen(true);
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`p-2 rounded-xl text-[#06C755] hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer ${className}`}
          title="ส่งทรัพย์นี้ให้ทีมงานทาง LINE"
          aria-label="ส่งทรัพย์นี้ให้ทีมงานทาง LINE"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
        </button>
        <SendToLineModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          property={property}
        />
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`w-full py-2 px-3 bg-emerald-50 hover:bg-[#06C755] text-emerald-800 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all duration-200 border border-emerald-200 hover:border-[#06C755] cursor-pointer group/line ${className}`}
          title="สร้างข้อความอัตโนมัติแล้วส่งหาทีมงานทาง LINE"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-current text-[#06C755] group-hover/line:text-white transition-colors" />
          <span>{label || 'ส่งทรัพย์นี้ทาง LINE'}</span>
        </button>
        <SendToLineModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          property={property}
        />
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer ${className}`}
          title="สร้างข้อความพร้อมรูปและลิงก์ส่งให้ทีมงานทาง LINE OA"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          <span>{label || 'ส่งทรัพย์นี้ให้ทีมงานทาง LINE'}</span>
        </button>
        <SendToLineModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          property={property}
        />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-[#06C755] to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-md hover:shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${className}`}
          title="สร้างข้อความสอบถามทรัพย์นี้แล้วเปิด LINE OA ทันที"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          <span>{label || 'ส่งทรัพย์นี้ให้ทีมงานทาง LINE OA'}</span>
        </button>
        <SendToLineModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          property={property}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`py-2 px-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${className}`}
      >
        <MessageCircle className="w-3.5 h-3.5 fill-current" />
        <span>{label || 'ส่งทาง LINE'}</span>
      </button>
      <SendToLineModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        property={property}
      />
    </>
  );
}
