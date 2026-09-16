'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function FloatingLineButton() {
  const lineUrl = 'https://lin.ee/NMSe28T3';

  return (
    <aside aria-label="ช่องทางติดต่อ LINE" className="fixed bottom-20 md:bottom-8 right-5 z-40">
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white px-4 py-3 rounded-full shadow-float hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group"
        title="แชทคุยกับเราใน LINE Official Account"
      >
        {/* Pulsing radar ring */}
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>

        {/* LINE Icon */}
        <div className="w-5 h-5 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 fill-current" />
        </div>

        <div className="flex flex-col text-left pr-1">
          <span className="text-xs font-bold leading-none">คุยกับเราใน LINE</span>
          <span className="text-[10px] text-white/90 leading-tight">LINE Official Account</span>
        </div>
      </a>
    </aside>
  );
}
