'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { auth } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { signInWithGoogle, loginWithEmail } from '@/lib/auth-helpers';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect');
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSuccessfulAuth = (role: string) => {
    if (redirectTarget) {
      router.push(redirectTarget);
      return;
    }
    if (role === 'ADMIN' || role === 'AGENT') {
      router.push('/admin');
    } else {
      router.push('/profile');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const profile = await signInWithGoogle();
      handleSuccessfulAuth(profile.role);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

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

        handleSuccessfulAuth(profile.role);
        return;
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        setLoading(false);
        return;
      }
    }

    if (dataBackend === 'firebase' && auth) {
      try {
        const profile = await loginWithEmail(email, password);
        handleSuccessfulAuth(profile.role);
        return;
      } catch (err: any) {
        setError(err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        setLoading(false);
        return;
      }
    }

    setError('กรุณาเข้าสู่ระบบด้วย Google หรือสมัครสมาชิก');
    setLoading(false);
  };

  return (
    <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-surface-border shadow-xl">
      {/* Reason notice if redirected from admin or protected route */}
      {reason === 'auth_required' && (
        <div className="mb-5 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center space-x-3 text-xs text-amber-900 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>ต้องเข้าสู่ระบบก่อน:</strong> กรุณาเข้าสู่ระบบด้วยบัญชีของคุณเพื่อเข้าถึงหน้านี้
          </span>
        </div>
      )}

      {reason === 'admin_required' && (
        <div className="mb-5 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center space-x-3 text-xs text-amber-900 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>สิทธิ์ผู้ดูแลระบบ:</strong> บัญชีนี้ยังไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน กรุณาเข้าสู่ระบบด้วยอีเมลที่เป็นผู้ดูแลระบบ
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign-in Button */}
      <button
        id="google-signin-btn"
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center space-x-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white hover:bg-gray-50 text-xs sm:text-sm font-bold text-gray-700 transition-all cursor-pointer disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>เข้าสู่ระบบด้วย Google</span>
      </button>

      <p className="mt-2 text-[11px] text-center text-gray-500">
        เข้าสู่ระบบด้วย Google ด้วยบัญชี <strong className="text-navy-950 font-semibold">benzttr12@gmail.com</strong> จะได้รับสิทธิ์ <span className="text-amber-700 font-bold">แอดมิน (ADMIN)</span> อัตโนมัติ
      </p>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-white text-gray-500 font-medium">หรือเข้าสู่ระบบด้วยอีเมล</span>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-navy-950 mb-1.5">
            อีเมล (Email)
          </label>
          <div className="relative">
            <input
              id="login-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              placeholder="admin@chantakornproperty.com"
            />
            <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-navy-950">
              รหัสผ่าน (Password)
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-gold-600 hover:text-gold-700 font-medium"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              placeholder="••••••••"
            />
            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer"
        >
          <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-brand-muted">
          ยังไม่มีบัญชีผู้ใช้งาน?{' '}
          <Link href="/register" className="text-gold-600 font-bold hover:underline">
            สมัครสมาชิกใหม่
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
          เข้าถึงระบบจัดการอสังหาริมทรัพย์และโปรไฟล์ส่วนตัวของคุณ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="bg-white p-8 rounded-3xl text-center text-xs">กำลังโหลด...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
