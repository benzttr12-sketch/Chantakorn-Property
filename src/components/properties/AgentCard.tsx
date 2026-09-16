'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Agent, Property } from '@/lib/types';
import { DEFAULT_AGENT } from '@/data/agents';
import { 
  Phone, 
  MessageCircle, 
  Facebook, 
  Calendar, 
  ShieldCheck, 
  CheckCircle,
  X 
} from 'lucide-react';
import { submitInquiry } from '@/lib/store/properties-store';

interface AgentCardProps {
  agent?: Agent;
  property: Property;
}

export default function AgentCard({ agent = DEFAULT_AGENT, property }: AgentCardProps) {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [viewDate, setViewDate] = useState('');
  const [viewTime, setViewTime] = useState('10:00');
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleBookViewing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName || !visitorPhone) return;
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
    await submitInquiry({
      property_id: property.id,
      property_title: property.title,
      name: visitorName,
      phone: visitorPhone,
      message: `ขอนัดหมายเข้าชมทรัพย์ในวันที่ ${viewDate || 'เร็วที่สุด'} เวลา ${viewTime}`,
      inquiry_type: 'viewing',
      status: 'new'
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setScheduleModalOpen(false);
    }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอนัดหมายไม่สำเร็จ กรุณาติดต่อทางโทรศัพท์หรือ LINE');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-card space-y-5">
        {/* Agent Info Header */}
        <div className="flex items-center space-x-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gold-400 flex-shrink-0 bg-gray-100 shadow-sm">
            <Image
              src={agent.photo_url}
              alt={agent.name}
              fill
              className="object-cover"
            />
          </div>

          <div className="min-w-0 flex-grow">
            <div className="text-[11px] font-bold text-gold-600 uppercase tracking-wider">
              CHANTAKORN PROPERTY
            </div>
            <h4 className="text-base font-bold text-navy-950 truncate">
              {agent.name}
            </h4>
            <p className="text-xs text-brand-muted">
              {agent.title}
            </p>
          </div>
        </div>

        {/* Trust Statement */}
        <div className="p-3.5 bg-navy-50 rounded-xl border border-navy-100/80">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-gold-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-navy-900 leading-relaxed font-medium">
              &ldquo;สนใจทรัพย์นี้ ติดต่อเราได้เลย เราช่วยดูแลตั้งแต่การนัดชมทรัพย์ เจรจา ไปจนถึงขั้นตอนการโอนกรรมสิทธิ์&rdquo;
            </p>
          </div>
        </div>

        {/* Fast Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`tel:${agent.phone}`}
            className="py-2.5 px-3 bg-navy-950 hover:bg-navy-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
          >
            <Phone className="w-3.5 h-3.5 text-gold-400" />
            <span>โทร</span>
          </a>

          <a
            href="https://lin.ee/NMSe28T3"
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>LINE</span>
          </a>

          <a
            href={agent.facebook && agent.facebook.startsWith('http') ? agent.facebook : "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-3 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
          >
            <Facebook className="w-3.5 h-3.5 fill-current" />
            <span>Facebook</span>
          </a>
        </div>

        {/* Primary CTA: นัดหมายเข้าชม */}
        <button
          onClick={() => setScheduleModalOpen(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-sm rounded-xl shadow-md hover:shadow-gold-500/20 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5"
        >
          <Calendar className="w-4 h-4 text-navy-950" />
          <span>นัดหมายเข้าชมทรัพย์</span>
        </button>
      </div>

      {/* Appointment Scheduler Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-border relative animate-fadeIn">
            <button
              onClick={() => setScheduleModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg text-navy-950">ส่งคำขอนัดหมายเรียบร้อยแล้ว</h3>
                <p className="text-xs text-gray-500 mt-1">
                  ทีมงาน Chantakorn Property จะติดต่อกลับเพื่อยืนยันเวลากับท่านโดยเร็วที่สุด
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookViewing} className="space-y-4">
                {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{error} <a href={`tel:${agent.phone}`} className="font-bold underline">โทรหาทีมงาน</a> · <a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="font-bold underline">LINE</a></div>}
                <div>
                  <div className="text-xs font-bold text-gold-600 uppercase tracking-wider">
                    นัดชมสถานที่จริง
                  </div>
                  <h3 className="text-lg font-bold text-navy-950 mt-0.5">
                    นัดหมายเข้าชมทรัพย์
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {property.title}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น คุณสมชาย ใจดี"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-gold-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="เช่น 081-xxx-xxxx"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-gold-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      วันที่สะดวก
                    </label>
                    <input
                      type="date"
                      value={viewDate}
                      onChange={(e) => setViewDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-gold-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ช่วงเวลา
                    </label>
                    <select
                      value={viewTime}
                      onChange={(e) => setViewTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-gold-500 outline-none"
                    >
                      <option value="10:00">10:00 น.</option>
                      <option value="11:30">11:30 น.</option>
                      <option value="14:00">14:00 น.</option>
                      <option value="16:00">16:00 น.</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-xl font-bold text-sm shadow-md transition-all mt-2"
                >
                  {submitting ? 'กำลังส่งคำขอ...' : 'ยืนยันส่งคำขอนัดชมทรัพย์'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
