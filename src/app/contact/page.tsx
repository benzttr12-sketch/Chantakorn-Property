'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  MessageCircle, 
  Facebook, 
  Clock, 
  Send, 
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { submitInquiry } from '@/lib/store/properties-store';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [lineId, setLineId] = useState('');
  const [subject, setSubject] = useState('สนใจซื้ออสังหาริมทรัพย์');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !phone.trim()) { setError('กรุณากรอกชื่อและเบอร์โทรศัพท์'); return; }

    setError('');
    setSubmitting(true);
    try {
      await submitInquiry({
        name: name.trim(),
        phone: phone.trim(),
        line_id: lineId,
        message: `[หัวข้อ: ${subject}] (อีเมล: ${email || '-'}) ${message}`,
        inquiry_type: 'inquiry',
        status: 'new',
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อโทร 081-604-0097');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-bg min-h-screen pb-24">
      {/* Banner */}
      <div className="bg-navy-950 text-white py-16 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="inline-block text-xs font-bold text-gold-400 uppercase tracking-widest bg-navy-900 border border-gold-500/30 px-3.5 py-1 rounded-full mb-3">
            ติดต่อเรา
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
            CHANTAKORN PROPERTY
          </h1>
          <p className="text-gold-400 font-semibold text-lg mt-2">
            หาดใหญ่ – สงขลา
          </p>
          <p className="text-gray-300 text-sm sm:text-base mt-2">
            พร้อมตอบทุกคำถามและยินดีต้อนรับทุกท่าน นัดหมายปรึกษาหรือเยี่ยมชมสำนักงานได้ทุกวัน
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Contact Cards & Info (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick Contact Box */}
            <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-card space-y-5">
              <h3 className="text-lg font-bold text-navy-950 border-b border-gray-100 pb-3">
                ข้อมูลช่องทางการติดต่อ
              </h3>

              <div className="space-y-4 text-sm">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">ที่ตั้งสำนักงาน</span>
                    <span className="font-semibold text-navy-950 text-xs sm:text-sm">
                      สำนักงาน ฉันทากร พร็อพเพอร์ตี้ อำเภอหาดใหญ่ จังหวัดสงขลา 90110
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">เบอร์โทรศัพท์สายด่วน</span>
                    <a href="tel:0816040097" className="font-bold text-navy-950 text-base hover:text-gold-600">
                      081-604-0097
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#06C755] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">LINE Official Account</span>
                    <a
                      href="https://lin.ee/NMSe28T3"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-700 hover:underline"
                    >
                      LINE Official Account
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center flex-shrink-0">
                    <Facebook className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Facebook Page</span>
                    <a
                      href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-800 hover:underline text-sm leading-snug block"
                    >
                      Chantakorn Property นายหน้า บ้าน ที่ดิน คอนโด หาดใหญ่ สงขลา
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">อีเมล</span>
                    <a href="mailto:contact@chantakornproperty.com" className="font-semibold text-navy-950 hover:underline text-xs">
                      contact@chantakornproperty.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">วันและเวลาทำการ</span>
                    <span className="font-semibold text-navy-950 text-xs">
                      เปิดทำการทุกวัน: 08:30 – 18:00 น.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Embedded Office Map Location Preview */}
            <div className="bg-white rounded-2xl overflow-hidden border border-surface-border shadow-card p-4">
              <h4 className="text-xs font-bold text-navy-950 uppercase tracking-wider mb-2 flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-gold-600" />
                แผนที่สำนักงานหาดใหญ่ (OpenStreetMap Preview)
              </h4>
              <div className="relative h-48 w-full rounded-xl overflow-hidden bg-gray-200">
                <iframe
                  title="Chantakorn Property Hat Yai Location"
                  className="w-full h-full border-0"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=100.4500%2C7.0000%2C100.4900%2C7.0200&amp;layer=mapnik&amp;marker=7.0084%2C100.4705"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Contact Form (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-surface-border shadow-card">
              <h3 className="text-xl font-bold text-navy-950 mb-1">
                ส่งข้อความถึง Chantakorn Property
              </h3>
              <p className="text-xs text-brand-muted mb-6">
                กรอกรายละเอียดความต้องการของท่านด้านล่าง ทีมงานจะตอบกลับภายใน 24 ชั่วโมง
              </p>

              {submitted ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-bold text-navy-950">ส่งข้อความเรียบร้อยแล้ว</h4>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                    ขอบพระคุณที่ให้ความไว้วางใจ Chantakorn Property ทีมงานจะรีบติดต่อกลับตามข้อมูลที่ท่านได้ระบุไว้ครับ
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 px-5 py-2 bg-navy-950 text-gold-400 text-xs font-bold rounded-xl"
                  >
                    ส่งข้อความอื่นเพิ่มเติม
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        ชื่อ-นามสกุลของคุณ *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น คุณวิชัย รัตนศักดิ์"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        เบอร์โทรศัพท์ติดต่อ *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="081-xxx-xxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        LINE ID
                      </label>
                      <input
                        type="text"
                        placeholder="ไอดีไลน์ (ถ้ามี)"
                        value={lineId}
                        onChange={(e) => setLineId(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        อีเมล
                      </label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      เรื่องที่ต้องการติดต่อ *
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium cursor-pointer focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    >
                      <option value="สนใจซื้ออสังหาริมทรัพย์">สนใจซื้ออสังหาริมทรัพย์</option>
                      <option value="ต้องการเช่าบ้าน / คอนโด">ต้องการเช่าบ้าน / คอนโด</option>
                      <option value="ต้องการฝากขายบ้านหรือที่ดิน">ต้องการฝากขายบ้านหรือที่ดิน</option>
                      <option value="ปรึกษาเรื่องขายฝาก / จำนอง">ปรึกษาเรื่องขายฝาก / จำนอง</option>
                      <option value="ปรึกษาสินเชื่อและประเมินราคา">ปรึกษาสินเชื่อและประเมินราคา</option>
                      <option value="อื่น ๆ">อื่น ๆ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ข้อความ / รายละเอียดเพิ่มเติม *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="ระบุความต้องการ ทำเล งบประมาณ หรือข้อมูลที่ต้องการสอบถาม..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-gold-400" />
                    <span>{submitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อความติดต่อ'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
