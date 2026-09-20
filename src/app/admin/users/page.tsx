'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Mail, 
  Phone, 
  Search, 
  Check, 
  Shield,
  Pencil,
  X
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { subscribeToUserProfile } from '@/lib/auth-helpers';
import { 
  fetchUsers,
  updateUserProfile, 
  updateUserRole,
} from '@/lib/store/properties-store';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'AGENT' | 'USER'>('ALL');
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    let active = true;
    let request = 0;
    const unsubscribe = subscribeToUserProfile(profile => {
      const currentRequest = ++request;
      setCurrentUserId(profile?.id || null);
      setUsers([]);
      if (profile?.role !== 'ADMIN') {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      fetchUsers().then(result => {
        if (active && request === currentRequest) setUsers(result);
      }).catch(() => {
        if (active && request === currentRequest) setError('โหลดรายชื่อผู้ใช้ไม่ได้ กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบ');
      }).finally(() => {
        if (active && request === currentRequest) setLoading(false);
      });
    }, () => {
      request++;
      setCurrentUserId(null);
      setUsers([]);
      setLoading(false);
      setError('ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่');
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const openEditModal = (user: UserProfile) => {
    setError('');
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditPhone(user.phone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editFullName.trim() || saving) return;

    setError('');
    setSaving(true);
    try {
      const updated = await updateUserProfile(editingUser.id, {
        full_name: editFullName.trim(),
        phone: editPhone.trim(),
      });
      setUsers(updated);
      setEditingUser(null);
      triggerNotification(`บันทึกข้อมูล "${editFullName}" สำเร็จ`);
    } catch {
      setError('บันทึกข้อมูลผู้ใช้ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'AGENT' | 'USER') => {
    if (!currentUserId || userId === currentUserId || saving) return;
    setError('');
    setSaving(true);
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(updated);
      const targetUser = updated.find(u => u.id === userId);
      triggerNotification(`อัปเดตสิทธิ์ของ "${targetUser?.full_name}" เป็น ${newRole === 'ADMIN' ? 'ผู้ดูแลระบบ (Admin)' : newRole === 'AGENT' ? 'นายหน้า (Agent)' : 'ผู้ใช้ทั่วไป (User)'} สำเร็จ`);
    } catch {
      setError('เปลี่ยนสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบ');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))
      );
    }
    return true;
  });

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const agentCount = users.filter((u) => u.role === 'AGENT').length;
  const generalUserCount = users.filter((u) => u.role === 'USER').length;

  return (
    <div className="space-y-6 pb-20">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <p className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs leading-relaxed text-blue-900">
        รายชื่อนี้แสดงสมาชิกที่สมัครบัญชีแล้ว สามารถแก้ไขชื่อ เบอร์โทรศัพท์ และมอบหมายสิทธิ์ได้ สมาชิกใหม่ต้องสมัครผ่านหน้าสมัครสมาชิกก่อน และไม่สามารถเปลี่ยนสิทธิ์ของบัญชีตนเองจากหน้านี้
      </p>
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900 text-emerald-100 px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center space-x-2.5 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-gold-600 font-bold text-xs uppercase tracking-widest mb-1">
            <Shield className="w-4 h-4" />
            <span>ROLE & PERMISSION MANAGEMENT</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-950">จัดการสิทธิ์ผู้ดูแลระบบ (Admin & Agents)</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            กำหนดบทบาทผู้ใช้งาน เลือกว่าใครเป็น Admin เพื่อเข้าถึงระบบจัดการทั้งหมด หรือ Agent ดูแลงานขาย
          </p>
        </div>

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">ผู้ดูแลระบบสูงสุด (ADMIN)</span>
            <div className="text-2xl font-extrabold text-gold-600 mt-1">{adminCount} ท่าน</div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">เข้าถึงและแก้ไขได้ทุกส่วนในระบบ</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gold-50 text-gold-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">นายหน้า / ตัวแทน (AGENT)</span>
            <div className="text-2xl font-extrabold text-navy-900 mt-1">{agentCount} ท่าน</div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">จัดการทรัพย์ที่ได้รับมอบหมาย</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-navy-900 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">ลูกค้า / สมาชิกทั่วไป (USER)</span>
            <div className="text-2xl font-extrabold text-gray-700 mt-1">{generalUserCount} ท่าน</div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">บันทึกทรัพย์โปรดและส่งคำขอ</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทรศัพท์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              roleFilter === 'ALL' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('ADMIN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              roleFilter === 'ADMIN' ? 'bg-gold-500 text-navy-950 font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            แอดมิน ({adminCount})
          </button>
          <button
            onClick={() => setRoleFilter('AGENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              roleFilter === 'AGENT' ? 'bg-navy-800 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ตัวแทน ({agentCount})
          </button>
          <button
            onClick={() => setRoleFilter('USER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              roleFilter === 'USER' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ผู้ใช้ทั่วไป ({generalUserCount})
          </button>
        </div>
      </div>

      {/* Users & Roles Management Table */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="p-4 font-semibold">ผู้ใช้งาน</th>
                <th className="p-4 font-semibold">ข้อมูลติดต่อ</th>
                <th className="p-4 font-semibold">บทบาทปัจจุบัน</th>
                <th className="p-4 font-semibold text-center">สิทธิ์ Admin</th>
                <th className="p-4 font-semibold text-center">เปลี่ยนระดับสิทธิ์</th>
                <th className="p-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {loading ? 'กำลังโหลดรายชื่อผู้ใช้...' : error ? 'ยังไม่สามารถแสดงรายชื่อผู้ใช้ได้' : 'ไม่พบรายชื่อผู้ใช้ที่ตรงตามเงื่อนไข'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'ADMIN';
                  const isAgent = u.role === 'AGENT';
                  const isSelf = u.id === currentUserId;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isAdmin 
                              ? 'bg-gradient-to-br from-gold-400 to-gold-600 text-navy-950 shadow-sm' 
                              : isAgent 
                              ? 'bg-navy-900 text-white' 
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {u.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-navy-950 text-sm flex items-center space-x-1.5">
                              <span>{u.full_name}</span>
                              {isAdmin && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gold-100 text-gold-900 border border-gold-300">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">ID: {u.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="p-4 text-gray-600">
                        <div className="flex items-center space-x-1.5 text-xs text-gray-900 font-medium">
                          <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>{u.email || '-'}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center space-x-1.5 text-[11px] text-gray-500 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Current Role Badge */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          isAdmin
                            ? 'bg-gold-100 text-gold-900 border border-gold-300'
                            : isAgent
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isAdmin ? '🛡️ ผู้ดูแลระบบ (ADMIN)' : isAgent ? '👔 นายหน้า (AGENT)' : '👤 ผู้ใช้ทั่วไป (USER)'}
                        </span>
                      </td>

                      {/* Quick Toggle Admin Switch */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleRoleChange(u.id, isAdmin ? 'AGENT' : 'ADMIN')}
                          disabled={!currentUserId || isSelf || saving}
                          role="switch"
                          aria-checked={isAdmin}
                          aria-label={`สิทธิ์ผู้ดูแลระบบของ ${u.full_name}`}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isAdmin ? 'bg-gold-500' : 'bg-gray-300'
                          }`}
                          title={isSelf ? 'ไม่สามารถเปลี่ยนสิทธิ์ของตนเอง' : isAdmin ? 'คลิกเพื่อยกเลิกสิทธิ์ Admin' : 'คลิกเพื่อแต่งตั้งเป็น Admin'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isAdmin ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="block text-[10px] text-gray-500 mt-1">
                          {isAdmin ? 'เป็นแอดมิน' : 'ไม่ได้เป็นแอดมิน'}
                        </span>
                      </td>

                      {/* Role Dropdown Selector */}
                      <td className="p-4 text-center">
                        <select
                          value={u.role}
                          disabled={!currentUserId || isSelf || saving}
                          aria-label={`เปลี่ยนสิทธิ์ของ ${u.full_name}`}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserProfile['role'])}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-navy-950 font-bold focus:outline-none focus:ring-2 focus:ring-gold-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="ADMIN">ตั้งเป็น ADMIN</option>
                          <option value="AGENT">ตั้งเป็น AGENT</option>
                          <option value="USER">ตั้งเป็น USER</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEditModal(u)}
                            disabled={saving}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไขข้อมูลผู้ใช้"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Guide Box */}
      <div className="bg-navy-950 text-white p-6 rounded-2xl border border-navy-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-gold-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>คำอธิบายสิทธิ์ในระบบ CHANTAKORN PROPERTY</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
            • <strong>ADMIN:</strong> มีสิทธิ์สูงสุดในการจัดการทรัพย์ทุกรายการ ดูแลกล่องข้อความผู้ติดต่อ จัดการสมาชิก และปรับแต่งข้อมูลสำนักงาน<br />
            • <strong>AGENT:</strong> มีสิทธิ์เพิ่มและแก้ไขรายการอสังหาริมทรัพย์ที่รับผิดชอบ และดูข้อความนัดหมายเข้าชมทรัพย์<br />
            • <strong>USER:</strong> สิทธิ์สำหรับลูกค้าทั่วไป สามารถค้นหา บันทึกรายการโปรด และส่งคำขอฝากขาย/นัดหมายเข้าชมทรัพย์
          </p>
        </div>
      </div>

      {/* ===== Edit User Modal ===== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-surface-border animate-fadeIn relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-navy-950">แก้ไขข้อมูลผู้ใช้</h3>
                <p className="text-xs text-brand-muted mt-0.5">แก้ไขชื่อ-นามสกุลและเบอร์โทรศัพท์</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={saving}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ชื่อ-นามสกุล *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>

              {/* Authentication email is read-only. */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  อีเมล
                </label>
                <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">{editingUser.email || '-'}</p>
                <p className="mt-1 text-[11px] text-gray-500">อีเมลเข้าสู่ระบบไม่สามารถเปลี่ยนจากหน้านี้ได้</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  maxLength={30}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                  placeholder="081-xxx-xxxx"
                />
              </div>

              {/* Role info (read-only in this modal) */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center space-x-2 border border-gray-100">
                <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600">
                  บทบาทปัจจุบัน:{' '}
                  <strong className="text-navy-950">
                    {editingUser.role === 'ADMIN' ? '🛡️ ADMIN' : editingUser.role === 'AGENT' ? '👔 AGENT' : '👤 USER'}
                  </strong>
                  {' '}(เปลี่ยนสิทธิ์ได้ในตาราง)
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-bold shadow-md flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
