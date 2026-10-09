'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { getCompareIds } from '@/lib/store/compare-store';

export default function FloatingLineButton() {
  const lineUrl = 'https://lin.ee/NMSe28T3';
  const [hasComparison, setHasComparison] = useState(false);

  useEffect(() => {
    const updateComparison = () => setHasComparison(getCompareIds().length > 0);
    updateComparison();
    window.addEventListener('compare-updated', updateComparison);
    window.addEventListener('storage', updateComparison);
    return () => {
      window.removeEventListener('compare-updated', updateComparison);
      window.removeEventListener('storage', updateComparison);
    };
  }, []);

  return (
    <aside aria-label="ช่องทางติดต่อ LINE" data-compare-active={hasComparison} className="mobile-line-dock fixed right-5 z-40">
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center bg-[#06C755] hover:bg-[#05b34c] text-white shadow-float hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 rounded-full h-12 w-12 justify-center md:h-auto md:w-auto md:px-4 md:py-3 md:space-x-2.5 md:justify-start"
        title="แชทคุยกับเราใน LINE Official Account"
      >
        {/* Pulsing radar ring (desktop only) */}
        <span className="relative hidden md:flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>

        {/* LINE Icon */}
        <div className="flex items-center justify-center">
          <MessageCircle className="w-6 h-6 md:w-5 md:h-5 fill-current" />
        </div>

        <div className="hidden md:flex flex-col text-left pr-1">
          <span className="text-xs font-bold leading-none">คุยกับเราใน LINE</span>
          <span className="text-[10px] text-white/90 leading-tight">LINE Official Account</span>
        </div>
      </a>
    </aside>
  );
}
