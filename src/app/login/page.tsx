'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2,
  AlertCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { dataBackend, isDemoAuthEnabled } from '@/lib/backend';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const demoAuthEnabled = isDemoAuthEnabled;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (dataBackend === 'supabase' && supabase) {
      try {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile, error: profileError } = user
          ? await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single()
          : { data: null, error: new Error('No authenticated user') };

        if (profileError || !profile || !['ADMIN', 'AGENT', 'USER'].includes(profile.role)) {
          await supabase.auth.signOut();
          setError('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบจัดการ');
          setLoading(false);
          return;
        }

        router.push(profile.role === 'USER' ? '/favorites' : '/admin');
        return;
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        setLoading(false);
        return;
      }
    }

    setError(demoAuthEnabled ? 'กรุณาใช้ปุ่มทดลองด้านล่าง ไม่ต้องกรอกอีเมลหรือรหัสผ่านจริง' : 'เว็บไซต์นี้ยังไม่เปิดการเข้าสู่ระบบ สามารถค้นหาและบันทึกทรัพย์โปรดได้โดยไม่ต้องสมัครสมาชิก');
    setLoading(false);
  };

  const handleQuickDemoLogin = (role: 'ADMIN' | 'AGENT' | 'USER') => {
    if (!demoAuthEnabled) return;
    try {
      localStorage.setItem('chantakorn_auth_user', JSON.stringify({
        demo: true,
        email: role === 'ADMIN' ? 'admin@chantakornproperty.com' : role === 'AGENT' ? 'agent@chantakornproperty.com' : 'user@example.com',
        role: role,
        full_name: role === 'ADMIN' ? 'ผู้ดูแลระบบ (Admin)' : role === 'AGENT' ? 'คุณพิมลภัส (Agent)' : 'คุณลูกค้า (User)',
      }));
    } catch {
      setError('กรุณาอนุญาตให้เว็บไซต์บันทึกข้อมูลในเบราว์เซอร์เพื่อเข้าโหมดตัวอย่าง');
      return;
    }

    if (role === 'USER') {
      router.push('/favorites');
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-3 group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md">
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
          เข้าสู่ระบบสมาชิก
        </h2>
        <p className="mt-2 text-xs text-brand-muted">
          เข้าถึงระบบจัดการอสังหาริมทรัพย์และรายการทรัพย์โปรดของคุณ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-surface-border shadow-xl">
          {dataBackend !== 'supabase' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{demoAuthEnabled ? 'โหมดตัวอย่างใช้ข้อมูลในเบราว์เซอร์นี้เท่านั้น ใช้ปุ่มทดลองด้านล่างได้ทันที' : 'ยังไม่เปิดระบบสมาชิก ค้นหาทรัพย์และบันทึกรายการโปรดได้ทันทีโดยไม่ต้องเข้าสู่ระบบ'}</p>}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                อีเมล (Email)
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="admin@chantakornproperty.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">
                  รหัสผ่าน (Password)
                </label>
                <Link href="/contact" className="text-[11px] text-gold-600 hover:underline">ติดต่อผู้ดูแลบัญชี</Link>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || dataBackend !== 'supabase' || !supabase}
              className="w-full py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Demo sign-in is deliberately disabled unless explicitly enabled. */}
          {demoAuthEnabled && <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center mb-3">
              ทดสอบเข้าสู่ระบบด่วน (Demo Mode)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ADMIN')}
                className="p-2.5 bg-navy-50 hover:bg-navy-100 text-navy-950 rounded-xl text-xs font-bold border border-navy-200 flex items-center justify-center space-x-1.5 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-gold-600" />
                <span>เข้าสู่ระบบ Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('AGENT')}
                className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold border border-gray-200 flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>เข้าสู่ระบบ Agent</span>
              </button>
            </div>
          </div>}

          <div className="mt-6 text-center text-xs text-gray-500">
            ยังไม่มีบัญชีสมาชิก?{' '}
            <Link href="/register" className="text-navy-950 font-bold hover:underline">
              สมัครสมาชิกใหม่
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
