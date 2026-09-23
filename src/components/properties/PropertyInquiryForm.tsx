'use client';

import React, { useState } from 'react';
import { Property } from '@/lib/types';
import { Send, CheckCircle2, User, Phone, MessageCircle, FileText, Calendar, Clock } from 'lucide-react';
import { submitInquiry } from '@/lib/store/properties-store';
import { formatPropertyCode } from '@/lib/utils';

interface PropertyInquiryFormProps {
  property: Property;
}

export default function PropertyInquiryForm({ property }: PropertyInquiryFormProps) {
  const [formMode, setFormMode] = useState<'inquiry' | 'booking'>('booking');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [timeSlot, setTimeSlot] = useState('รอบบ่าย (13:30 - 15:30 น.)');
  const [message, setMessage] = useState(
    `สนใจทรัพย์ "${property.title}" รหัส ${formatPropertyCode(property.id)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !phone.trim()) { 
      setError('กรุณากรอกชื่อและเบอร์โทรศัพท์'); 
      return; 
    }

    setError('');
    setSubmitting(true);
    try {
      const fullMessage = formMode === 'booking' 
        ? `[ขอนัดชมสถานที่จริง] วันที่: ${selectedDate} | ช่วงเวลา: ${timeSlot}\nข้อความ: ${message}`
        : message;

      await submitInquiry({
        property_id: property.id,
        property_title: property.title,
        name: name.trim(),
        phone: phone.trim(),
        line_id: lineId,
        message: fullMessage,
        inquiry_type: formMode === 'booking' ? 'viewing' : 'inquiry',
        status: 'new',
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อโทร 081-604-0097');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="inquiry" className="scroll-mt-24 bg-white rounded-3xl p-6 border border-surface-border shadow-card">
      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-5">
        <button
          type="button"
          onClick={() => setFormMode('booking')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            formMode === 'booking'
              ? 'bg-navy-950 text-gold-400 shadow-sm'
              : 'text-slate-600 hover:text-navy-950'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>นัดชมสถานที่จริง</span>
        </button>
        <button
          type="button"
          onClick={() => setFormMode('inquiry')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            formMode === 'inquiry'
              ? 'bg-navy-950 text-gold-400 shadow-sm'
              : 'text-slate-600 hover:text-navy-950'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>สอบถามข้อมูล</span>
        </button>
      </div>

      <div className="border-b border-gray-100 pb-3 mb-4">
        <h3 className="text-base font-black text-navy-950">
          {formMode === 'booking' ? 'จองคิวนัดชมทรัพย์นี้' : 'สนใจสอบถามรายละเอียด'}
        </h3>
        <p className="text-[11px] text-brand-muted mt-0.5">
          {formMode === 'booking' 
            ? 'เลือกวันและเวลาที่คุณสะดวก เจ้าหน้าที่จะติดต่อยืนยันคิวโดยเร็ว' 
            : 'กรอกข้อมูลด้านล่าง เจ้าหน้าที่จะติดต่อกลับเพื่อให้รายละเอียด'}
        </p>
      </div>

      {success ? (
        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <div>
            <h4 className="font-bold text-navy-950 text-sm">ได้รับข้อมูลเรียบร้อยแล้ว</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              เจ้าหน้าที่ผู้ดูแลทรัพย์จะติดต่อกลับที่เบอร์ <strong className="font-mono">{phone}</strong> เพื่อยืนยันนัดหมายครับ
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://line.me/R/ti/p/@chantakorn"
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-4 bg-[#06C755] text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center space-x-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>แชท LINE ยืนยันคิวด่วน</span>
            </a>
            <button
              onClick={() => setSuccess(false)}
              className="py-2 px-3 text-slate-500 hover:text-slate-800 text-[11px] font-medium"
            >
              ส่งคำขออื่นเพิ่มเติม
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}
          
          {/* Booking Date & Time Fields */}
          {formMode === 'booking' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gold-50/50 p-3 rounded-2xl border border-gold-200/60">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-gold-600" />
                  วันที่นัดชม *
                </label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-gold-600" />
                  ช่วงเวลา *
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-navy-950 font-medium focus:ring-2 focus:ring-gold-400 outline-none"
                >
                  <option value="รอบเช้า (09:30 - 11:30 น.)">รอบเช้า (09:30 - 11:30 น.)</option>
                  <option value="รอบบ่าย (13:30 - 15:30 น.)">รอบบ่าย (13:30 - 15:30 น.)</option>
                  <option value="รอบเย็น (16:00 - 18:00 น.)">รอบเย็น (16:00 - 18:00 น.)</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <User className="w-3.5 h-3.5 mr-1 text-gold-600" />
              ชื่อผู้ติดต่อ *
            </label>
            <input
              type="text"
              required
              placeholder="ชื่อ-นามสกุลของคุณ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <Phone className="w-3.5 h-3.5 mr-1 text-gold-600" />
              เบอร์โทรศัพท์ *
            </label>
            <input
              type="tel"
              required
              placeholder="081-xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-gold-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <MessageCircle className="w-3.5 h-3.5 mr-1 text-gold-600" />
              LINE ID (ถ้ามี)
            </label>
            <input
              type="text"
              placeholder="ไอดีไลน์ของคุณ"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1 text-gold-600" />
              หมายเหตุเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-400 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-navy-950 to-navy-900 hover:from-navy-900 hover:to-navy-800 text-gold-400 font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4 text-gold-400" />
            <span>
              {submitting 
                ? 'กำลังส่งข้อมูล...' 
                : formMode === 'booking' 
                  ? 'ยืนยันจองคิวนัดชมทรัพย์' 
                  : 'ส่งข้อความติดต่อ'}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
