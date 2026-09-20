'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Save, 
  ShieldCheck, 
  ArrowRight, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  LayoutDashboard,
  Heart,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { getStoredUser, updateCurrentUserProfile, logoutUser, syncFirebaseUserProfile } from '@/lib/auth-helpers';
import { UserProfile } from '@/lib/types';

interface ProfileEditorProps {
  isAdminView?: boolean;
}

export default function ProfileEditor({ isAdminView = false }: ProfileEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    // Local profile state exists only in explicitly enabled demo mode.
    const stored = getStoredUser();
    if (stored) {
      setUserProfile(stored);
      setFullName(stored.full_name || '');
      setPhone(stored.phone || '');
      setLineId(stored.line_id || '');
      setBio(stored.bio || '');
      setAvatarUrl(stored.avatar_url || '');
    }

    // Firebase display and role data are loaded from the protected profile doc.
    let unsubscribe: (() => void) | undefined;
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const profile = await syncFirebaseUserProfile(user);
            setUserProfile(profile);
            setFullName(profile.full_name);
            setPhone(profile.phone || '');
            setLineId(profile.line_id || '');
            setBio(profile.bio || '');
            setAvatarUrl(profile.avatar_url || '');
          } catch {
            setUserProfile(null);
            setErrorMessage('โหลดข้อมูลสมาชิกจากระบบไม่ได้ กรุณาเข้าสู่ระบบอีกครั้ง');
          }
          setLoading(false);
        } else {
          // Explicit demo auth may still provide a local profile.
          const localUser = getStoredUser();
          if (!localUser) {
            setUserProfile(null);
          }
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Process real image file (from input or drag & drop)
  const processImageFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพจริง (รองรับไฟล์ JPG, PNG หรือ WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('ไฟล์รูปภาพมีขนาดใหญ่เกินไป (กรุณาใช้ไฟล์ขนาดไม่เกิน 10MB)');
      return;
    }

    setErrorMessage('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize canvas to max 480x480 to keep it crisp, high-resolution and lightweight
        const canvas = document.createElement('canvas');
        const maxDim = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setAvatarUrl(dataUrl);
          setSuccessMessage('อัปโหลดรูปภาพจริงเรียบร้อยแล้ว กดปุ่ม "บันทึกการเปลี่ยนแปลง" เพื่อใช้งาน');
          setTimeout(() => setSuccessMessage(''), 4000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSuccessMessage('นำรูปภาพโปรไฟล์ออกเรียบร้อยแล้ว กด "บันทึกการเปลี่ยนแปลง" เพื่อยืนยัน');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await updateCurrentUserProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        line_id: lineId.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim(),
      });

      setUserProfile(updated);
      setSuccessMessage('บันทึกข้อมูลส่วนตัวและรูปโปรไฟล์เรียบร้อยแล้ว!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold text-gray-500">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </div>
    );
  }

  // If user is not logged in at all
  if (!userProfile) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-surface-border shadow-xl text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gold-50 border border-gold-200 text-gold-600 flex items-center justify-center">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-navy-950">ยังไม่ได้เข้าสู่ระบบ</h2>
        <p className="mt-2 text-xs text-brand-muted leading-relaxed">
          กรุณาเข้าสู่ระบบก่อนเพื่อดูและแก้ไขข้อมูลส่วนตัวของคุณ หรือลงทะเบียนสมาชิกใหม่
        </p>
        <div className="mt-6 space-y-2.5">
          <Link
            id="profile-login-btn"
            href={`/login?redirect=${encodeURIComponent(isAdminView ? '/admin/profile' : '/profile')}`}
            className="w-full py-3 px-4 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <span>เข้าสู่ระบบทันที</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-xl transition-all block"
          >
            สมัครสมาชิกใหม่
          </Link>
        </div>
      </div>
    );
  }

  const roleText = 
    userProfile.role === 'ADMIN' ? 'ผู้ดูแลระบบสูงสุด (ADMIN)' :
    userProfile.role === 'AGENT' ? 'นายหน้าอสังหาริมทรัพย์ (AGENT)' :
    'สมาชิกทั่วไป (MEMBER)';

  const roleColor =
    userProfile.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border-purple-200' :
    userProfile.role === 'AGENT' ? 'bg-amber-100 text-amber-800 border-amber-200' :
    'bg-blue-100 text-blue-800 border-blue-200';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-surface-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
              โปรไฟล์ส่วนตัว
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleColor}`}>
              {roleText}
            </span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-brand-muted">
            จัดการรูปภาพประจำตัว ข้อมูลการติดต่อ และรายละเอียดบัญชีผู้ใช้งานของคุณ
          </p>
        </div>

        {/* Quick actions for admin/agent */}
        <div className="flex flex-wrap items-center gap-2">
          {(userProfile.role === 'ADMIN' || userProfile.role === 'AGENT') && !isAdminView && (
            <Link
              id="goto-admin-btn"
              href="/admin"
              className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-300 border border-gold-400/40 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <LayoutDashboard className="w-4 h-4 text-gold-400" />
              <span>แผงควบคุมระบบ (Admin)</span>
            </Link>
          )}
          <button
            id="profile-logout-btn"
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 font-medium text-xs rounded-xl transition-all flex items-center space-x-1.5"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-xs sm:text-sm text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center space-x-3 text-xs sm:text-sm text-red-800 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Photo Management */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-surface-border shadow-sm flex flex-col items-center text-center space-y-5">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gold-400/80 shadow-lg bg-gray-100 flex items-center justify-center relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-navy-900 to-navy-950 text-gold-400 flex items-center justify-center text-4xl font-extrabold">
                  {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            {/* Quick camera trigger icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2.5 bg-navy-950 hover:bg-gold-500 text-gold-400 hover:text-navy-950 rounded-full shadow-md transition-all border-2 border-white"
              title="อัปโหลดรูปภาพใหม่"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-navy-950">{fullName || 'ผู้ใช้งาน'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{userProfile.email}</p>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleImageFileChange}
          />

          {/* Dedicated Real Image Upload & Drag-and-Drop Area */}
          <div className="w-full space-y-3 pt-2 border-t border-gray-100">
            <div
              id="avatar-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 ${
                isDragging
                  ? 'border-gold-500 bg-gold-50/60 scale-[1.02]'
                  : 'border-gray-200 hover:border-gold-400 hover:bg-gold-50/20 bg-gray-50/60'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gold-100 text-gold-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-navy-950">
                  คลิกเพื่อเลือกรูปภาพจริง
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  หรือลากไฟล์รูปภาพมาวางที่นี่
                </p>
              </div>
              <span className="text-[10px] text-brand-muted bg-white/80 px-2 py-0.5 rounded-full border border-gray-200">
                รองรับ JPG, PNG, WebP (ไม่เกิน 10MB)
              </span>
            </div>

            {/* Actions when photo is present */}
            {avatarUrl && (
              <div className="flex items-center space-x-2 pt-1">
                <button
                  id="change-avatar-file-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปลี่ยนรูปภาพ</span>
                </button>
                <button
                  id="remove-avatar-btn"
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="py-2 px-3 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1"
                  title="ลบรูปภาพ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบรูป</span>
                </button>
              </div>
            )}

            {fileName && (
              <div className="text-[11px] text-gray-500 truncate text-left px-1 flex items-center space-x-1">
                <ImageIcon className="w-3 h-3 text-gold-600 flex-shrink-0" />
                <span className="truncate">{fileName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Profile Information Form */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-surface-border shadow-sm">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-bold text-navy-950 flex items-center space-x-2">
                <User className="w-5 h-5 text-gold-500" />
                <span>ข้อมูลประจำตัวและช่องทางติดต่อ</span>
              </h2>
              <span className="text-[11px] text-gray-400">* จำเป็นต้องระบุ</span>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-navy-950 mb-1.5">
                ชื่อ - นามสกุล *
              </label>
              <div className="relative">
                <input
                  id="profile-fullname-input"
                  type="text"
                  required
                  placeholder="เช่น จันทกร รัตนวิบูลย์"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Email (Read only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-navy-950">
                  อีเมล (Email)
                </label>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  ยืนยันแล้ว
                </span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={userProfile.email || ''}
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-600 cursor-not-allowed outline-none"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                อีเมลเชื่อมโยงกับระบบล็อกอินความปลอดภัย ไม่สามารถแก้ไขโดยตรงได้
              </p>
            </div>

            {/* Grid for Phone & Line ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <div className="relative">
                  <input
                    id="profile-phone-input"
                    type="tel"
                    placeholder="เช่น 081-604-0097"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5">
                  LINE ID
                </label>
                <input
                  id="profile-line-input"
                  type="text"
                  placeholder="เช่น @chantakorn"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Bio / Description */}
            <div>
              <label className="block text-xs font-bold text-navy-950 mb-1.5">
                แนะนำตัว / ข้อมูลเพิ่มเติม (Bio)
              </label>
              <textarea
                id="profile-bio-input"
                rows={3}
                placeholder="ระบุข้อมูลแนะนำตัว หรือประสบการณ์ที่ต้องการแสดงในระบบ..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                ข้อมูลจะถูกอัปเดตและซิงค์กับฐานข้อมูลทันที
              </span>

              <button
                id="save-profile-btn"
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4 text-gold-400" />
                <span>{saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการเปลี่ยนแปลง'}</span>
              </button>
            </div>
          </form>

          {/* Quick Shortcuts Box */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              เมนูทางลัดที่เกี่ยวข้อง
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/favorites"
                className="p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-200/80 flex items-center space-x-3 transition-colors group"
              >
                <div className="p-2 bg-red-100 text-red-600 rounded-xl group-hover:scale-105 transition-transform">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-navy-950 block">รายการทรัพย์ที่บันทึกไว้</span>
                  <span className="text-[11px] text-gray-500">ดูบ้านและที่ดินที่คุณกดถูกใจ</span>
                </div>
              </Link>

              {(userProfile.role === 'ADMIN' || userProfile.role === 'AGENT') && (
                <Link
                  href="/admin/properties"
                  className="p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-200/80 flex items-center space-x-3 transition-colors group"
                >
                  <div className="p-2 bg-gold-100 text-gold-700 rounded-xl group-hover:scale-105 transition-transform">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-950 block">จัดการรายการอสังหาริมทรัพย์</span>
                    <span className="text-[11px] text-gray-500">เพิ่ม ลบ และแก้ไขประกาศขาย/เช่า</span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
