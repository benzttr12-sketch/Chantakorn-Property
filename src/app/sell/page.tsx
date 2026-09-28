'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  Upload, 
  CheckCircle2, 
  Home, 
  Phone, 
  User, 
  MessageCircle, 
  FileText, 
  ShieldCheck, 
  Coins, 
  Maximize, 
  MapPin, 
  X,
  Sparkles
} from 'lucide-react';
import { submitInquiry } from '@/lib/store/properties-store';
import { DISTRICTS_LIST } from '@/data/locations';
import AutoPinLandsMapsValuation from '@/components/landsmaps/AutoPinLandsMapsValuation';

export default function SellPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [propertyType, setPropertyType] = useState('house');
  const [province] = useState('สงขลา');
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [landSize, setLandSize] = useState('');
  const [usableArea, setUsableArea] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length || uploading) return;
    if (uploadedPhotos.length + files.length > 15 || files.some(file => !file.type.startsWith('image/') || file.size > 50 * 1024 * 1024)) {
      setError('แนบรูปภาพได้สูงสุด 15 รูป รูปละไม่เกิน 50 MB (รองรับภาพถ่ายความละเอียดสูงจากมือถือ)');
      input.value = '';
      return;
    }
    setUploading(true); setError('');
    try {
      const photos = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('อ่านรูปภาพไม่สำเร็จ กรุณาเลือกไฟล์ใหม่'));
        reader.onload = () => {
          const image = new window.Image();
          image.onerror = () => reject(new Error('ไม่รองรับรูปภาพนี้ กรุณาใช้ไฟล์ JPG, PNG หรือ WebP'));
          image.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            if (!context) { reject(new Error('ไม่สามารถเตรียมรูปภาพได้')); return; }
            context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            let quality = 0.85;
            let photo = canvas.toDataURL('image/jpeg', quality);
            while (photo.length > 450000 && quality > 0.25) { quality -= 0.1; photo = canvas.toDataURL('image/jpeg', quality); }
            resolve(photo);
          };
          image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      })));
      setUploadedPhotos(current => [...current, ...photos]);
    } catch (err) { setError(err instanceof Error ? err.message : 'เตรียมรูปภาพไม่สำเร็จ'); }
    finally { setUploading(false); input.value = ''; }
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Real-time validation & progress calculation for Sell form
  const sellValidationItems = [
    { label: 'ชื่อผู้ติดต่อ', done: Boolean(name.trim().length >= 2) },
    { label: 'เบอร์โทรศัพท์', done: Boolean(phone.trim().length >= 9) },
    { label: 'ราคาที่ต้องการ', done: Boolean(expectedPrice && Number(expectedPrice) > 0) },
    { label: 'ทำเลอำเภอ', done: Boolean(district) },
    { label: 'รูปภาพทรัพย์', done: uploadedPhotos.length > 0 },
    { label: 'รายละเอียด', done: description.trim().length >= 10 },
  ];
  const sellPassedCount = sellValidationItems.filter(i => i.done).length;
  const sellPercentage = Math.round((sellPassedCount / sellValidationItems.length) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || uploading) return;
    if (!name.trim() || !phone.trim() || Number(expectedPrice) <= 0) { setError('กรุณากรอกชื่อ เบอร์โทรศัพท์ และราคาที่ต้องการให้ถูกต้อง'); return; }

    setError('');
    setSubmitting(true);
    try {
      await submitInquiry({
        name: name.trim(),
        phone: phone.trim(),
        line_id: lineId,
        message: `ฝากขายทรัพย์ประเภท ${propertyType} ใน ${district} จ.${province} ราคาที่ต้องการ ${expectedPrice} บาท\nรายละเอียด: ${description}`,
        inquiry_type: 'consignment_sell',
        status: 'new',
        consignment_details: {
          property_type: propertyType,
          province,
          district,
          subdistrict,
          expected_price: Number(expectedPrice),
          land_size: landSize ? Number(landSize) : undefined,
          usable_area: usableArea ? Number(usableArea) : undefined,
          photos_count: uploadedPhotos.length,
          photos: uploadedPhotos,
        },
      });

      // Send alert to LINE Official Account
      fetch('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiry_type: 'consignment_sell',
          name: name.trim(),
          phone: phone.trim(),
          line_id: lineId,
          message: `ฝากขายทรัพย์ประเภท ${propertyType} ใน ${district} จ.${province} ราคาที่ต้องการ ${expectedPrice} บาท\nรายละเอียด: ${description}`,
          consignment_details: {
            property_type: propertyType,
            province,
            district,
            subdistrict,
            expected_price: Number(expectedPrice),
          }
        })
      }).catch(() => undefined);

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อโทร 081-604-0097');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-bg min-h-screen pb-24">
      {/* Hero Section */}
      <div className="bg-navy-950 text-white py-16 lg:py-20 border-b border-navy-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#C9A227_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-navy-900 border border-gold-500/30 text-gold-400 text-xs font-semibold mb-4">
            <Building2 className="w-3.5 h-3.5 text-gold-400" />
            <span>บริการรับฝากขายอสังหาริมทรัพย์ หาดใหญ่–สงขลา</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            ส่งมอบคุณค่าแห่งอสังหาริมทรัพย์ของคุณ <br className="hidden sm:inline" />
            <span className="text-gold-400">สู่มือผู้ซื้อที่มีศักยภาพสูงสุด</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            ไว้วางใจให้ <strong className="text-gold-400 font-semibold">Chantakorn Property</strong> ดูแลอสังหาริมทรัพย์อันทรงคุณค่าของคุณ พร้อมกลยุทธ์การตลาดเจาะกลุ่มผู้ซื้อตัวจริง การวิเคราะห์ราคาตลาด และการดูแลเอกสารสิทธิ์จนถึงวันส่งมอบกรรมสิทธิ์
          </p>

          <div className="mt-8 flex justify-center">
            <a
              href="#consignment-form"
              className="px-8 py-3.5 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all"
            >
              เริ่มต้นฝากทรัพย์กับเรา
            </a>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div id="consignment-form" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-surface-border shadow-xl">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
                ได้รับข้อมูลของคุณแล้ว
              </h2>
              <p className="text-base text-gray-600 max-w-lg mx-auto leading-relaxed">
                ทีมงาน <strong className="text-navy-950">Chantakorn Property</strong> จะติดต่อกลับโดยเร็วที่สุดเพื่อยืนยันข้อมูล นัดหมายลงพื้นที่ถ่ายภาพ และเริ่มแผนการตลาดครับ
              </p>
              <div className="pt-6">
                <a
                  href="https://lin.ee/NMSe28T3"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-sm rounded-xl shadow-md transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>แจ้งข้อมูลด่วนทาง LINE Official Account</span>
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

              {/* Real-time Progress Bar Banner */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 rounded-2xl text-white space-y-3 shadow-md border border-navy-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-gold-400" />
                    <span className="text-xs font-bold text-slate-200">ความคืบหน้าการกรอกข้อมูลทรัพย์</span>
                  </div>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/15 text-gold-300 font-mono">
                    {sellPercentage}%
                  </span>
                </div>

                <div className="w-full bg-navy-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sellPercentage === 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : sellPercentage >= 60
                        ? 'bg-gradient-to-r from-gold-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-gold-400'
                    }`}
                    style={{ width: `${sellPercentage}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {sellValidationItems.map((item, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium transition-colors ${
                        item.done
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.done ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Section 1: ข้อมูลผู้ติดต่อ */}
              <div>
                <div className="flex items-center space-x-2 text-navy-950 font-bold text-base pb-3 border-b border-gray-100 mb-4">
                  <User className="w-4 h-4 text-gold-600" />
                  <span>1. ข้อมูลผู้ติดต่อ (เจ้าของทรัพย์หรือตัวแทน)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700">
                        ชื่อ-นามสกุล ผู้ติดต่อ *
                      </label>
                      {name.trim().length >= 2 && (
                        <span className="text-[10px] text-emerald-600 font-bold">✓ ถูกต้อง</span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="เช่น คุณสมชาย นวลศรี"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full border rounded-xl p-3 text-xs text-gray-900 outline-none transition-all ${
                        name.trim().length >= 2
                          ? 'bg-emerald-50/20 border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-400'
                          : 'bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-gold-500'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700">
                        เบอร์โทรศัพท์ติดต่อ *
                      </label>
                      {phone.trim().length >= 9 && (
                        <span className="text-[10px] text-emerald-600 font-bold">✓ ถูกต้อง</span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="081-xxx-xxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`w-full border rounded-xl p-3 text-xs text-gray-900 outline-none transition-all ${
                        phone.trim().length >= 9
                          ? 'bg-emerald-50/20 border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-400'
                          : 'bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-gold-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      LINE ID (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      placeholder="ไอดีไลน์สำหรับการติดต่อ"
                      value={lineId}
                      onChange={(e) => setLineId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลอสังหาริมทรัพย์ */}
              <div>
                <div className="flex items-center space-x-2 text-navy-950 font-bold text-base pb-3 border-b border-gray-100 mb-4">
                  <Home className="w-4 h-4 text-gold-600" />
                  <span>2. รายละเอียดอสังหาริมทรัพย์ที่ต้องการฝากขาย</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ประเภททรัพย์ *
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium cursor-pointer focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    >
                      <option value="house">บ้านเดี่ยว / ทาวน์โฮม</option>
                      <option value="land">ที่ดินเปล่า</option>
                      <option value="condo">คอนโดมิเนียม</option>
                      <option value="commercial">อาคารพาณิชย์</option>
                      <option value="other">อื่น ๆ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      จังหวัด
                    </label>
                    <input
                      type="text"
                      disabled
                      value={province}
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      อำเภอ / ทำเล *
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium cursor-pointer focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    >
                      {DISTRICTS_LIST.map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ตำบล (ถ้าทราบ)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ควนลัง, คลองแห..."
                      value={subdistrict}
                      onChange={(e) => setSubdistrict(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ราคาที่ต้องการขาย (บาท) *
                    </label>
                    <input
                      type="number" min="0"
                      required
                      placeholder="เช่น 4,500,000"
                      value={expectedPrice}
                      onChange={(e) => setExpectedPrice(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none font-semibold text-navy-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ขนาดที่ดิน (ตร.ว. หรือ ไร่)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 52 ตร.ว. หรือ 2 ไร่"
                      value={landSize}
                      onChange={(e) => setLandSize(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      พื้นที่ใช้สอย (ตร.ม.)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 180 ตร.ม."
                      value={usableArea}
                      onChange={(e) => setUsableArea(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    รายละเอียดเพิ่มเติมเกี่ยวกับทรัพย์
                  </label>
                  <textarea
                    rows={4}
                    placeholder="เช่น จำนวนห้องนอน ห้องน้ำ จุดเด่น สถานที่ใกล้เคียง และข้อมูลโฉนด..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Section 3: รูปถ่ายและเอกสาร */}
              <div>
                <div className="flex items-center space-x-2 text-navy-950 font-bold text-base pb-3 border-b border-gray-100 mb-4">
                  <Upload className="w-4 h-4 text-gold-600" />
                  <span>3. แนบรูปถ่ายทรัพย์และเอกสารประกอบ (ถ้ามี)</span>
                </div>

                {/* Dropzone */}
                <div className="border-2 border-dashed border-gray-300 hover:border-gold-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-gold-50/20 relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handlePhotoUpload} disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-10 h-10 text-gold-600 mx-auto mb-2" />
                  <div className="text-sm font-bold text-navy-950">
                    {uploading ? 'กำลังเตรียมรูปภาพ...' : 'คลิกเพื่อเลือกรูปภาพ'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    รองรับ JPG, PNG และ WebP สูงสุด 5 รูป รูปละไม่เกิน 5 MB (ส่งรูปเพิ่มเติมทาง LINE ได้)
                  </p>
                </div>

                {/* Uploaded Previews */}
                {uploadedPhotos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {uploadedPhotos.map((photo, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Uploaded ${i}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full py-4 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-base rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5 text-gold-400" />
                  <span>{submitting ? 'กำลังบันทึกข้อมูล...' : 'ส่งข้อมูลฝากขาย'}</span>
                </button>
                <p className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ข้อมูลของท่านจะถูกเก็บเป็นความลับตามนโยบายความเป็นส่วนตัวของ Chantakorn Property</span>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
