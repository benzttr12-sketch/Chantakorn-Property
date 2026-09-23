'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root layout error caught by global-error.tsx:', error);
  }, [error]);

  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900 flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-black text-slate-900">
            ระบบพบข้อผิดพลาด
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error?.message || 'เกิดข้อผิดพลาดในการโหลดระบบ กรุณากดปุ่มลองใหม่อีกครั้ง'}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-5 py-2.5 bg-slate-900 text-amber-400 text-xs font-bold rounded-xl shadow-sm hover:bg-slate-800 transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              หน้าแรก
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
