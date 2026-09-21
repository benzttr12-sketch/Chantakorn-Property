'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  User, 
  Camera, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MessageCircle, 
  Mail, 
  ShieldCheck, 
  Upload, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { getStoredUser, updateCurrentUserProfile } from '@/lib/auth-helpers';
import { UserProfile } from '@/lib/types';

interface ProfileHeaderProps {
  onProfileUpdated?: (profile: UserProfile) => void;
  className?: string;
}

const AVATAR_PRESETS = [
  {
    name: 'สไตล์นักบริหาร 1',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'สไตล์นักบริหาร 2',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'สไตล์เป็นกันเอง 1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'สไตล์เป็นกันเอง 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'สไตล์ทางการ 1',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80'
  }
];

export default function ProfileHeader({ onProfileUpdated, className = '' }: ProfileHeaderProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUserData = () => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setName(stored.full_name || '');
      setPhotoUrl(stored.avatar_url || '');
      setPhone(stored.phone || '');
      setLineId(stored.line_id || '');
    }
  };

  useEffect(() => {
    loadUserData();

    const handleAuthChange = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
        setName(e.detail.full_name || '');
        setPhotoUrl(e.detail.avatar_url || '');
        setPhone(e.detail.phone || '');
        setLineId(e.detail.line_id || '');
      }
    };

    window.addEventListener('chantakorn_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('chantakorn_auth_change', handleAuthChange);
    };
  }, []);

  const openEditModal = () => {
    if (user) {
      setName(user.full_name || '');
      setPhotoUrl(user.avatar_url || '');
      setPhone(user.phone || '');
      setLineId(user.line_id || '');
    }
    setFeedback(null);
    setEditModalOpen(true);
  };

  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP)' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 50MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setPhotoUrl(compressedDataUrl);
          setFeedback({ type: 'success', message: 'โหลดรูปภาพสำเร็จ อย่าลืมกด "บันทึกข้อมูล" ด้านล่าง' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'กรุณาระบุชื่อ-นามสกุล' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const updated = await updateCurrentUserProfile({
        full_name: name.trim(),
        avatar_url: photoUrl.trim(),
        phone: phone.trim(),
        line_id: lineId.trim(),
      });

      setUser(updated);
      setFeedback({ 
        type: 'success', 
        message: 'บันทึกสำเร็จ! ข้อมูลชื่อและรูปโปรไฟล์จะแสดงบนงานที่โพสต์ทันที' 
      });

      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }

      setTimeout(() => {
        setEditModalOpen(false);
        setFeedback(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error updating admin profile:', err);
      setFeedback({ type: 'error', message: err.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <header 
        id="admin-profile-header"
        className={`bg-white rounded-2xl p-5 border border-surface-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
      >
        {/* Left: Avatar & Info */}
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold-400/80 bg-navy-950 flex items-center justify-center text-white font-bold text-xl relative shadow-md">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name}
                  fill
                  unoptimized
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{user.full_name?.charAt(0) || 'A'}</span>
              )}
            </div>
            <button
              onClick={openEditModal}
              title="เปลี่ยนรูปโปรไฟล์"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold-500 text-navy-950 flex items-center justify-center shadow-md hover:bg-gold-400 transition-transform active:scale-95 border-2 border-white"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-navy-950">{user.full_name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center space-x-1 ${
                user.role === 'ADMIN' 
                  ? 'bg-gold-100 text-gold-800 border border-gold-300/60' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
              }`}>
                <ShieldCheck className="w-3 h-3 mr-0.5" />
                <span>{user.role === 'ADMIN' ? 'ผู้ดูแลระบบ (ADMIN)' : 'นายหน้า (AGENT)'}</span>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-muted">
              {user.email && (
                <span className="flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-gold-500" />
                  <span>{user.email}</span>
                </span>
              )}
              {user.phone && (
                <span className="flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-gold-500" />
                  <span>{user.phone}</span>
                </span>
              )}
              {user.line_id && (
                <span className="flex items-center space-x-1 text-emerald-600 font-medium">
                  <MessageCircle className="w-3 h-3" />
                  <span>LINE: {user.line_id}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Button */}
        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            onClick={openEditModal}
            id="btn-edit-admin-profile"
            className="flex items-center space-x-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 border border-navy-700/60"
          >
            <Edit3 className="w-3.5 h-3.5 text-gold-400" />
            <span>แก้ไขชื่อและรูปภาพโปรไฟล์</span>
          </button>
        </div>
      </header>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-surface-border space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-950">แก้ไขโปรไฟล์ผู้ดูแลระบบ / นายหน้า</h3>
                  <p className="text-xs text-brand-muted">รูปภาพและชื่อนี้จะแสดงบนประกาศทรัพย์ที่คุณโพสต์โดยอัตโนมัติ</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Banner */}
            {feedback && (
              <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                feedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Photo Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-navy-900 block">รูปโปรไฟล์ (Avatar)</label>
                
                <div className="flex items-center space-x-4">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-gold-400 bg-gray-100 flex-shrink-0 shadow-inner">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt="Preview"
                        fill
                        unoptimized
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl">
                        {name.charAt(0) || 'A'}
                      </div>
                    )}
                  </div>

                  <div className="flex-grow space-y-2">
                    {/* Drag & drop or upload */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors ${
                        isDragging ? 'border-gold-500 bg-gold-50' : 'border-gray-200 hover:border-gold-400 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Upload className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                      <span className="text-xs font-semibold text-navy-900 block">คลิกเลือกรูปภาพ หรือ ลากไฟล์มาวางที่นี่</span>
                      <span className="text-[10px] text-gray-400 block">รองรับ JPG, PNG หรือ WebP (ปรับขนาดคมชัดอัตโนมัติ)</span>
                    </div>
                  </div>
                </div>

                {/* Preset Avatars Selection */}
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 flex items-center space-x-1 mb-2">
                    <Sparkles className="w-3 h-3 text-gold-500" />
                    <span>หรือเลือกรูปโปรไฟล์มืออาชีพสำเร็จรูป:</span>
                  </span>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPhotoUrl(preset.url)}
                        className={`relative w-11 h-11 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                          photoUrl === preset.url ? 'border-gold-500 scale-105 shadow-md ring-2 ring-gold-300' : 'border-gray-200 opacity-70 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <Image
                          src={preset.url}
                          alt={preset.name}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* URL Input Fallback */}
                <div>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="หรือวางลิงก์รูปภาพ (https://...)"
                    className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-gray-700"
                  />
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-900 block">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น คุณฉันทากร นวลจันทร์ (เบนซ์)"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 font-medium text-navy-950"
                />
              </div>

              {/* Phone & LINE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-900 block">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="เช่น 081-604-0097"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-navy-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-900 block">LINE ID</label>
                  <input
                    type="text"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    placeholder="เช่น @chantakorn"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-navy-950"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-1.5 px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึกและซิงค์งาน...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>บันทึกการเปลี่ยนแปลงทันที</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
