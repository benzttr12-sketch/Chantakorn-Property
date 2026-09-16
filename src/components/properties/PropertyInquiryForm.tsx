'use client';

import React, { useState } from 'react';
import { Property } from '@/lib/types';
import { Send, CheckCircle2, User, Phone, MessageCircle, FileText } from 'lucide-react';
import { submitInquiry } from '@/lib/store/properties-store';

interface PropertyInquiryFormProps {
  property: Property;
}

export default function PropertyInquiryForm({ property }: PropertyInquiryFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [message, setMessage] = useState(
    `สนใจทรัพย์ "${property.title}" รหัส ${property.id} ต้องการสอบถามรายละเอียดเพิ่มเติมครับ`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !phone.trim()) { setError('กรุณากรอกชื่อและเบอร์โทรศัพท์'); return; }

    setError('');
    setSubmitting(true);
    try {
      await submitInquiry({
        property_id: property.id,
        property_title: property.title,
        name: name.trim(),
        phone: phone.trim(),
        line_id: lineId,
        message,
        inquiry_type: 'inquiry',
        status: 'new',
      });
      setSuccess(true);
      setName('');
      setPhone('');
      setLineId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อโทร 081-604-0097');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="inquiry" className="scroll-mt-24 bg-white rounded-2xl p-6 border border-surface-border shadow-card">
      <div className="border-b border-gray-100 pb-4 mb-5">
        <h3 className="text-lg font-bold text-navy-950">สนใจทรัพย์นี้?</h3>
        <p className="text-xs text-brand-muted mt-1">
          กรอกข้อมูลด้านล่าง เจ้าหน้าที่จะติดต่อกลับเพื่อให้รายละเอียดโดยเร็วที่สุด
        </p>
      </div>

      {success ? (
        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-navy-950 text-base">ได้รับข้อมูลของคุณแล้ว</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            ทีมงาน Chantakorn Property จะติดต่อกลับตามเบอร์โทรศัพท์ที่ระบุไว้โดยเร็วที่สุดครับ
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-4 px-4 py-1.5 bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100"
          >
            ส่งข้อความเพิ่มเติม
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <MessageCircle className="w-3.5 h-3.5 mr-1 text-gold-600" />
              LINE ID (ถ้ามี)
            </label>
            <input
              type="text"
              placeholder="ไอดีไลน์ของคุณ เพื่อความสะดวกรวดเร็ว"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1 text-gold-600" />
              ข้อความ / คำถามเพิ่มเติม
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4 text-gold-400" />
            <span>{submitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลติดต่อ'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
