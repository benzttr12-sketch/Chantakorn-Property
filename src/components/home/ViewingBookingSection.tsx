'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MessageSquare, 
  MapPin, 
  CheckCircle2, 
  ShieldCheck, 
  Home, 
  Sparkles,
  Send,
  CalendarCheck,
  Building,
  RotateCcw
} from 'lucide-react';
import { ExtendedAgent } from '@/data/agents';
import { getAgents, fetchAgents } from '@/lib/store/agents-store';
import { fetchProperties, fetchUsers } from '@/lib/store/properties-store';
import { Property } from '@/lib/types';

interface ViewingBookingSectionProps {
  initialAgent?: string;
  initialPropertyTitle?: string;
}

export default function ViewingBookingSection({ initialAgent, initialPropertyTitle }: ViewingBookingSectionProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [agents, setAgents] = useState<ExtendedAgent[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>(initialPropertyTitle || 'custom');
  const [customPropertyDesc, setCustomPropertyDesc] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('afternoon');
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgent || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerLine, setCustomerLine] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    const loadedAgents = getAgents();
    setAgents(loadedAgents);
    setSelectedAgent(prev => prev || (loadedAgents.length > 0 ? loadedAgents[0].name : ''));

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setAgents(e.detail);
      }
    };
    window.addEventListener('chantakorn_agents_updated', handleUpdate);

    async function loadProps() {
      try {
        const [cloudAgents, cloudUsers, list] = await Promise.all([
          fetchAgents().catch(() => getAgents()),
          fetchUsers().catch(() => []),
          fetchProperties().catch(() => [])
        ]);
        const finalAgents = cloudAgents && cloudAgents.length > 0 ? cloudAgents : getAgents();
        setAgents(finalAgents);
        if (finalAgents.length > 0) {
          setSelectedAgent(prev => prev || finalAgents[0].name);
        }
        setProperties(list.slice(0, 15));
      } catch {
        // Fallback
      }
    }
    loadProps();

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);

    return () => window.removeEventListener('chantakorn_agents_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (initialAgent) {
      setSelectedAgent(initialAgent);
    }
  }, [initialAgent]);

  useEffect(() => {
    if (initialPropertyTitle) {
      setSelectedProperty(initialPropertyTitle);
    }
  }, [initialPropertyTitle]);

  const timeSlots = [
    { id: 'morning', label: 'รอบเช้า', time: '09:30 – 11:30 น.', icon: '🌅', desc: 'แดดอ่อน บรรยากาศสบาย' },
    { id: 'afternoon', label: 'รอบบ่าย', time: '13:30 – 15:30 น.', icon: '☀️', desc: 'ดูทิศทางแดดและแสงธรรมชาติ' },
    { id: 'evening', label: 'รอบเย็น', time: '16:00 – 18:00 น.', icon: '🌇', desc: 'ดูบรรยากาศเพื่อนบ้านช่วงค่ำ' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedDate) {
      alert('กรุณากรอกชื่อ เบอร์โทรศัพท์ และเลือกวันนัดหมายให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);

    // Simulate saving appointment
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 800);
  };

  const handleReset = () => {
    setIsSuccess(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerLine('');
    setNotes('');
  };

  return (
    <section id="booking-section" className="py-16 md:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b border-slate-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold mb-3">
            <CalendarCheck className="w-3.5 h-3.5 text-gold-600" />
            <span>นัดชมสถานที่จริง (VIP Private Property Tour)</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-navy-950 tracking-tight">
            ระบบจองคิวนัดชมทรัพย์ล่วงหน้า
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-2">
            เลือกวันและเวลาที่คุณสะดวก ทีมงาน Chantakorn Property พร้อมพาชมบ้าน ตรวจสอบทำเล และให้ข้อมูลเชิงลึกฟรี ไม่มีค่าใช้จ่าย
          </p>
        </div>

        {/* Main Booking Container */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          {isSuccess ? (
            /* SUCCESS CONFIRMATION VIEW */
            <div className="p-8 sm:p-12 text-center space-y-6 animate-fadeIn">
              <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 shadow-lg animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  ส่งคำขอนัดหมายสำเร็จแล้ว
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-navy-950">
                  ขอบคุณครับคุณ {customerName}
                </h3>
                <p className="text-slate-600 text-sm max-w-lg mx-auto">
                  ทีมงานได้รับข้อมูลการนัดชมทรัพย์แล้ว เจ้าหน้าที่ <strong>({selectedAgent || 'ทีมงาน Chantakorn'})</strong> จะติดต่อกลับเพื่อยืนยันพิกัดและเวลาภายใน 15-30 นาทีครับ
                </p>
              </div>

              {/* Summary Card */}
              <div className="max-w-md mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">ทรัพย์ที่ต้องการชม:</span>
                  <span className="font-bold text-navy-950 text-right truncate max-w-[200px]">
                    {selectedProperty === 'custom' ? (customPropertyDesc || 'นัดชมหลายหลังตามทำเล') : selectedProperty}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">วันและเวลานัดหมาย:</span>
                  <span className="font-bold text-navy-950">
                    {selectedDate} ({timeSlots.find(t => t.id === selectedTimeSlot)?.time})
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">นายหน้าที่ปรึกษา:</span>
                  <span className="font-bold text-gold-600">{selectedAgent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">เบอร์โทรติดต่อ:</span>
                  <span className="font-bold font-mono text-navy-950">{customerPhone}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <a
                  href="https://line.me/R/ti/p/@chantakorn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>ยืนยันคิวนัดผ่าน LINE ด่วน</span>
                </a>

                <a
                  href="tel:0816040097"
                  className="px-6 py-3.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  <span>โทรสายด่วน 081-604-0097</span>
                </a>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  นัดหมายรายการอื่นเพิ่ม
                </button>
              </div>
            </div>
          ) : (
            /* BOOKING FORM */
            <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
              {/* STEP 1: SELECT PROPERTY */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-navy-950 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-950 flex items-center justify-center text-xs font-black">1</span>
                  <span>เลือกทรัพย์ที่ต้องการนัดชม หรือระบุความต้องการ</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                  >
                    <option value="custom">-- นัดหมายพาชมหลายหลัง / ให้แนะนำตามงบประมาณ --</option>
                    {properties.map((p) => {
                      const typeLabel = 
                        p.property_type === 'house' ? 'บ้าน' :
                        p.property_type === 'condo' ? 'คอนโด' :
                        p.property_type === 'land' ? 'ที่ดิน' :
                        p.property_type === 'commercial' ? 'อาคารพาณิชย์' : 'อสังหาฯ';
                      return (
                        <option key={p.id} value={p.title}>
                          [{typeLabel}] {p.title} - ฿{(p.price / 1000000).toFixed(2)}M
                        </option>
                      );
                    })}
                  </select>

                  {selectedProperty === 'custom' && (
                    <input
                      type="text"
                      placeholder="เช่น สนใจบ้านเดี่ยวโซน ม.อ. หรือสนามบิน งบ 3-5 ล้าน"
                      value={customPropertyDesc}
                      onChange={(e) => setCustomPropertyDesc(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* STEP 2: SELECT DATE & TIME SLOT */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-navy-950 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-950 flex items-center justify-center text-xs font-black">2</span>
                  <span>เลือกวันและช่วงเวลาที่สะดวก</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-4">
                    <span className="text-xs text-slate-500 font-medium block mb-1.5">วันที่สะดวกนัดหมาย:</span>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <span className="text-xs text-slate-500 font-medium block mb-1.5">ช่วงเวลาที่สะดวก:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTimeSlot === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot.id)}
                            className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-navy-950 text-white border-navy-950 shadow-md ring-2 ring-gold-400/40'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center space-x-1">
                              <span className="text-sm">{slot.icon}</span>
                              <span className={`text-xs font-bold ${isSelected ? 'text-gold-300' : 'text-navy-950'}`}>
                                {slot.label}
                              </span>
                            </div>
                            <span className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {slot.time}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3: SELECT SPECIALIST AGENT */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-navy-950 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-950 flex items-center justify-center text-xs font-black">3</span>
                  <span>เลือกนายหน้าที่ปรึกษาที่ต้องการให้ดูแล</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {agents.map((agent) => {
                    const isSelected = selectedAgent === agent.name;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setSelectedAgent(agent.name)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
                          isSelected
                            ? 'bg-gold-50/80 border-gold-400 shadow-md ring-1 ring-gold-400'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 border border-slate-300">
                          <Image
                            src={agent.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80'}
                            alt={agent.name}
                            fill
                            sizes="44px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="overflow-hidden">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-navy-950' : 'text-slate-800'}`}>
                            {agent.name.split(' ')[0]} {agent.name.split(' ')[1] || ''}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {agent.zone}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 4: CONTACT INFORMATION */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="block text-sm font-bold text-navy-950 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-950 flex items-center justify-center text-xs font-black">4</span>
                  <span>ข้อมูลผู้ติดต่อเพื่อนัดหมาย</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">ชื่อ - นามสกุล *</span>
                    <input
                      type="text"
                      required
                      placeholder="เช่น คุณสมชาย สุขเกษม"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">เบอร์โทรศัพท์ติดต่อ *</span>
                    <input
                      type="tel"
                      required
                      placeholder="เช่น 081-234-5678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 font-mono focus:ring-2 focus:ring-gold-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">LINE ID (ถ้ามี)</span>
                    <input
                      type="text"
                      placeholder="เช่น somchai_line"
                      value={customerLine}
                      onChange={(e) => setCustomerLine(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 font-medium block mb-1">ข้อความเพิ่มเติม / จุดนัดพบ</span>
                  <input
                    type="text"
                    placeholder="เช่น สะดวกเริ่มเดินทางจากเซ็นทรัลหาดใหญ่ หรือต้องการสอบถามเรื่องการขอสินเชื่อธนาคารด้วย"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-navy-950 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>บริการนัดชมฟรี ไม่มีค่าใช้จ่ายล่วงหน้า ข้อมูลเป็นความลับ 100%</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-gradient-to-r from-gold-400 via-amber-500 to-gold-400 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-sm sm:text-base rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>กำลังบันทึกการนัดหมาย...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-navy-950 stroke-[2.5]" />
                      <span>ยืนยันการจองคิวนัดชมทรัพย์</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
