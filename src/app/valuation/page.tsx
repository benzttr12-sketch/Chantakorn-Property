'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import { Lock, ShieldAlert, ArrowRight, Building2 } from 'lucide-react';

export default function ValuationPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Admin Panel LandsMaps Tool
    const timer = setTimeout(() => {
      router.push('/admin/properties');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-surface-border shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner border border-amber-200">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="bg-navy-950 text-gold-400 text-xs font-bold px-3 py-1 rounded-full border border-gold-500/30 inline-flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              เฉพาะเจ้าหน้าที่และผู้ดูแลระบบ (Admin Only)
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              ระบบปักหมุด & ประเมินราคา LandsMaps
            </h1>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              เครื่องมือดึงข้อมูลโฉนด รูปแปลง และราคาประเมินทุนทรัพย์กรมที่ดิน ถูกย้ายไปอยู่ใน <strong className="text-navy-950 font-bold">แผงควบคุมหลังบ้าน (Admin Panel)</strong> เพื่อความปลอดภัยของข้อมูล
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/admin/properties"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-navy-950 text-gold-400 hover:bg-navy-900 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>เข้าสู่ระบบหลังบ้าน (Admin Panel)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold text-sm transition-colors"
            >
              กลับหน้าแรก
            </Link>
          </div>

          <p className="text-xs text-gray-400 pt-2">
            กำลังนำท่านไปยังแผงควบคุมหลังบ้านโดยอัตโนมัติ...
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
