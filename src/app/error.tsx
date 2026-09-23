'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client/route errors without crashing the entire app
    console.error('Route error caught by app/error.tsx:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-surface-bg">
      <div className="max-w-md w-full text-center bg-white p-8 sm:p-10 rounded-3xl border border-surface-border shadow-card space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-navy-950">
          เกิดข้อผิดพลาดในการแสดงผล
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          {error?.message || 'ระบบไม่สามารถโหลดข้อมูลในหน้านี้ได้ในขณะนี้ กรุณากดลองใหม่อีกครั้ง หรือกลับสู่หน้าแรก'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ลองใหม่อีกครั้ง</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-navy-950 font-bold text-xs sm:text-sm rounded-xl transition-all"
          >
            <Home className="w-4 h-4" />
            <span>กลับสู่หน้าแรก</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
