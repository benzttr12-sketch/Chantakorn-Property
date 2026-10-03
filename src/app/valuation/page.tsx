'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ValuationPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/valuation');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold animate-pulse text-gold-400">กำลังย้ายไปยังระบบประเมินราคาและปักหมุดโฉนดหลังบ้าน...</p>
      </div>
    </div>
  );
}
