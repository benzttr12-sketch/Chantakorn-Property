'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Check, 
  X, 
  Phone, 
  MessageSquare, 
  MapPin, 
  Star, 
  Award, 
  ShieldCheck, 
  Sparkles,
  Save,
  UserCheck,
  UserPlus,
  ArrowRight,
  Search,
  CheckCircle2
} from 'lucide-react';
import { ExtendedAgent } from '@/data/agents';
import { getAgents, saveAgents, updateAgent, deleteAgent, resetAgentsToDefault } from '@/lib/store/agents-store';
import { fetchUsers } from '@/lib/store/properties-store';
import { UserProfile } from '@/lib/types';

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<ExtendedAgent[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingAgent, setEditingAgent] = useState<ExtendedAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Member selection helper
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberImportSuccess, setMemberImportSuccess] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    setAgents(getAgents());
    fetchUsers().then(setUsers).catch(() => {});

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setAgents(e.detail);
    };
    window.addEventListener('chantakorn_agents_updated', handleUpdate);
    return () => window.removeEventListener('chantakorn_agents_updated', handleUpdate);
  }, []);

  const handleEdit = (agent: ExtendedAgent) => {
    setIsCreating(false);
    setSelectedMemberId('');
    setMemberImportSuccess(null);
    setEditingAgent({ ...agent });
  };

  const handleCreateNew = () => {
    const newAgent: ExtendedAgent = {
      id: `agent-${Date.now()}`,
      name: '',
      rank: 'นายหน้า',
      title: 'ที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ',
      phone: '',
      line_id: '',
      facebook: '',
      email: '',
      photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
      bio: 'พร้อมให้คำปรึกษา แนะนำการซื้อ-ขาย-เช่า-ขายฝาก อสังหาริมทรัพย์ในหาดใหญ่และสงขลาอย่างมืออาชีพ',
      specialty: 'บ้านเดี่ยว, คอนโด, ทาวน์โฮม, ที่ดิน',
      zone: 'โซนหาดใหญ่ – สงขลา',
      experienceYears: 3,
      closedDeals: 15,
      rating: 5.0,
      languages: ['ไทย', 'English'],
    };
    setIsCreating(true);
    setSelectedMemberId('');
    setMemberImportSuccess(null);
    setEditingAgent(newAgent);
  };

  const handleSelectMemberToImport = (userId: string) => {
    setSelectedMemberId(userId);
    if (!userId) return;

    const member = users.find((u) => u.id === userId);
    if (!member) return;

    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        name: member.full_name,
        phone: member.phone || editingAgent.phone || '081-604-0097',
        email: member.email || editingAgent.email || '',
        line_id: member.line_id || editingAgent.line_id || '@chantakorn',
        facebook: member.facebook || editingAgent.facebook || '',
        photo_url: member.avatar_url || editingAgent.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
        rank: member.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า',
        title: member.role === 'ADMIN' ? 'ผู้บริหาร & หัวหน้าฝ่ายที่ปรึกษา' : 'ที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ',
        bio: member.bio || editingAgent.bio || 'พร้อมดูแลและให้คำปรึกษาด้านอสังหาริมทรัพย์อย่างจริงใจและตรงไปตรงมา',
      });
      setMemberImportSuccess(`ดึงข้อมูลสมาชิก "${member.full_name}" เรียบร้อยแล้ว`);
      setTimeout(() => setMemberImportSuccess(null), 4000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    if (!editingAgent.name.trim() || !editingAgent.phone.trim()) {
      alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    if (isCreating) {
      const updated = updateAgent(editingAgent.id, editingAgent);
      setAgents(updated);
      showNotification(`เพิ่ม "${editingAgent.name}" เป็นนายหน้าแนะนำสำเร็จ!`);
    } else {
      const updated = updateAgent(editingAgent.id, editingAgent);
      setAgents(updated);
      showNotification(`บันทึกการแก้ไขข้อมูลของ "${editingAgent.name}" สำเร็จ!`);
    }

    setEditingAgent(null);
    setIsCreating(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบนายหน้า "${name}" ออกจากระบบแนะนำ?`)) {
      const updated = deleteAgent(id);
      setAgents(updated);
      showNotification(`ลบข้อมูลนายหน้าเรียบร้อยแล้ว`);
    }
  };

  const handleReset = () => {
    if (confirm('คุณต้องการรีเซ็ตรายชื่อนายหน้าแนะนำกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      const def = resetAgentsToDefault();
      setAgents(def);
      showNotification('รีเซ็ตรายชื่อนายหน้าแนะนำเป็นค่าเริ่มต้นแล้ว');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs sm:text-sm font-bold animate-fadeIn">
          <Check className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold mb-2">
            <UserCheck className="w-3.5 h-3.5 text-gold-600" />
            <span>จัดการระบบนายหน้าแนะนำ (Featured Agents Management)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-950">
            ระบบนายหน้าแนะนำ & ที่ปรึกษาประจำพื้นที่
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เพิ่มนายหน้าใหม่โดยสามารถดึงข้อมูลจากสมาชิกในระบบได้ทันที และแก้ไขรายละเอียดที่แสดงบนหน้าแรก
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="รีเซ็ตเป็นค่าเริ่มต้น"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">รีเซ็ตค่าเริ่มต้น</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-gold-400" />
            <span>เพิ่มนายหน้าใหม่</span>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Agent Photo & Header */}
              <div className="relative h-56 w-full bg-slate-100">
                <Image
                  src={agent.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80'}
                  alt={agent.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/20 to-transparent" />
                
                <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full text-xs font-bold text-slate-800 flex items-center space-x-1 shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-mono">{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
                </div>

                <div className="absolute top-3 left-3 bg-navy-950/80 text-gold-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gold-400/40">
                  {agent.rank || 'นายหน้า'}
                </div>

                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <span className="text-[11px] font-medium text-gold-300 block">{agent.title}</span>
                  <h3 className="text-base font-black truncate">{agent.name}</h3>
                </div>
              </div>

              {/* Agent Details */}
              <div className="p-5 space-y-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-1">
                  <div className="flex items-center space-x-1 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-gold-600 shrink-0" />
                    <span className="font-bold">พื้นที่:</span>
                    <span className="text-navy-950 font-medium truncate">{agent.zone}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-700">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-bold">ความเชี่ยวชาญ:</span>
                    <span className="text-slate-600 truncate">{agent.specialty}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-slate-600">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-400">ปิดการขาย</span>
                    <strong className="text-navy-950 font-bold font-mono">{agent.closedDeals || 10}+ รายการ</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="block text-[10px] text-slate-400">ประสบการณ์</span>
                    <strong className="text-navy-950 font-bold font-mono">{agent.experienceYears || 3} ปี</strong>
                  </div>
                </div>

                <p className="text-slate-500 line-clamp-2 text-[11px] leading-relaxed">
                  {agent.bio}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-navy-900" />
                    <span className="font-mono font-medium">{agent.phone}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[#06C755]">
                    <MessageSquare className="w-3 h-3" />
                    <span>{agent.line_id || '@chantakorn'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleEdit(agent)}
                className="py-2.5 px-3 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูล</span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(agent.id, agent.name)}
                className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT / CREATE MODAL */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-black text-navy-950">
                  {isCreating ? 'เพิ่มนายหน้าแนะนำใหม่' : `แก้ไขข้อมูล: ${editingAgent.name || 'นายหน้า'}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {isCreating ? 'สามารถเลือกดึงข้อมูลจากสมาชิกที่มีอยู่ในระบบได้ทันที' : 'ปรับปรุงข้อมูลโปรไฟล์นายหน้าที่แสดงบนหน้าแรก'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* MEMBER SELECTION BOX (ดึงข้อมูลของสมาชิก) */}
              <div className="bg-gradient-to-r from-gold-50/80 to-amber-50/50 p-4 rounded-2xl border border-gold-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-navy-950 flex items-center space-x-1.5">
                    <UserPlus className="w-4 h-4 text-gold-600" />
                    <span>ดึงข้อมูลจากสมาชิกในระบบ (Import Member Data)</span>
                  </label>
                  <span className="text-[11px] text-gold-800 font-medium">
                    {users.length} สมาชิกในระบบ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-12">
                    <select
                      value={selectedMemberId}
                      onChange={(e) => handleSelectMemberToImport(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gold-300 rounded-xl text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 outline-none"
                    >
                      <option value="">-- เลือกสมาชิกเพื่อดึงข้อมูลอัตโนมัติ (คลิกเพื่อเลือก) --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          👤 {u.full_name} ({u.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : u.role === 'AGENT' ? 'นายหน้า' : 'สมาชิกทั่วไป'}) - {u.email || u.phone || 'ไม่มีอีเมล'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {memberImportSuccess && (
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{memberImportSuccess}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ชื่อ - นามสกุล (พร้อมชื่อเล่น) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="เช่น คุณฉันทากร นวลจันทร์ (เบนซ์)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ตำแหน่ง / ยศในระบบ
                  </label>
                  <select
                    value={editingAgent.rank || 'นายหน้า'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, rank: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  >
                    <option value="แอดมิน">แอดมิน (Admin / ผู้บริหาร)</option>
                    <option value="นายหน้า">นายหน้า (Agent / ที่ปรึกษา)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ชื่อตำแหน่งทางการ (Title)
                  </label>
                  <input
                    type="text"
                    value={editingAgent.title}
                    onChange={(e) => setEditingAgent({ ...editingAgent, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="เช่น กรรมการผู้จัดการ & หัวหน้าฝ่ายที่ปรึกษา"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    เบอร์โทรศัพท์ติดต่อ *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingAgent.phone}
                    onChange={(e) => setEditingAgent({ ...editingAgent, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="081-604-0097"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    LINE Official หรือ LINE ID
                  </label>
                  <input
                    type="text"
                    value={editingAgent.line_id}
                    onChange={(e) => setEditingAgent({ ...editingAgent, line_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="@chantakorn"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    อีเมลติดต่อ
                  </label>
                  <input
                    type="email"
                    value={editingAgent.email}
                    onChange={(e) => setEditingAgent({ ...editingAgent, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="contact@chantakornproperty.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    URL รูปโปรไฟล์ (Photo URL)
                  </label>
                  <input
                    type="url"
                    value={editingAgent.photo_url}
                    onChange={(e) => setEditingAgent({ ...editingAgent, photo_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="https://images.unsplash.com/photo-..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    พื้นที่รับผิดชอบ (Zone)
                  </label>
                  <input
                    type="text"
                    value={editingAgent.zone}
                    onChange={(e) => setEditingAgent({ ...editingAgent, zone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="เช่น โซน ม.อ. – คอหงส์ – ปุณณกัณฑ์"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ความเชี่ยวชาญเฉพาะทาง (Specialty)
                  </label>
                  <input
                    type="text"
                    value={editingAgent.specialty}
                    onChange={(e) => setEditingAgent({ ...editingAgent, specialty: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    placeholder="เช่น คอนโดปล่อยเช่า, บ้านเดี่ยว, ที่ดินจัดสรร"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ประสบการณ์ (ปี)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingAgent.experienceYears}
                      onChange={(e) => setEditingAgent({ ...editingAgent, experienceYears: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ปิดการขาย (รายการ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingAgent.closedDeals}
                      onChange={(e) => setEditingAgent({ ...editingAgent, closedDeals: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      คะแนนรีวิว (Rating)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={editingAgent.rating}
                      onChange={(e) => setEditingAgent({ ...editingAgent, rating: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ประวัติและคำแนะนำตัว (Bio)
                  </label>
                  <textarea
                    rows={3}
                    value={editingAgent.bio}
                    onChange={(e) => setEditingAgent({ ...editingAgent, bio: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none resize-none"
                    placeholder="เขียนแนะนำตัว ความเชี่ยวชาญ และความตั้งใจในการดูแลลูกค้า..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black shadow-md flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4 text-gold-400" />
                  <span>บันทึกข้อมูลนายหน้า</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
