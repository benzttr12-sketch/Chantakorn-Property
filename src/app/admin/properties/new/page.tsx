'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  ArrowLeft, 
  Upload, 
  Check, 
  MapPin, 
  Coins, 
  Home, 
  Tag, 
  Bed, 
  Bath, 
  Car, 
  Maximize, 
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { createProperty, updateProperty, fetchAdminProperties } from '@/lib/store/properties-store';
import { PropertyType, PropertyStatus } from '@/lib/types';
import { slugify } from '@/lib/utils';
import { DISTRICTS_LIST } from '@/data/locations';
import { AGENTS } from '@/data/agents';

function PropertyEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');
  const [loading, setLoading] = useState(Boolean(editId));
  const [error, setError] = useState('');
  const [editorLoaded, setEditorLoaded] = useState(!editId);
  const [slugEdited, setSlugEdited] = useState(Boolean(editId));
  const [published, setPublished] = useState(true);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [status, setStatus] = useState<PropertyStatus>('sale');
  const [price, setPrice] = useState('');
  const [province, setProvince] = useState('สงขลา');
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('ควนลัง');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('7.0084');
  const [longitude, setLongitude] = useState('100.4705');
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('2');
  const [parking, setParking] = useState('2');
  const [landSize, setLandSize] = useState('50');
  const [usableArea, setUsableArea] = useState('160');
  const [yearBuilt, setYearBuilt] = useState('2024');
  const [furniture, setFurniture] = useState('พร้อมอยู่บางส่วน');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
  );
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80'
  ]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'เครื่องปรับอากาศ',
    'ที่จอดรถส่วนตัว',
    'กล้องวงจรปิด CCTV'
  ]);
  const [featured, setFeatured] = useState(false);
  const [agentId, setAgentId] = useState(AGENTS[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoading(true);
    fetchAdminProperties().then(list => {
      if (!active) return;
      const property = list.find(item => item.id === editId);
      if (!property) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
      setTitle(property.title);
      setSlug(property.slug);
      setPropertyType(property.property_type);
      setStatus(property.status);
      setPrice(String(property.price ?? ''));
      setProvince(property.province);
      setDistrict(property.district);
      setSubdistrict(property.subdistrict || '');
      setAddress(property.address || '');
      setLatitude(String(property.latitude ?? ''));
      setLongitude(String(property.longitude ?? ''));
      setBedrooms(String(property.bedrooms ?? ''));
      setBathrooms(String(property.bathrooms ?? ''));
      setParking(String(property.parking ?? ''));
      setLandSize(String(property.land_size ?? ''));
      setUsableArea(String(property.usable_area ?? ''));
      setYearBuilt(String(property.year_built ?? ''));
      setFurniture(property.furniture);
      setDescription(property.description);
      setCoverImage(property.cover_image);
      setImages(property.images);
      setSelectedFeatures(property.features);
      setFeatured(property.featured);
      setAgentId(property.agent_id || '');
      setPublished(property.published);
      setEditorLoaded(true);
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editId]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugEdited) {
      setSlug(slugify(val) || `property-${Date.now()}`);
    }
  };

  const featureOptions = [
    'เครื่องปรับอากาศ',
    'ที่จอดรถส่วนตัว',
    'สวนหย่อมส่วนตัว',
    'สระว่ายน้ำ',
    'ห้องครัวบิวท์อิน',
    'กล้องวงจรปิด CCTV',
    'ระบบรักษาความปลอดภัย 24 ชม.',
    'ติดถนนใหญ่',
    'ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)',
    'ใกล้เซ็นทรัลหาดใหญ่',
    'ใกล้สนามบินหาดใหญ่'
  ];

  const toggleFeature = (f: string) => {
    if (selectedFeatures.includes(f)) {
      setSelectedFeatures(selectedFeatures.filter(item => item !== f));
    } else {
      setSelectedFeatures([...selectedFeatures, f]);
    }
  };

  const handleAddImageUrl = () => {
    if (/^https?:\/\//i.test(imageUrlInput.trim())) {
      setImages([...images, imageUrlInput.trim()]);
      if (!coverImage) setCoverImage(imageUrlInput.trim());
      setError('');
      setImageUrlInput('');
    } else { setError('กรุณาระบุ URL รูปภาพที่ขึ้นต้นด้วย https:// หรือ http://'); }
  };

  const handleRemoveImage = (idx: number) => {
    const remaining = images.filter((_, i) => i !== idx);
    setImages(remaining);
    if (coverImage === images[idx]) setCoverImage(remaining[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || loading) return;
    if (!title.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) { setError('กรุณาระบุชื่อและราคามากกว่า 0'); return; }
    if (!slug.trim() || /[/?#\\]/.test(slug)) { setError('Slug ต้องไม่ว่างและไม่มี / ? # หรือเครื่องหมายทับ'); return; }
    if (!images.length || !coverImage) { setError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป'); return; }
    if (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90 || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180) { setError('พิกัดละติจูดหรือลองจิจูดไม่ถูกต้อง'); return; }
    setError('');

    setSubmitting(true);
    try {
      const selectedAgent = AGENTS.find(a => a.id === agentId) || AGENTS[0];

      const propertyData = {
        title: title.trim(),
        slug: slug.trim(),
        description: description || 'อสังหาริมทรัพย์คุณภาพจาก Chantakorn Property',
        property_type: propertyType,
        status,
        price: Number(price),
        province,
        district,
        subdistrict,
        address: address || `${district}, ${province}`,
        latitude: Number(latitude),
        longitude: Number(longitude),
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        parking: Number(parking) || 0,
        land_size: Number(landSize) || 0,
        usable_area: Number(usableArea) || 0,
        year_built: Number(yearBuilt) || 2024,
        furniture,
        features: selectedFeatures,
        cover_image: coverImage || images[0],
        images,
        featured,
        published,
        agent_id: agentId,
        agent: selectedAgent,
      };
      if (editId) await updateProperty(editId, propertyData);
      else await createProperty(propertyData);

      router.push('/admin/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-8 text-center" role="status">กำลังโหลดข้อมูลทรัพย์...</p>;

  if (!editorLoaded) return <p role="alert" className="p-8 text-red-700">{error || 'ไม่สามารถเปิดรายการนี้ได้'}</p>;

  return (
    <div className="space-y-6 pb-20">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-surface-border shadow-sm">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/properties"
            className="p-2 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950">{editId ? 'แก้ไขอสังหาริมทรัพย์' : 'เพิ่มอสังหาริมทรัพย์ใหม่'}</h1>
            <p className="text-xs text-brand-muted">กรอกข้อมูลให้ครบถ้วนเพื่อลงประกาศบนเว็บไซต์ Chantakorn Property</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Basic Information */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3 flex items-center space-x-2">
            <Home className="w-4 h-4 text-gold-600" />
            <span>1. ข้อมูลพื้นฐานและราคา</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ชื่อหัวข้อประกาศ (Title) *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น บ้านเดี่ยว 2 ชั้น สไตล์โมเดิร์น ใกล้เซ็นทรัลหาดใหญ่"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none font-semibold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Slug (URL Address) *
              </label>
              <input
                type="text"
                required
                placeholder="modern-house-central-hatyai"
                value={slug}
                onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ราคา (บาท) *
              </label>
              <input
                type="number" step="any"
                required
                placeholder="เช่น 4,850,000 หรือ 15,000 (กรณีเช่า)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ประเภททรัพย์ (Property Type) *
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              >
                <option value="house">บ้านเดี่ยว / ทาวน์โฮม</option>
                <option value="land">ที่ดินเปล่า</option>
                <option value="condo">คอนโดมิเนียม</option>
                <option value="commercial">อาคารพาณิชย์</option>
                <option value="investment">อสังหาฯ ลงทุน</option>
                <option value="consignment">ขายฝาก / จำนอง</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                สถานะการขาย (Status) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('sale')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    status === 'sale' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  สำหรับขาย
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('rent')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    status === 'rent' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  สำหรับเช่า
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Location & Geo Coordinates */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gold-600" />
            <span>2. ทำเลที่ตั้งและพิกัดแผนที่ (หาดใหญ่–สงขลา)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                อำเภอ / โซน *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              >
                {DISTRICTS_LIST.map((dist) => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ตำบล
              </label>
              <input
                type="text"
                placeholder="เช่น ควนลัง, คลองแห, หาดใหญ่"
                value={subdistrict}
                onChange={(e) => setSubdistrict(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ที่อยู่เต็ม / ซอย
              </label>
              <input
                type="text"
                placeholder="เช่น ซอยเพชรเกษม 41 ถนนเพชรเกษม"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Latitude (ละติจูด)
              </label>
              <input
                type="text"
                placeholder="7.0084"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Longitude (ลองจิจูด)
              </label>
              <input
                type="text"
                placeholder="100.4705"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Specs & Measurements */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3 flex items-center space-x-2">
            <Maximize className="w-4 h-4 text-gold-600" />
            <span>3. ขนาดและจำนวนห้อง</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ห้องนอน</label>
              <input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ห้องน้ำ</label>
              <input
                type="number"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ที่จอดรถ</label>
              <input
                type="number"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ที่ดิน (ตร.ว.)</label>
              <input
                type="number"
                value={landSize}
                onChange={(e) => setLandSize(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ใช้สอย (ตร.ม.)</label>
              <input
                type="number"
                value={usableArea}
                onChange={(e) => setUsableArea(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ปีที่สร้าง</label>
              <input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">รายละเอียดเฟอร์นิเจอร์</label>
            <input
              type="text"
              value={furniture}
              onChange={(e) => setFurniture(e.target.value)}
              placeholder="เช่น ตกแต่งครบพร้อมอยู่, พร้อมอยู่บางส่วน, ไม่มี"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">คำอธิบายรายละเอียดทรัพย์</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุข้อความบรรยายความสวยงาม โครงสร้าง สิ่งแวดล้อม และข้อเสนอพิเศษ..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 resize-none"
            />
          </div>
        </div>

        {/* Card 4: Features Checklist */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3">
            4. สิ่งอำนวยความสะดวกและจุดเด่น
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {featureOptions.map((feat) => {
              const active = selectedFeatures.includes(feat);
              return (
                <button
                  key={feat}
                  type="button"
                  onClick={() => toggleFeature(feat)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center space-x-2 transition-all ${
                    active ? 'bg-gold-50 border-gold-400 text-navy-950' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${
                    active ? 'bg-gold-500 text-navy-950' : 'bg-white border border-gray-300'
                  }`}>
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>{feat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 5: Images & Agent Assignment */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3">
            5. รูปภาพและผู้ดูแลทรัพย์
          </h3>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              เพิ่ม URL รูปภาพ
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="flex-grow bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-5 py-2.5 bg-navy-950 text-gold-400 rounded-xl text-xs font-bold"
              >
                เพิ่มรูป
              </button>
            </div>
          </div>

          {/* Images preview strip */}
          <div className="flex flex-wrap gap-3 pt-2">
            {images.map((img, i) => (
              <div key={i} className="relative w-24 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                นายหน้าที่รับผิดชอบทรัพย์นี้
              </label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium"
              >
                {AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.title})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-start gap-3 pt-4">
              <label className="flex items-center space-x-2 text-xs font-bold text-navy-950"><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} /><span>เผยแพร่บนเว็บไซต์</span></label>
              <label className="flex items-center space-x-2 text-xs font-bold text-navy-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 text-gold-600 rounded border-gray-300 focus:ring-gold-500 cursor-pointer"
                />
                <span>ตั้งเป็นทรัพย์เด่นประจำหน้าแรก (Featured)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-3 pt-4">
          <Link
            href="/admin/properties"
            className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span>{submitting ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลทรัพย์'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddPropertyPage() {
  return <Suspense fallback={<p className="p-8 text-center">กำลังโหลด...</p>}><PropertyEditor /></Suspense>;
}
