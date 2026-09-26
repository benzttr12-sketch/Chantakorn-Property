'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  ChevronRight
} from 'lucide-react';
import { Property, PropertyType, PropertyStatus, FacingDirection } from '@/lib/types';
import { createProperty } from '@/lib/store/properties-store';
import { parseRawPropertyText, generateProfessionalDescription } from '@/lib/property-text-parser';
import { DISTRICTS_LIST, getSongkhlaSubdistricts, getSongkhlaCoordinates } from '@/data/locations';
import { calculateFengShui } from '@/lib/feng-shui';
import { formatPrice, formatThaiBahtReadable, slugify } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth-helpers';
import SmartDescriptionGeneratorModal, { PropertySpecsForAI } from '@/components/admin/SmartDescriptionGeneratorModal';
import VoiceDictationBar from '@/components/admin/VoiceDictationBar';

interface QuickPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProperty: Property) => void;
}

const SAMPLE_HOUSE_PHOTOS = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
];

const SAMPLE_CONDO_PHOTOS = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
];

const SAMPLE_LAND_PHOTOS = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80',
];

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
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('2');
  const [parking, setParking] = useState('2');
  const [landSize, setLandSize] = useState('50');
  const [usableArea, setUsableArea] = useState('150');
  const [facingDirection, setFacingDirection] = useState<FacingDirection>('ทิศใต้');
  const [coverImage, setCoverImage] = useState(SAMPLE_HOUSE_PHOTOS[0]);
  const [images, setImages] = useState<string[]>(SAMPLE_HOUSE_PHOTOS);
  const [features, setFeatures] = useState<string[]>(['ติดถนนใหญ่', 'ทำเลชุมชน']);
  const [description, setDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [showAiDescModal, setShowAiDescModal] = useState(false);
  const [quickAiGenerating, setQuickAiGenerating] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(true);

  if (!isOpen) return null;

  const handleQuickAiGenerate = async () => {
    setQuickAiGenerating(true);
    try {
      const currentUser = getStoredUser();
      const res = await fetch('/api/ai/generate-property-description', {
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
          agentLine: currentUser?.line_id || '@chantakorn',
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
      setError('กรุณาวางข้อความรายละเอียดทรัพย์ หรือเลือกแม่แบบด่วนด้านล่างก่อน');
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
    if (parsed.bedrooms !== undefined) setBedrooms(String(parsed.bedrooms));
    if (parsed.bathrooms !== undefined) setBathrooms(String(parsed.bathrooms));
    if (parsed.parking !== undefined) setParking(String(parsed.parking));
    if (parsed.landSize !== undefined) setLandSize(String(parsed.landSize));
    if (parsed.usableArea !== undefined) setUsableArea(String(parsed.usableArea));
    if (parsed.facingDirection) setFacingDirection(parsed.facingDirection);
    if (parsed.features && parsed.features.length > 0) setFeatures(parsed.features);

    // Pick photos by property type
    if (parsed.propertyType === 'condo') {
      setCoverImage(SAMPLE_CONDO_PHOTOS[0]);
      setImages(SAMPLE_CONDO_PHOTOS);
    } else if (parsed.propertyType === 'land') {
      setCoverImage(SAMPLE_LAND_PHOTOS[0]);
      setImages(SAMPLE_LAND_PHOTOS);
    } else {
      setCoverImage(SAMPLE_HOUSE_PHOTOS[0]);
      setImages(SAMPLE_HOUSE_PHOTOS);
    }

    const parsedDesc = generateProfessionalDescription({
      title: parsed.title || title,
      propertyType: parsed.propertyType || propertyType,
      status: parsed.status || status,
      price: parsed.price || price,
      district: parsed.district || district,
      subdistrict: parsed.subdistrict || subdistrict,
      bedrooms: parsed.bedrooms !== undefined ? parsed.bedrooms : bedrooms,
      bathrooms: parsed.bathrooms !== undefined ? parsed.bathrooms : bathrooms,
      parking: parsed.parking !== undefined ? parsed.parking : parking,
      landSize: parsed.landSize !== undefined ? parsed.landSize : landSize,
      usableArea: parsed.usableArea !== undefined ? parsed.usableArea : usableArea,
      facingDirection: parsed.facingDirection || facingDirection,
      features: parsed.features && parsed.features.length > 0 ? parsed.features : features,
      rawNotes: text,
    });
    setDescription(parsedDesc);

    setStep('review');
  };

  // Quick preset loader
  const handleLoadPreset = (type: 'house' | 'condo' | 'land' | 'townhome') => {
    let preset = '';
    if (type === 'house') {
      preset = 'ขายบ้านเดี่ยว 2 ชั้น โครงการโมเดิร์น ทำเลควนลัง หาดใหญ่ 3 ห้องนอน 2 ห้องน้ำ ที่จอดรถ 2 คัน 54 ตรว. 165 ตรม. ราคา 3.89 ล้าน ใกล้สนามบินหาดใหญ่ ทิศใต้ แถมแอร์ 3 เครื่อง ปั๊มน้ำ แท้งค์น้ำ';
    } else if (type === 'condo') {
      preset = 'ให้เช่าคอนโดหรู ใจกลางเมืองหาดใหญ่ ย่าน ม.อ. 1 ห้องนอน 1 ห้องน้ำ 32 ตรม. ชั้น 8 วิวสระว่ายน้ำ เฟอร์ครบ แอร์ ทีวี ตู้เย็น ราคา 9,500 บาท/เดือน ใกล้ รพ.สงขลานครินทร์ ทิศตะวันออก';
    } else if (type === 'land') {
      preset = 'ขายที่ดินเปล่าถมแล้ว แปลงสวย สี่เหลี่ยม 100 ตารางวา หน้ากว้าง 16 เมตร ทำเลเมืองสงขลา ใกล้ ม.ทักษิณ และหาดชลาทัศน์ ราคา 2.5 ล้าน ทิศเหนือ เหมาะสร้างบ้านพักอาศัย';
    } else {
      preset = 'ขายทาวน์โฮม 2 ชั้น สไตล์มินิมอล ทำเลคลองแห หาดใหญ่ 2 ห้องนอน 2 ห้องน้ำ 1 ที่จอดรถ 22 ตรว. 110 ตรม. ราคา 2.19 ล้าน ใกล้ตลาดน้ำคลองแห และ Big C หาดใหญ่ ทิศตะวันออกเฉียงเหนือ';
    }
    setRawText(preset);
    setError('');
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
      
      const fengShui = calculateFengShui(facingDirection, {
        lat: coords.lat,
        lng: coords.lng,
        propertyType
      });

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
        facing_direction: facingDirection,
        feng_shui: fengShui,
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        parking: Number(parking) || 0,
        land_size: Number(landSize) || 0,
        usable_area: Number(usableArea) || 0,
        furniture: 'พร้อมอยู่',
        cover_image: coverImage,
        images: images.length > 0 ? images : [coverImage],
        features: features.length > 0 ? features : ['ทำเลดี เดินทางสะดวก'],
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
          line_id: currentUser?.line_id || '@chantakorn',
          email: currentUser?.email || 'contact@chantakorn.com',
          photo_url: currentUser?.avatar_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
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
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white p-5 flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-500/20 border border-gold-400/40 text-gold-400 flex items-center justify-center font-bold text-lg shadow-sm">
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-mono text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none leading-relaxed"
                />
              </div>

              {/* Fast Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-500">หรือคลิกทดลองใส่ตัวอย่าง:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('house')}
                    className="p-2.5 bg-gray-50 hover:bg-gold-50 hover:border-gold-300 border border-gray-200 rounded-xl text-xs font-medium text-navy-900 text-left transition-all cursor-pointer"
                  >
                    🏡 บ้านเดี่ยวหาดใหญ่
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('condo')}
                    className="p-2.5 bg-gray-50 hover:bg-gold-50 hover:border-gold-300 border border-gray-200 rounded-xl text-xs font-medium text-navy-900 text-left transition-all cursor-pointer"
                  >
                    🏢 คอนโด ม.อ.
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('land')}
                    className="p-2.5 bg-gray-50 hover:bg-gold-50 hover:border-gold-300 border border-gray-200 rounded-xl text-xs font-medium text-navy-900 text-left transition-all cursor-pointer"
                  >
                    🌳 ที่ดินเมืองสงขลา
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('townhome')}
                    className="p-2.5 bg-gray-50 hover:bg-gold-50 hover:border-gold-300 border border-gray-200 rounded-xl text-xs font-medium text-navy-900 text-left transition-all cursor-pointer"
                  >
                    🏬 ทาวน์โฮมคลองแห
                  </button>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>ระบบจะช่วยทำอะไรให้คุณอัตโนมัติ?</span>
                </span>
                <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                  <li>สกัดราคา, อำเภอ, ตำบล, จำนวนห้อง และขนาดที่ดินออกมาให้อัตโนมัติ</li>
                  <li>คำนวณและดึงพิกัด Google Maps สงขลาให้ตรงทำเลทันที</li>
                  <li>คำนวณทิศฮวงจุ้ยมงคล คะแนนพลังงาน และชี่ลม/สุริยันให้อัตโนมัติ</li>
                  <li>แต่งคำบรรยายประกาศแบบมืออาชีพพร้อมรูปภาพมาตรฐานทันที</li>
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-none"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-medium text-navy-950 outline-none"
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
                    onChange={(e) => setFacingDirection(e.target.value as FacingDirection)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-[11px] font-bold text-navy-950"
                  >
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
                      className="px-2.5 py-1 bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-bold text-[10px] rounded-lg shadow-xs flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none leading-relaxed font-sans"
                />
              </div>

              {/* Agent Internal Notes (Non-Public) */}
              <div className="space-y-1 bg-amber-50/80 p-3 rounded-2xl border border-amber-200">
                <label className="block text-[11px] font-bold text-amber-950 flex items-center justify-between">
                  <span>🔒 บันทึกภายในสำหรับนายหน้า & แอดมิน (Agent Internal Notes - ไม่แสดงหน้าบ้าน)</span>
                  <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-extrabold">ความลับเฉพาะภายใน</span>
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="เช่น เบอร์โทรเจ้าของบ้านจริง, สัญญาหมดอายุ ธ.ค. 69, สภาพบ้านต้องซ่อมสี, ราคาสุดท้ายต่อรองไว้..."
                  className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-medium text-navy-950 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Photo Preview Strip */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-gray-700">รูปภาพปกและแกลเลอรี (จัดเตรียมให้อัตโนมัติ):</span>
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-16 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                      <Image
                        src={img}
                        alt="Property sample"
                        fill
                        unoptimized
                        referrerPolicy="no-referrer"
                        className="object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-0.5 left-0.5 bg-gold-500 text-navy-950 text-[9px] font-black px-1.5 py-0.2 rounded">
                          รูปปก
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Publish Toggle */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="publishImmediate"
                    checked={publishImmediately}
                    onChange={(e) => setPublishImmediately(e.target.checked)}
                    className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500 cursor-pointer"
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
                    <span>ยืนยันและบันทึกทรัพย์ทันที</span>
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
