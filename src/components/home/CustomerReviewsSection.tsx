'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  Star, 
  MessageSquare, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  X, 
  Quote, 
  Save,
  Sparkles
} from 'lucide-react';
import { Review, getReviews, addReview, updateReview, deleteReview } from '@/lib/store/reviews-store';
import { getAgents } from '@/lib/store/agents-store';

export default function CustomerReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [agents, setAgents] = useState<{ name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerRole, setCustomerRole] = useState('');
  const [propertyTitleOrZone, setPropertyTitleOrZone] = useState('');
  const [agentName, setAgentName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [serviceType, setServiceType] = useState<'buy' | 'sell' | 'rent' | 'consignment'>('buy');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
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

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      checkScroll();
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [reviews]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 360;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleOpenNewModal = () => {
    setIsNew(true);
    setEditingReview(null);
    setCustomerName('');
    setCustomerRole('ผู้ซื้อบ้านเดี่ยว โซนหาดใหญ่');
    setPropertyTitleOrZone('บ้านเดี่ยว โซน ม.อ. – คอหงส์');
    setAgentName(agents[0]?.name || 'คุณฉันทากร (เบนซ์)');
    setRating(5);
    setComment('');
    setServiceType('buy');
    setAvatarUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rev: Review) => {
    setIsNew(false);
    setEditingReview(rev);
    setCustomerName(rev.customerName);
    setCustomerRole(rev.customerRole);
    setPropertyTitleOrZone(rev.propertyTitleOrZone);
    setAgentName(rev.agentName);
    setRating(rev.rating);
    setComment(rev.comment);
    setServiceType(rev.serviceType);
    setAvatarUrl(rev.avatarUrl || '');
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`ต้องการลบรีวิวของคุณ "${name}" หรือไม่?`)) {
      const updated = deleteReview(id);
      setReviews(updated);
      showToast('ลบรีวิวเรียบร้อยแล้ว');
    }
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !comment.trim()) {
      alert('กรุณากรอกชื่อและข้อความรีวิว');
      return;
    }

    if (isNew) {
      const updated = addReview({
        customerName: customerName.trim(),
        customerRole: customerRole.trim() || 'ลูกค้าผู้ใช้บริการจริง',
        propertyTitleOrZone: propertyTitleOrZone.trim() || 'อสังหาฯ หาดใหญ่–สงขลา',
        agentName: agentName || 'คุณฉันทากร (เบนซ์)',
        rating,
        comment: comment.trim(),
        serviceType,
        avatarUrl: avatarUrl.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        verifiedBuyer: true,
      });
      setReviews(updated);
      showToast('เพิ่มรีวิวความประทับใจเรียบร้อยแล้ว!');
    } else if (editingReview) {
      const updated = updateReview(editingReview.id, {
        customerName: customerName.trim(),
        customerRole: customerRole.trim(),
        propertyTitleOrZone: propertyTitleOrZone.trim(),
        agentName,
        rating,
        comment: comment.trim(),
        serviceType,
        avatarUrl: avatarUrl.trim(),
      });
      setReviews(updated);
      showToast('แก้ไขรีวิวเรียบร้อยแล้ว!');
    }

    setIsModalOpen(false);
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'buy': return 'ซื้อสำเร็จ';
      case 'sell': return 'ฝากขายสำเร็จ';
      case 'rent': return 'เช่า/ปล่อยเช่า';
      case 'consignment': return 'ขายฝากถูกต้อง';
      default: return 'ผู้ใช้บริการจริง';
    }
  };

  return (
    <section className="py-14 md:py-20 bg-white border-b border-slate-200 overflow-hidden relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs sm:text-sm font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" />
              <span>เสียงตอบรับจากลูกค้าจริง (Real Client Testimonials)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-navy-950 tracking-tight">
              ความประทับใจจากลูกค้า Chantakorn Property
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              การันตีความจริงใจและผลงานการดูแลลูกค้าทุกท่านในพื้นที่หาดใหญ่และสงขลา
            </p>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-4 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black rounded-xl shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-gold-400" />
              <span>เขียนรีวิวใหม่</span>
            </button>

            {/* Slider Arrows */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous Reviews"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next Reviews"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Horizontal Slider */}
        <div
          ref={scrollRef}
          className="flex space-x-5 overflow-x-auto pb-6 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="w-[300px] sm:w-[350px] shrink-0 snap-start bg-slate-50/80 hover:bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-gold-400/80 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between relative group"
            >
              <div className="space-y-4">
                {/* Header: Rating & Verified Badge */}
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
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{getServiceLabel(rev.serviceType)}</span>
                  </span>
                </div>

                {/* Testimonial Quote */}
                <div className="relative">
                  <Quote className="w-6 h-6 text-gold-400/30 absolute -top-2 -left-1 stroke-none fill-gold-400/30" />
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed relative z-10 pt-1">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>

                {/* Property / Zone Tag */}
                <div className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200/60 truncate">
                  📍 <strong className="text-navy-950 font-medium">{rev.propertyTitleOrZone}</strong>
                </div>
              </div>

              {/* Footer: Customer Profile & Admin Actions */}
              <div className="pt-4 mt-4 border-t border-slate-200/70 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-gold-300">
                    <Image
                      src={rev.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                      alt={rev.customerName}
                      fill
                      sizes="40px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-black text-navy-950 truncate">
                      {rev.customerName}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate">
                      {rev.customerRole}
                    </p>
                  </div>
                </div>

                {/* Quick Edit/Delete Actions */}
                <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(rev)}
                    className="p-1.5 text-slate-400 hover:text-navy-950 rounded-lg hover:bg-slate-200/60 transition-colors"
                    title="แก้ไขรีวิวนี้"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rev.id, rev.customerName)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="ลบรีวิวนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EDIT / CREATE REVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-navy-950">
                  {isNew ? 'เขียนรีวิวความประทับใจ' : 'แก้ไขข้อความรีวิว'}
                </h3>
                <p className="text-xs text-slate-500">
                  ข้อมูลจะแสดงบนหน้าแรกและหน้ารีวิวของเว็บไซต์
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveReview} className="space-y-4">
              {/* Rating Selector */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5">
                  ระดับความพึงพอใจ (Rating)
                </label>
                <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-125"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-navy-950 ml-2">
                    {rating === 5 ? '⭐⭐⭐⭐⭐ ยอดเยี่ยมมาก' : `${rating} ดาว`}
                  </span>
                </div>
              </div>

              {/* Service Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ประเภทการบริการ
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
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
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
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

              {/* Customer Name & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    ชื่อลูกค้า *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น คุณสมชาย สุขเกษม"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    อาชีพ / สถานะ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น แพทย์ประจำหาดใหญ่"
                    value={customerRole}
                    onChange={(e) => setCustomerRole(e.target.value)}
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
                  placeholder="เช่น บ้านเดี่ยว นวลจันทร์การ์เดนท์ สนามบิน"
                  value={propertyTitleOrZone}
                  onChange={(e) => setPropertyTitleOrZone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  ข้อความรีวิวความประทับใจ *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="เล่าความประทับใจในการใช้บริการกับทีมงาน Chantakorn Property..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none resize-none"
                />
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  URL รูปโปรไฟล์
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-black shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-gold-400" />
                  <span>{isNew ? 'บันทึกรีวิว' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
