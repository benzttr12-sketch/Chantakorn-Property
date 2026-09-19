'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  ArrowRight, 
  CheckCircle2,
  AlertCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { auth } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { signInWithGoogle, registerWithEmail } from '@/lib/auth-helpers';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const profile = await signInWithGoogle();
      if (profile.role === 'ADMIN' || profile.role === 'AGENT') {
        router.push('/admin');
      } else {
        router.push('/favorites');
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถสมัครสมาชิกด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (dataBackend === 'supabase' && supabase) {
      try {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
        setRegistered(true);
        setLoading(false);
        return;
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
        setLoading(false);
        return;
      }
    }

    if (dataBackend === 'firebase' && auth) {
      try {
        const profile = await registerWithEmail(email, password, fullName, phone);
        setRegistered(true);
        setLoading(false);
        setTimeout(() => {
          if (profile.role === 'ADMIN' || profile.role === 'AGENT') {
            router.push('/admin');
          } else {
            router.push('/favorites');
          }
        }, 1500);
        return;
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
        setLoading(false);
        return;
      }
    }

    // Local fallback
    try {
      localStorage.setItem('chantakorn_auth_user', JSON.stringify({
        id: `usr-${Date.now()}`,
        full_name: fullName,
        email,
        phone,
        role: 'USER',
      }));
      setRegistered(true);
      setLoading(false);
      setTimeout(() => router.push('/favorites'), 1500);
    } catch {
      setError('ไม่สามารถลงทะเบียนได้');
      setLoading(false);
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
          สมัครสมาชิกใหม่
        </h2>
        <p className="mt-2 text-xs text-brand-muted">
          สมัครสมาชิก Chantakorn Property
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-surface-border shadow-xl">
          {registered && (
            <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
              สมัครสมาชิกสำเร็จเรียบร้อยแล้ว กำลังนำคุณเข้าสู่ระบบ...
            </p>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-up Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full py-3 px-4 mb-5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center space-x-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>สมัครสมาชิกด้วยบัญชี Google</span>
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400 font-medium">หรือกรอกข้อมูลสมัครสมาชิก</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ชื่อ-นามสกุล *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณกานดา วงศ์สวัสดิ์"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                อีเมล *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                เบอร์โทรศัพท์ติดต่อ
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="081-xxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                กำหนดรหัสผ่าน (อย่างน้อย 6 ตัวอักษร) *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
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
              disabled={loading || registered}
              className="w-full py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'กำลังลงทะเบียน...' : 'สมัครสมาชิก'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            มีบัญชีสมาชิกอยู่แล้ว?{' '}
            <Link href="/login" className="text-navy-950 font-bold hover:underline">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
