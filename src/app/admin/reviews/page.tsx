'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Star, 
  MessageSquare, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Check, 
  X, 
  ShieldCheck, 
  UserCheck, 
  Save, 
  Search,
  Quote,
  Sparkles
} from 'lucide-react';
import { Review, getReviews, addReview, updateReview, deleteReview, resetReviewsToDefault } from '@/lib/store/reviews-store';
import { getAgents } from '@/lib/store/agents-store';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [agents, setAgents] = useState<{ name: string }[]>([]);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    setReviews(getReviews());
    setAgents(getAgents());

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setReviews(e.detail);
    };
    window.addEventListener('chantakorn_reviews_updated', handleUpdate);
    return () => window.removeEventListener('chantakorn_reviews_updated', handleUpdate);
  }, []);

  const handleCreateNew = () => {
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      customerName: 'คุณลูกค้าคนใหม่',
      customerRole: 'ผู้ซื้อบ้านเดี่ยว หาดใหญ่',
      propertyTitleOrZone: 'บ้านเดี่ยว โซน ม.อ. – ปุณณกัณฑ์',
      agentName: agents[0]?.name || 'คุณฉันทากร (เบนซ์)',
      rating: 5,
      comment: 'บริการประทับใจมากครับ ทีมงานดูแลอย่างมืออาชีพและตรงไปตรงมา',
      date: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      verifiedBuyer: true,
      serviceType: 'buy',
    };
    setIsCreating(true);
    setEditingReview(newRev);
  };

  const handleEdit = (rev: Review) => {
    setIsCreating(false);
    setEditingReview({ ...rev });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    if (!editingReview.customerName.trim() || !editingReview.comment.trim()) {
      alert('กรุณากรอกชื่อและข้อความรีวิว');
      return;
    }

    if (isCreating) {
      const updated = addReview(editingReview);
      setReviews(updated);
      showNotification('เพิ่มรีวิวใหม่เรียบร้อยแล้ว!');
    } else {
      const updated = updateReview(editingReview.id, editingReview);
      setReviews(updated);
      showNotification('บันทึกการแก้ไขรีวิวเรียบร้อยแล้ว!');
    }

    setEditingReview(null);
    setIsCreating(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวของ "${name}"?`)) {
      const updated = deleteReview(id);
      setReviews(updated);
      showNotification('ลบรีวิวเรียบร้อยแล้ว');
    }
  };

  const handleReset = () => {
    if (confirm('คุณต้องการรีเซ็ตรายการรีวิวกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      const def = resetReviewsToDefault();
      setReviews(def);
      showNotification('รีเซ็ตรายการรีวิวกลับเป็นค่าเริ่มต้นแล้ว');
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q) ||
      r.propertyTitleOrZone.toLowerCase().includes(q) ||
      r.agentName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Toast */}
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
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            <span>จัดการรีวิวและความประทับใจ (Client Reviews Management)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-950">
            ระบบจัดการรีวิวจากลูกค้าจริง
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เพิ่ม แก้ไข ลบ หรือตรวจสอบเสียงตอบรับและความประทับใจของลูกค้าที่แสดงบนหน้าแรก
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="รีเซ็ตค่าเริ่มต้น"
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
            <span>เพิ่มรีวิวใหม่</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="ค้นหารีวิวจากชื่อลูกค้า, ข้อความ, ทำเล, หรือชื่อนายหน้า..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs sm:text-sm outline-none text-navy-950"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-700">
            ล้างคำค้น
          </button>
        )}
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReviews.map((rev) => (
          <div
            key={rev.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < rev.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold font-mono ml-1 text-slate-700">{rev.rating}.0</span>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gold-50 text-gold-800 border border-gold-200">
                  {rev.serviceType === 'buy' ? 'ซื้อสำเร็จ' : rev.serviceType === 'sell' ? 'ฝากขาย' : rev.serviceType === 'rent' ? 'เช่า' : 'ขายฝาก'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-slate-50 p-3 rounded-2xl border border-slate-100">
                &ldquo;{rev.comment}&rdquo;
              </p>

              <div className="space-y-1 text-xs text-slate-500">
                <div className="truncate">
                  📍 <strong className="text-navy-950">{rev.propertyTitleOrZone}</strong>
                </div>
                <div>
                  👤 นายหน้าที่ดูแล: <strong className="text-gold-600">{rev.agentName}</strong>
                </div>
              </div>
            </div>

            {/* Bottom Profile & Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-slate-300">
                  <Image
                    src={rev.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                    alt={rev.customerName}
                    fill
                    sizes="36px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-navy-950 truncate">
                    {rev.customerName}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">
                    {rev.customerRole} • {rev.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(rev)}
                  className="p-2 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs transition-colors cursor-pointer"
                  title="แก้ไขรีวิว"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rev.id, rev.customerName)}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition-colors cursor-pointer"
                  title="ลบรีวิว"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT / CREATE MODAL */}
      {editingReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-navy-950">
                  {isCreating ? 'เพิ่มรีวิวใหม่' : `แก้ไขรีวิว: ${editingReview.customerName}`}
                </h3>
                <p className="text-xs text-slate-500">
                  กรอกข้อมูลรีวิวที่จะแสดงบนหน้าแรกของเว็บไซต์
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingReview(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Rating */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  คะแนนความพึงพอใจ (Rating)
                </label>
                <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditingReview({ ...editingReview, rating: star })}
                      className="p-1 cursor-pointer transition-transform hover:scale-125"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= editingReview.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold font-mono text-navy-950 ml-2">
                    {editingReview.rating}.0 ดาว
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ประเภทการบริการ
                  </label>
                  <select
                    value={editingReview.serviceType}
                    onChange={(e) => setEditingReview({ ...editingReview, serviceType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  >
                    <option value="buy">ซื้ออสังหาริมทรัพย์</option>
                    <option value="sell">ฝากขายอสังหาริมทรัพย์</option>
                    <option value="rent">เช่า / ปล่อยเช่า</option>
                    <option value="consignment">ขายฝากถูกกฎหมาย</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    นายหน้าที่ดูแล
                  </label>
                  <select
                    value={editingReview.agentName}
                    onChange={(e) => setEditingReview({ ...editingReview, agentName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  >
                    {agents.map((a, i) => (
                      <option key={i} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ชื่อลูกค้า *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingReview.customerName}
                    onChange={(e) => setEditingReview({ ...editingReview, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    อาชีพ / ข้อมูลตำแหน่ง
                  </label>
                  <input
                    type="text"
                    value={editingReview.customerRole}
                    onChange={(e) => setEditingReview({ ...editingReview, customerRole: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  ทรัพย์ที่ใช้บริการ / ทำเล
                </label>
                <input
                  type="text"
                  value={editingReview.propertyTitleOrZone}
                  onChange={(e) => setEditingReview({ ...editingReview, propertyTitleOrZone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  ข้อความรีวิว *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingReview.comment}
                  onChange={(e) => setEditingReview({ ...editingReview, comment: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  URL รูปโปรไฟล์
                </label>
                <input
                  type="url"
                  value={editingReview.avatarUrl}
                  onChange={(e) => setEditingReview({ ...editingReview, avatarUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-gold-400" />
                  <span>{isCreating ? 'บันทึกรีวิว' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
