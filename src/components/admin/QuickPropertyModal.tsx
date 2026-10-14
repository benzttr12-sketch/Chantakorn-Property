'use client';

import React, { useState } from 'react';
import { 
  X, 
  Wand2, 
  Sparkles, 
  Zap, 
  Check, 
  Loader2, 
  Building2, 
  MapPin, 
  Coins, 
  Home, 
  Tag, 
  Bed, 
  Bath, 
  Maximize, 
  Compass, 
  Eye, 
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Film,
  Video
} from 'lucide-react';
import { Property, PropertyType, PropertyStatus, FacingDirection } from '@/lib/types';
import { createProperty } from '@/lib/store/properties-store';
import { parseRawPropertyText, generateProfessionalDescription } from '@/lib/property-text-parser';
import { DISTRICTS_LIST, getSongkhlaSubdistricts, getSongkhlaCoordinates } from '@/data/locations';
import { calculateFengShui } from '@/lib/feng-shui';
import { formatPrice, formatThaiBahtReadable, slugify } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth-helpers';
import { parseVideoUrl } from '@/lib/image-compressor';
import SmartDescriptionGeneratorModal, { PropertySpecsForAI } from '@/components/admin/SmartDescriptionGeneratorModal';
import VoiceDictationBar from '@/components/ui/VoiceDictationBar';
import { fetchStaffApi } from '@/lib/staff-api';

interface QuickPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProperty: Property) => void;
}

export default function QuickPropertyModal({ isOpen, onClose, onSuccess }: QuickPropertyModalProps) {
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Parsed and Editable Fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [status, setStatus] = useState<PropertyStatus>('sale');
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('ควนลัง');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parking, setParking] = useState('');
  const [landSize, setLandSize] = useState('');
  const [usableArea, setUsableArea] = useState('');
  const [facingDirection, setFacingDirection] = useState<FacingDirection | ''>('');
  const [features, setFeatures] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showAiDescModal, setShowAiDescModal] = useState(false);
  const [quickAiGenerating, setQuickAiGenerating] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(false);

  if (!isOpen) return null;

  const handleQuickAiGenerate = async () => {
    setQuickAiGenerating(true);
    try {
      const currentUser = getStoredUser();
      const res = await fetchStaffApi('/api/ai/generate-property-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          propertyType,
          status,
          price,
          district,
          subdistrict,
          bedrooms,
          bathrooms,
          parking,
          landSize,
          usableArea,
          facingDirection,
          features,
          agentName: currentUser?.full_name || 'คุณฉันทากร (เบนซ์)',
          agentPhone: currentUser?.phone || '081-604-0097',
          agentLine: currentUser?.line_id || '@930xzcyi',
          tone: 'high_converting',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถสร้างคำบรรยายได้');
      }
      if (data.description) {
        setDescription(data.description);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างคำบรรยาย');
    } finally {
      setQuickAiGenerating(false);
    }
  };

  // Handle instant parse
  const handleParseText = () => {
    const text = rawText.trim();
    if (!text) {
      setError('กรุณาวางหรือพูดข้อความรายละเอียดทรัพย์ก่อน');
      return;
    }
    setError('');

    const parsed = parseRawPropertyText(text);

    if (parsed.title) setTitle(parsed.title);
    if (parsed.price) setPrice(String(parsed.price));
    if (parsed.propertyType) setPropertyType(parsed.propertyType);
    if (parsed.status) setStatus(parsed.status);
    if (parsed.district) {
      setDistrict(parsed.district);
      if (parsed.subdistrict) {
        setSubdistrict(parsed.subdistrict);
      } else {
        const subs = getSongkhlaSubdistricts(parsed.district);
        if (subs.length > 0) setSubdistrict(subs[0]);
      }
    }
    // A new text replaces optional specs; missing facts must not inherit earlier values.
    setBedrooms(parsed.bedrooms !== undefined ? String(parsed.bedrooms) : '');
    setBathrooms(parsed.bathrooms !== undefined ? String(parsed.bathrooms) : '');
    setParking(parsed.parking !== undefined ? String(parsed.parking) : '');
    setLandSize(parsed.landSize !== undefined ? String(parsed.landSize) : '');
    setUsableArea(parsed.usableArea !== undefined ? String(parsed.usableArea) : '');
    setFacingDirection(parsed.facingDirection || '');
    setFeatures(parsed.features || []);

    const parsedDesc = generateProfessionalDescription({
      title: parsed.title || title,
      propertyType: parsed.propertyType || propertyType,
      status: parsed.status || status,
      price: parsed.price || price,
      district: parsed.district || district,
      subdistrict: parsed.subdistrict || subdistrict,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      parking: parsed.parking,
      landSize: parsed.landSize,
      usableArea: parsed.usableArea,
      facingDirection: parsed.facingDirection,
      features: parsed.features,
      rawNotes: text,
    });
    setDescription(parsedDesc);

    setStep('review');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('กรุณาระบุชื่อประกาศทรัพย์');
      return;
    }
    if (!price || Number(price) <= 0) {
      setError('กรุณาระบุราคาที่ถูกต้อง');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const coords = getSongkhlaCoordinates(district, subdistrict);
      const generatedSlug = `${slugify(title) || 'prop'}-${Date.now().toString().slice(-6)}`;
      
      const fengShui = facingDirection ? calculateFengShui(facingDirection, {
        lat: coords.lat,
        lng: coords.lng,
        propertyType
      }) : undefined;

      const fullDescription = generateProfessionalDescription({
        title,
        propertyType,
        status,
        price: Number(price),
        district,
        subdistrict,
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        parking: Number(parking),
        landSize: Number(landSize),
        usableArea: Number(usableArea),
        facingDirection,
        features,
        rawNotes: rawText.trim()
      });

      const currentUser = getStoredUser();

      const newProperty: Property = {
        id: crypto.randomUUID(),
        title: title.trim(),
        slug: generatedSlug,
        description: description.trim() || fullDescription,
        property_type: propertyType,
        status,
        price: Number(price),
        province: 'สงขลา',
        district,
        subdistrict,
        address: `${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} จ.สงขลา`,
        latitude: coords.lat,
        longitude: coords.lng,
        ...(facingDirection ? { facing_direction: facingDirection, feng_shui: fengShui } : {}),
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        parking: Number(parking) || 0,
        land_size: Number(landSize) || 0,
        usable_area: Number(usableArea) || 0,
        furniture: '',
        cover_image: '',
        images: [],
        video_url: videoUrl.trim() || undefined,
        features,
        featured: false,
        published: publishImmediately,
        internal_notes: internalNotes.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agent: {
          id: currentUser?.id || 'chantakorn-official',
          name: currentUser?.full_name || 'ฉันทากร พร็อพเพอร์ตี้',
          rank: (currentUser?.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า'),
          title: (currentUser?.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า'),
          phone: currentUser?.phone || '081-604-0097',
          line_id: currentUser?.line_id || '@930xzcyi',
          email: currentUser?.email || 'contact@chantakorn.com',
          photo_url: currentUser?.avatar_url || '',
          bio: currentUser?.bio || 'ผู้เชี่ยวชาญอสังหาริมทรัพย์หาดใหญ่-สงขลา',
        }
      };

      await createProperty(newProperty);
      onSuccess(newProperty);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงประกาศ');
    } finally {
      setSubmitting(false);
    }
  };

  const subdistricts = getSongkhlaSubdistricts(district);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gold-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r/srgb from-navy-950 via-navy-900 to-navy-950 text-white p-5 flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-400/40 text-gold-400 flex items-center justify-center font-bold text-lg shadow-xs">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-gold-300 bg-gold-950/80 px-2 py-0.5 rounded-full border border-gold-500/30">
                  ระบบลงทรัพย์ด่วน 1-Click
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  สกัดข้อความอัตโนมัติ
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                {step === 'input' ? 'วางข้อความเพื่อลงทรัพย์ทันที' : 'ตรวจสอบ & ยืนยันการลงทรัพย์'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium animate-in fade-in">
              {error}
            </div>
          )}

          {step === 'input' ? (
            /* STEP 1: INPUT RAW TEXT */
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-navy-950">
                    วางข้อความโพสต์จาก LINE / Facebook หรือพูดโน้ตทรัพย์ย่อๆ
                  </label>
                </div>

                <VoiceDictationBar
                  onAppendText={(spokenText) => {
                    setRawText((prev) => {
                      if (!prev.trim()) return spokenText;
                      const sep = prev.endsWith('\n') ? '' : '\n';
                      return prev + sep + spokenText;
                    });
                  }}
                  currentText={rawText}
                  targetFieldName="กล่องข้อความสกัดสเปก"
                />

                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="ตัวอย่างการวางหรือกดพูด:
ขายบ้านเดี่ยว 2 ชั้น ควนลัง หาดใหญ่
3 ห้องนอน 2 ห้องน้ำ ที่จอดรถ 2 คัน
54 ตรว. 165 ตรม. ราคา 3.89 ล้าน
ใกล้สนามบินหาดใหญ่ ทิศใต้ แถมแอร์ 3 ตัว..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-mono text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-hidden leading-relaxed"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>ระบบจะช่วยทำอะไรให้คุณอัตโนมัติ?</span>
                </span>
                <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                  <li>สกัดราคา, อำเภอ, ตำบล, จำนวนห้อง และขนาดที่ดินออกมาให้อัตโนมัติ</li>
                  <li>คำนวณและดึงพิกัด Google Maps สงขลาให้ตรงทำเลทันที</li>
                  <li>เตรียมข้อมูลฮวงจุ้ยเมื่อคุณระบุทิศหน้าทรัพย์</li>
                  <li>เตรียมคำบรรยายประกาศ แล้วให้คุณตรวจสอบก่อนบันทึก</li>
                </ul>
              </div>
            </div>
          ) : (
            /* STEP 2: REVIEW & FINE TUNE BEFORE PUBLISH */
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ถอดรหัสข้อความเรียบร้อย! คุณสามารถปรับแก้สเปกก่อนกดยืนยันได้
                </span>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-xs text-emerald-700 underline font-semibold hover:text-emerald-900"
                >
                  ย้อนกลับไปวางข้อความใหม่
                </button>
              </div>

              {/* Title & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    ชื่อประกาศ (Title) *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    ราคา (บาท) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-hidden"
                  />
                  {Number(price) > 0 && (
                    <span className="text-[10px] text-gold-700 font-bold block mt-0.5">
                      {formatThaiBahtReadable(Number(price))}
                    </span>
                  )}
                </div>
              </div>

              {/* Type, Status, District, Subdistrict */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">ประเภท</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-hidden"
                  >
                    <option value="house">บ้านเดี่ยว</option>
                    <option value="condo">คอนโด</option>
                    <option value="land">ที่ดินเปล่า</option>
                    <option value="commercial">อาคารพาณิชย์</option>
                    <option value="consignment">ขายฝาก</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">สถานะ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-hidden"
                  >
                    <option value="sale">ขาย</option>
                    <option value="rent">เช่า</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">อำเภอ</label>
                  <select
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      const subs = getSongkhlaSubdistricts(e.target.value);
                      if (subs.length > 0) setSubdistrict(subs[0]);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-hidden"
                  >
                    {DISTRICTS_LIST.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">ตำบล</label>
                  <select
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-hidden"
                  >
                    {subdistricts.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ห้องนอน</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs text-center font-bold text-navy-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ห้องน้ำ</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs text-center font-bold text-navy-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ที่จอดรถ</label>
                  <input
                    type="number"
                    value={parking}
                    onChange={(e) => setParking(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs text-center font-bold text-navy-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ที่ดิน (ตรว.)</label>
                  <input
                    type="number"
                    value={landSize}
                    onChange={(e) => setLandSize(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs text-center font-bold text-navy-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ใช้สอย (ตรม.)</label>
                  <input
                    type="number"
                    value={usableArea}
                    onChange={(e) => setUsableArea(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs text-center font-bold text-navy-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ทิศฮวงจุ้ย</label>
                  <select
                    value={facingDirection}
                    onChange={(e) => setFacingDirection(e.target.value as FacingDirection | '')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-[11px] font-bold text-navy-950"
                  >
                    <option value="">ยังไม่ระบุ</option>
                    <option value="ทิศใต้">ทิศใต้ (ไฟ)</option>
                    <option value="ทิศเหนือ">ทิศเหนือ (น้ำ)</option>
                    <option value="ทิศตะวันออก">ทิศตะวันออก (ไม้)</option>
                    <option value="ทิศตะวันตก">ทิศตะวันตก (ทอง)</option>
                    <option value="ทิศตะวันออกเฉียงเหนือ">ทิศอีสาน</option>
                    <option value="ทิศตะวันออกเฉียงใต้">ทิศอาคเนย์</option>
                    <option value="ทิศตะวันตกเฉียงเหนือ">ทิศพายัพ</option>
                    <option value="ทิศตะวันตกเฉียงใต้">ทิศหรดี</option>
                  </select>
                </div>
              </div>

              {/* Description with AI Tools */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-gray-700">
                    คำอธิบายประกาศ (AI ปรับแต่งได้)
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleQuickAiGenerate}
                      disabled={quickAiGenerating}
                      className="px-2.5 py-1 bg-linear-to-r/srgb from-gold-400 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-[10px] rounded-lg shadow-xs flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                      title="ใช้ AI ร่างคำบรรยายจากสเปกทันที"
                    >
                      {quickAiGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-navy-950 stroke-[2.5]" />
                      )}
                      <span>{quickAiGenerating ? 'AI กำลังเขียน...' : '✨ ให้ AI ร่างใหม่ 1-Click'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiDescModal(true)}
                      className="px-2.5 py-1 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-[10px] rounded-lg shadow-xs flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>เลือกโทน AI</span>
                    </button>
                  </div>
                </div>
                <VoiceDictationBar
                  compact
                  onAppendText={(spokenText) => {
                    setDescription((prev) => {
                      if (!prev.trim()) return spokenText;
                      const sep = prev.endsWith('\n') ? '' : ' ';
                      return prev + sep + spokenText;
                    });
                  }}
                  currentText={description}
                  targetFieldName="คำอธิบายทรัพย์"
                />

                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="คำอธิบายรายละเอียดทรัพย์... หรือกดปุ่มไมโครโฟนเพื่อพูดบรรยาย"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-hidden leading-relaxed font-sans"
                />
              </div>

              {/* Agent Internal Notes (Non-Public) */}
              <div className="space-y-1 bg-amber-50/80 p-3 rounded-2xl border border-amber-200">
                <label className="block text-[11px] font-bold text-amber-950 flex items-center justify-between">
                  <span>🔒 บันทึกภายในสำหรับนายหน้า & แอดมิน (Agent Internal Notes - ไม่แสดงหน้าบ้าน)</span>
                  <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-sm font-extrabold">ความลับเฉพาะภายใน</span>
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="เช่น เบอร์โทรเจ้าของบ้านจริง, สัญญาหมดอายุ ธ.ค. 69, สภาพบ้านต้องซ่อมสี, ราคาสุดท้ายต่อรองไว้..."
                  className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-medium text-navy-950 focus:ring-1 focus:ring-amber-500 outline-hidden"
                />
              </div>

              {/* Video Tour Section (Optional) */}
              <div className="space-y-2 bg-red-50/60 p-3.5 rounded-2xl border border-red-200">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label className="text-[11px] font-bold text-navy-950 flex items-center space-x-1.5">
                    <Video className="w-3.5 h-3.5 text-red-600" />
                    <span>วิดีโอพาทัวร์อสังหาริมทรัพย์ (Video Tour - ไม่บังคับ/เลือกใส่หรือไม่ใส่ก็ได้)</span>
                  </label>
                  <div className="flex items-center space-x-1.5">
                    {videoUrl && (
                      <button
                        type="button"
                        onClick={() => setVideoUrl('')}
                        className="text-[10px] text-gray-500 hover:text-red-600 bg-white px-1.5 py-0.5 rounded-sm border border-gray-200 transition-colors"
                      >
                        ลบวิดีโอ
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="วางลิงก์ YouTube, TikTok, Facebook หรือ MP4 (เว้นว่างไว้ได้หากไม่มี)"
                  className="w-full bg-white border border-red-300 rounded-xl p-2 text-xs font-medium text-navy-950 focus:ring-1 focus:ring-red-500 outline-hidden"
                />

                {videoUrl && (
                  (() => {
                    const parsed = parseVideoUrl(videoUrl);
                    if (!parsed) return null;
                    return (
                      <div className="rounded-xl overflow-hidden border border-red-300 bg-black aspect-video max-w-sm mt-1 shadow-xs">
                        {parsed.type === 'youtube' && parsed.embedUrl && (
                          <iframe
                            src={parsed.embedUrl}
                            title="Video Tour Preview"
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}
                        {parsed.type === 'direct' && (
                          <video controls preload="metadata" className="w-full h-full object-contain">
                            <source src={parsed.url} />
                          </video>
                        )}
                        {(parsed.type === 'tiktok' || parsed.type === 'facebook' || parsed.type === 'other') && (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-white bg-slate-900 text-xs">
                            <Film className="w-6 h-6 text-gold-400 mb-1" />
                            <p className="font-semibold">{parsed.title || 'วิดีโอจากภายนอก'}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>

              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                บันทึกเป็นฉบับร่าง แล้วเปิดแก้ไขทรัพย์เพื่อเพิ่มรูปภาพจริงก่อนเผยแพร่
              </p>

              {/* Publish Toggle */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="publishImmediate"
                    checked={publishImmediately}
                    onChange={(e) => setPublishImmediately(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-gold-600 focus:ring-gold-500 cursor-pointer"
                  />
                  <label htmlFor="publishImmediate" className="text-xs font-semibold text-navy-950 cursor-pointer">
                    เผยแพร่ออนไลน์ทันที (หากไม่ติ๊กจะบันทึกเป็นแบบร่างเพื่อให้แอดมินตรวจก่อน)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold border border-gray-300 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          {step === 'input' ? (
            <button
              type="button"
              onClick={handleParseText}
              className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Wand2 className="w-4 h-4 text-gold-400" />
              <span>ถอดรหัสข้อความ & ตรวจสอบข้อมูล ➔</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-xl"
              >
                แก้ไขข้อความเดิม
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSave}
                className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{publishImmediately ? 'ยืนยันและเผยแพร่ทรัพย์' : 'บันทึกฉบับร่าง'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {showAiDescModal && (
        <SmartDescriptionGeneratorModal
          isOpen={showAiDescModal}
          onClose={() => setShowAiDescModal(false)}
          specs={{
            title,
            propertyType,
            status,
            price,
            district,
            subdistrict,
            bedrooms,
            bathrooms,
            parking,
            landSize,
            usableArea,
            facingDirection,
            features,
          }}
          currentDescription={description}
          onApplyDescription={(text, mode) => {
            if (mode === 'append') {
              setDescription(prev => prev ? `${prev}\n\n${text}` : text);
            } else {
              setDescription(text);
            }
          }}
          onApplyTitle={(newTitle) => setTitle(newTitle)}
        />
      )}
    </div>
  );
}
