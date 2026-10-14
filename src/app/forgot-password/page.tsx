'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { requestPasswordReset } from '@/lib/auth-helpers';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์ Spam)');
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] bg-surface-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-3 group">
          <div className="w-11 h-11 rounded-xl bg-linear-to-br/srgb from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md">
            <Building2 className="w-7 h-7 text-navy-950" />
          </div>
          <div className="text-left">
            <span className="text-navy-950 font-extrabold text-xl tracking-wider block leading-none">
              CHANTAKORN
            </span>
            <span className="text-gold-600 text-xs font-bold tracking-widest leading-tight block">
              PROPERTY
            </span>
          </div>
        </Link>
        <h2 className="mt-6 text-2xl sm:text-3xl font-extrabold text-navy-950">
          รีเซ็ตรหัสผ่าน
        </h2>
        <p className="mt-2 text-xs text-brand-muted">
          กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-surface-border shadow-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p role="status" className="text-sm text-emerald-800 font-semibold">{success}</p>
              <Link
                href="/login"
                className="w-full py-3 px-4 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <span>ไปหน้าเข้าสู่ระบบ</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-hidden transition-all"
                    placeholder="name@example.com"
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>



              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                <span>{loading ? 'กำลังดำเนินการ...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-brand-muted">
              จำรหัสผ่านได้แล้ว?{' '}
              <Link href="/login" className="text-gold-600 font-bold hover:underline">
                กลับไปเข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
