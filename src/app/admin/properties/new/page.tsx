'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  X,
  Star,
  Image as ImageIcon,
  Loader2,
  UserCheck,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  Compass,
  Wand2,
  Zap,
  HelpCircle,
  FileText,
  ExternalLink,
  Eye
} from 'lucide-react';
import { 
  createProperty, 
  updateProperty, 
  fetchAdminProperties, 
  fetchUsers 
} from '@/lib/store/properties-store';
import { PropertyType, PropertyStatus, UserProfile, Agent, AgentRank } from '@/lib/types';
import { 
  slugify, 
  formatPrice, 
  formatThaiBahtReadable, 
  numberToThaiBahtWords, 
  parseGoogleMapsCoordinates, 
  isValidLatLng 
} from '@/lib/utils';
import { 
  DISTRICTS_LIST, 
  getSongkhlaSubdistricts, 
  getSongkhlaCoordinates 
} from '@/data/locations';
import { getStoredUser } from '@/lib/auth-helpers';

// ตัวอย่างรูปภาพคุณภาพสูง สำหรับปุ่ม "ใส่รูปภาพตัวอย่างทันที 1 คลิก"
const SAMPLE_HOUSE_PHOTOS = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
];

const SAMPLE_CONDO_PHOTOS = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
];

const SAMPLE_LAND_PHOTOS = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80',
];

function PropertyEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');
  const [loading, setLoading] = useState(Boolean(editId));
  const [error, setError] = useState('');
  const [editorLoaded, setEditorLoaded] = useState(!editId);
  const [slugEdited, setSlugEdited] = useState(Boolean(editId));
  const [published, setPublished] = useState(true);

  // Form State
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
  const [bedrooms, setBedrooms] = useState('0');
  const [bathrooms, setBathrooms] = useState('0');
  const [parking, setParking] = useState('0');
  const [landSize, setLandSize] = useState('');
  const [usableArea, setUsableArea] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [furniture, setFurniture] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);

  // Staff (Agent & Admin) List
  const [eligibleStaff, setEligibleStaff] = useState<UserProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Google Maps URL & Coordinates Auto-converter State
  const [mapsInput, setMapsInput] = useState('');
  const [mapsParsing, setMapsParsing] = useState(false);
  const [mapsMessage, setMapsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showMapPreview, setShowMapPreview] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);

  // แปลงพิกัดจากข้อความ/ลิงก์ Google Maps โดยอัตโนมัติ
  const handleConvertMapsInput = async (inputOverride?: string) => {
    const rawVal = (inputOverride !== undefined ? inputOverride : mapsInput).trim();
    if (!rawVal) {
      setMapsMessage({ type: 'error', text: 'กรุณาวางลิงก์ Google Maps หรือตัวเลขพิกัด' });
      return;
    }

    setMapsParsing(true);
    setMapsMessage(null);

    try {
      // 1. ตรวจสอบพิกัดแบบทันทีด้วย parseGoogleMapsCoordinates บน client-side
      const directParsed = parseGoogleMapsCoordinates(rawVal);
      if (directParsed) {
        setLatitude(directParsed.lat.toFixed(6));
        setLongitude(directParsed.lng.toFixed(6));
        const sourceLabel = 
          directParsed.sourceType === 'embed' ? 'จากโค้ด iframe' :
          directParsed.sourceType === 'url' ? 'จากลิงก์ Google Maps' :
          directParsed.sourceType === 'dms' ? 'จากพิกัดองศา-ลิปดา (DMS)' : 'จากตัวเลขพิกัด';
        setMapsMessage({
          type: 'success',
          text: `แปลงพิกัดสำเร็จ (${sourceLabel}): ละติจูด ${directParsed.lat.toFixed(6)}, ลองจิจูด ${directParsed.lng.toFixed(6)}`
        });
        setMapsParsing(false);
        return;
      }

      // 2. ถ้าเป็นลิงก์ย่อ เช่น maps.app.goo.gl หรือลิงก์เว็บ ส่งให้เซิร์ฟเวอร์ resolve
      if (/https?:\/\//i.test(rawVal) || /goo\.gl|google\.com/i.test(rawVal)) {
        const res = await fetch('/api/resolve-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: rawVal }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.lat && data.lng) {
          setLatitude(Number(data.lat).toFixed(6));
          setLongitude(Number(data.lng).toFixed(6));
          setMapsMessage({
            type: 'success',
            text: `แปลงพิกัดสำเร็จจาก Google Maps: ละติจูด ${Number(data.lat).toFixed(6)}, ลองจิจูด ${Number(data.lng).toFixed(6)}`
          });
        } else {
          setMapsMessage({
            type: 'error',
            text: data.error || 'ไม่พบพิกัดในลิงก์นี้ กรุณาคัดลอกพิกัดตัวเลข (เช่น 7.0084, 100.4747) หรือแชร์พิกัดจาก Google Maps'
          });
        }
      } else {
        setMapsMessage({
          type: 'error',
          text: 'ไม่สามารถแยกพิกัดได้ กรุณาวางลิงก์ Google Maps (เช่น https://maps.app.goo.gl/...), โค้ด iframe หรือพิกัด เช่น 7.0084, 100.4747'
        });
      }
    } catch (err: unknown) {
      setMapsMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแปลงพิกัด'
      });
    } finally {
      setMapsParsing(false);
    }
  };

  // ดึงพิกัดจากอุปกรณ์ปัจจุบัน (GPS)
  const handleGetDeviceGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setMapsMessage({ type: 'error', text: 'เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS' });
      return;
    }
    setGpsLoading(true);
    setMapsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setMapsMessage({
          type: 'success',
          text: `ดึงพิกัด GPS จากอุปกรณ์สำเร็จ: ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lng.toFixed(6)}`
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setMapsMessage({
          type: 'error',
          text: `ไม่สามารถดึงพิกัด GPS ได้: ${err.message || 'โปรดตรวจสอบการอนุญาตตำแหน่ง'}`
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // List of available subdistricts for current district
  const availableSubdistricts = getSongkhlaSubdistricts(district);

  // 1. Load Staff Members (Only ADMIN and AGENT)
  useEffect(() => {
    async function loadStaff() {
      try {
        const users = await fetchUsers();
        // Filter strictly to ADMIN and AGENT
        const staffOnly = users.filter(u => u.role === 'ADMIN' || u.role === 'AGENT');
        
        // Also ensure current user is represented if they are staff
        const current = getStoredUser();
        if (current && (current.role === 'ADMIN' || current.role === 'AGENT')) {
          if (!staffOnly.some(s => s.id === current.id || s.email === current.email)) {
            staffOnly.unshift(current);
          }
        }

        // Fallback default staff if empty
        if (staffOnly.length === 0) {
          staffOnly.push({
            id: 'admin-benz',
            full_name: 'คุณฉันทากร นวลจันทร์ (เบนซ์)',
            role: 'ADMIN',
            email: 'benzttr12@gmail.com',
            phone: '081-604-0097',
            line_id: '@chantakorn',
            avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
          });
        }

        setEligibleStaff(staffOnly);

        // Pre-select current user as default if not in edit mode
        if (!editId && staffOnly.length > 0) {
          if (current) {
            const matchCurrent = staffOnly.find(s => s.id === current.id || s.email === current.email);
            if (matchCurrent) {
              setSelectedAgentId(matchCurrent.id);
              return;
            }
          }
          setSelectedAgentId(staffOnly[0].id);
        }
      } catch (err) {
        console.warn('Error fetching staff list:', err);
      }
    }
    loadStaff();
  }, [editId]);

  // 2. Load Property Data if in Edit Mode
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
      setProvince(property.province || 'สงขลา');
      setDistrict(property.district || 'หาดใหญ่');
      setSubdistrict(property.subdistrict || 'ควนลัง');
      setAddress(property.address || '');
      setLatitude(String(property.latitude ?? '7.0084'));
      setLongitude(String(property.longitude ?? '100.4705'));
      setBedrooms(String(property.bedrooms ?? '0'));
      setBathrooms(String(property.bathrooms ?? '0'));
      setParking(String(property.parking ?? '0'));
      setLandSize(String(property.land_size ?? '0'));
      setUsableArea(String(property.usable_area ?? '0'));
      setYearBuilt(String(property.year_built ?? '2024'));
      setFurniture(property.furniture || 'พร้อมอยู่บางส่วน');
      setDescription(property.description || '');
      setCoverImage(property.cover_image || property.images[0] || '');
      setImages(property.images || []);
      setSelectedFeatures(property.features || []);
      setFeatured(property.featured || false);
      setSelectedAgentId(property.agent_id || property.agent?.id || '');
      setPublished(property.published);
      setEditorLoaded(true);
    }).catch(err => { 
      if (active) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); 
    }).finally(() => { 
      if (active) setLoading(false); 
    });
    return () => { active = false; };
  }, [editId]);

  // Handle District Change & Auto-fill Center Coordinates & Default Subdistrict
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const subList = getSongkhlaSubdistricts(newDistrict);
    if (subList.length > 0) {
      setSubdistrict(subList[0]);
    } else {
      setSubdistrict('');
    }
    const coords = getSongkhlaCoordinates(newDistrict);
    setLatitude(coords.lat.toFixed(4));
    setLongitude(coords.lng.toFixed(4));
  };

  // Handle Subdistrict Change & update coords if available
  const handleSubdistrictChange = (newSub: string) => {
    setSubdistrict(newSub);
    const coords = getSongkhlaCoordinates(district, newSub);
    setLatitude(coords.lat.toFixed(4));
    setLongitude(coords.lng.toFixed(4));
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugEdited) {
      const generated = slugify(val);
      setSlug(generated ? `${generated}-${Math.floor(1000 + Math.random() * 9000)}` : `property-${Date.now()}`);
    }
  };

  const generateRandomSlug = () => {
    const prefix = propertyType === 'house' ? 'house' : propertyType === 'condo' ? 'condo' : propertyType === 'land' ? 'land' : 'property';
    const distCode = district === 'หาดใหญ่' ? 'hatyai' : district === 'เมืองสงขลา' ? 'mueang' : 'songkhla';
    const code = Math.random().toString(36).substring(2, 7);
    setSlug(`${prefix}-${distCode}-${code}`);
    setSlugEdited(true);
  };

  // 1-Click Quick Preset Handler
  const applyPreset = (type: 'house' | 'condo' | 'land' | 'townhome' | 'commercial') => {
    if (type === 'house') {
      setTitle('บ้านเดี่ยว 2 ชั้น ดีไซน์โมเดิร์น พร้อมอยู่ ทำเลควนลัง ใกล้สนามบินหาดใหญ่');
      setPropertyType('house');
      setStatus('sale');
      setPrice('3890000');
      setDistrict('หาดใหญ่');
      setSubdistrict('ควนลัง');
      setAddress('ซอยร่วมใจพัฒนา ถนนสนามบิน-ลพบุรีราเมศวร์ ต.ควนลัง อ.หาดใหญ่ จ.สงขลา');
      setBedrooms('3');
      setBathrooms('2');
      setParking('2');
      setLandSize('52');
      setUsableArea('165');
      setFurniture('พร้อมเฟอร์นิเจอร์บางส่วน');
      setDescription('บ้านเดี่ยวสร้างใหม่สไตล์นอร์ดิก-โมเดิร์น บรรยากาศเงียบสงบ ร่มรื่น เดินทางเข้าเมืองหาดใหญ่สะดวกมาก ใกล้สนามบินนานาชาติหาดใหญ่และไทวัสดุ หลังบ้านไม่ชนใคร วัสดุก่อสร้างเกรดพรีเมียม');
      setImages(SAMPLE_HOUSE_PHOTOS);
      setCoverImage(SAMPLE_HOUSE_PHOTOS[0]);
      setSelectedFeatures(['เครื่องปรับอากาศ', 'ที่จอดรถส่วนตัว', 'กล้องวงจรปิด CCTV', 'ใกล้สนามบินหาดใหญ่']);
      handleDistrictChange('หาดใหญ่');
      setSubdistrict('ควนลัง');
    } else if (type === 'condo') {
      setTitle('คอนโดแต่งครบ วิวสระว่ายน้ำ ย่าน ม.อ. หาดใหญ่ พร้อมปล่อยเช่าทันที');
      setPropertyType('condo');
      setStatus('rent');
      setPrice('12000');
      setDistrict('หาดใหญ่');
      setSubdistrict('คอหงส์');
      setAddress('ถนนปุณณกัณฑ์ ต.คอหงส์ อ.หาดใหญ่ จ.สงขลา');
      setBedrooms('1');
      setBathrooms('1');
      setParking('1');
      setLandSize('0');
      setUsableArea('34');
      setFurniture('ตกแต่งครบพร้อมอยู่ (Fully Furnished)');
      setDescription('คอนโดมิเนียมทำเลทองใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.) และ รพ.สงขลานครินทร์ ห้องทิศเหนือไม่ร้อน เฟอร์นิเจอร์และเครื่องใช้ไฟฟ้าครบชุด เหมาะสำหรับนักศึกษา แพทย์ หรือผู้ที่ทำงานในหาดใหญ่');
      setImages(SAMPLE_CONDO_PHOTOS);
      setCoverImage(SAMPLE_CONDO_PHOTOS[0]);
      setSelectedFeatures(['เครื่องปรับอากาศ', 'สระว่ายน้ำ', 'ระบบรักษาความปลอดภัย 24 ชม.', 'ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)']);
      handleDistrictChange('หาดใหญ่');
      setSubdistrict('คอหงส์');
    } else if (type === 'land') {
      setTitle('ที่ดินแปลงสวย เหมาะสร้างบ้านพักตากอากาศ ทำเลเมืองสงขลา ใกล้ทะเล');
      setPropertyType('land');
      setStatus('sale');
      setPrice('4500000');
      setDistrict('เมืองสงขลา');
      setSubdistrict('บ่อยาง');
      setAddress('ถนนชลาทัศน์ ต.บ่อยาง อ.เมืองสงขลา จ.สงขลา');
      setBedrooms('0');
      setBathrooms('0');
      setParking('0');
      setLandSize('120');
      setUsableArea('0');
      setFurniture('ที่ดินเปล่า');
      setDescription('ที่ดินเปล่าถมแล้ว หน้ากว้างติดถนนสาธารณะ น้ำ-ไฟฟ้าเข้าถึงพร้อม บรรยากาศร่มรื่น รับลมทะเล ใกล้หาดชลาทัศน์และแหลมสมิหลา เหมาะสร้างบ้านพักอาศัย พูลวิลล่า หรือซื้อเก็บเพื่อการลงทุน');
      setImages(SAMPLE_LAND_PHOTOS);
      setCoverImage(SAMPLE_LAND_PHOTOS[0]);
      setSelectedFeatures(['ติดถนนใหญ่']);
      handleDistrictChange('เมืองสงขลา');
      setSubdistrict('บ่อยาง');
    } else if (type === 'townhome') {
      setTitle('ทาวน์โฮม 2 ชั้น ทำเลใจกลางหาดใหญ่ เดินทางสะดวก ใกล้เซ็นทรัล');
      setPropertyType('house');
      setStatus('sale');
      setPrice('2790000');
      setDistrict('หาดใหญ่');
      setSubdistrict('หาดใหญ่');
      setAddress('ถนนคลองเรียน 1 ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา');
      setBedrooms('2');
      setBathrooms('2');
      setParking('1');
      setLandSize('24');
      setUsableArea('115');
      setFurniture('พร้อมเข้าอยู่');
      setDescription('ทาวน์โฮมรีโนเวทใหม่ทั้งหลัง สวยงามสไตล์มินิมอล ทำเลดีมาก อยู่ในย่านชุมชน ปลอดภัย ใกล้โรงเรียน โรงพยาบาล และห้างสรรพสินค้าเซ็นทรัลหาดใหญ่');
      setImages(SAMPLE_HOUSE_PHOTOS);
      setCoverImage(SAMPLE_HOUSE_PHOTOS[1]);
      setSelectedFeatures(['เครื่องปรับอากาศ', 'ที่จอดรถส่วนตัว', 'ใกล้เซ็นทรัลหาดใหญ่']);
      handleDistrictChange('หาดใหญ่');
      setSubdistrict('หาดใหญ่');
    } else if (type === 'commercial') {
      setTitle('อาคารพาณิชย์ 3 ชั้นครึ่ง ย่านธุรกิจการค้าหาดใหญ่ เหมาะเปิดร้านและออฟฟิศ');
      setPropertyType('commercial');
      setStatus('sale');
      setPrice('6900000');
      setDistrict('หาดใหญ่');
      setSubdistrict('หาดใหญ่');
      setAddress('ถนนราษฎร์ยินดี (30 เมตร) ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา');
      setBedrooms('4');
      setBathrooms('3');
      setParking('2');
      setLandSize('28');
      setUsableArea('240');
      setFurniture('โครงสร้างแข็งแรง พร้อมรีโนเวท');
      setDescription('ทำเลทองติดถนนสายหลัก ย่านธุรกิจคึกคัก มีที่จอดรถด้านหน้า เหมาะสำหรับทำคลินิก สถาบันกวดวิชา ร้านอาหาร โฮสเทล หรือสำนักงานบริษัท');
      setImages(SAMPLE_HOUSE_PHOTOS);
      setCoverImage(SAMPLE_HOUSE_PHOTOS[2]);
      setSelectedFeatures(['ติดถนนใหญ่', 'ที่จอดรถส่วนตัว', 'กล้องวงจรปิด CCTV']);
      handleDistrictChange('หาดใหญ่');
      setSubdistrict('หาดใหญ่');
    }
    setSlugEdited(false);
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
    'ใกล้สนามบินหาดใหญ่',
    'ใกล้โรงพยาบาลสงขลานครินทร์'
  ];

  const toggleFeature = (f: string) => {
    if (selectedFeatures.includes(f)) {
      setSelectedFeatures(selectedFeatures.filter(item => item !== f));
    } else {
      setSelectedFeatures([...selectedFeatures, f]);
    }
  };

  // Image Processing
  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (!validFiles.length) {
      setError('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WebP)');
      return;
    }
    const oversized = validFiles.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`ไฟล์ ${oversized.map(f => f.name).join(', ')} มีขนาดเกิน 50MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 50MB`);
      return;
    }
    if (images.length + validFiles.length > 50) {
      setError('สามารถเพิ่มรูปภาพได้สูงสุด 50 รูปต่อประกาศ');
      return;
    }

    setUploadingImages(true);
    setError('');
    try {
      const newPhotos = await Promise.all(validFiles.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`อ่านรูปภาพ ${file.name} ไม่สำเร็จ`));
        reader.onload = () => {
          const img = new window.Image();
          img.onerror = () => reject(new Error(`รูปแบบรูปภาพ ${file.name} ไม่ถูกต้อง`));
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 1920;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
              return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            let quality = 0.85;
            let resultUrl = canvas.toDataURL('image/jpeg', quality);
            while (resultUrl.length > 500000 && quality > 0.35) {
              quality -= 0.1;
              resultUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(resultUrl);
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      })));

      setImages(prev => {
        const updated = [...prev, ...newPhotos];
        if (!coverImage && updated.length > 0) {
          setCoverImage(updated[0]);
        }
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดรูปภาพ');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) processFiles(files);
  };

  const handleAddImageUrl = () => {
    if (/^https?:\/\//i.test(imageUrlInput.trim())) {
      setImages([...images, imageUrlInput.trim()]);
      if (!coverImage) setCoverImage(imageUrlInput.trim());
      setError('');
      setImageUrlInput('');
    } else { 
      setError('กรุณาระบุ URL รูปภาพที่ขึ้นต้นด้วย https:// หรือ http://'); 
    }
  };

  const handleRemoveImage = (idx: number) => {
    const remaining = images.filter((_, i) => i !== idx);
    setImages(remaining);
    if (coverImage === images[idx]) setCoverImage(remaining[0] || '');
  };

  // Find the selected Agent User Profile
  const currentAssignedStaff = eligibleStaff.find(s => s.id === selectedAgentId) || eligibleStaff[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || loading) return;
    if (!title.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) { 
      setError('กรุณาระบุชื่อประกาศและราคาที่ถูกต้องมากกว่า 0'); 
      return; 
    }
    if (!slug.trim() || /[/?#\\]/.test(slug)) { 
      setError('Slug ต้องไม่ว่างและไม่มีอักขระพิเศษ / ? #'); 
      return; 
    }
    if (!images.length || !coverImage) { 
      setError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป'); 
      return; 
    }
    if (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90 || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180) { 
      setError('พิกัดละติจูดหรือลองจิจูดไม่ถูกต้อง'); 
      return; 
    }
    setError('');

    setSubmitting(true);
    try {
      // Build resolved Agent details based on strictly Admin / Agent profile
      const agentProfile = currentAssignedStaff;
      const resolvedRank: AgentRank = (agentProfile?.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า');
      const resolvedAgent: Agent = {
        id: agentProfile?.id || 'admin-benz',
        name: agentProfile?.full_name || 'คุณฉันทากร นวลจันทร์ (เบนซ์)',
        rank: resolvedRank,
        title: resolvedRank,
        phone: agentProfile?.phone || '081-604-0097',
        line_id: agentProfile?.line_id || 'LINE Official Account',
        email: agentProfile?.email || 'chantakorn@chantakornproperty.com',
        photo_url: agentProfile?.avatar_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
        bio: agentProfile?.bio || (resolvedRank === 'แอดมิน'
          ? 'ผู้ดูแลระบบและที่ปรึกษาอสังหาริมทรัพย์ Chantakorn Property ดูแลลูกค้าทุกท่านอย่างซื่อตรงและโปร่งใส'
          : 'ตัวแทนนายหน้าอสังหาริมทรัพย์มืออาชีพ พร้อมดูแลพานัดชมทรัพย์และอำนวยความสะดวกทุกขั้นตอน'),
      };

      const propertyData = {
        title: title.trim(),
        slug: slug.trim(),
        description: description || 'อสังหาริมทรัพย์คุณภาพ คัดสรรโดย Chantakorn Property พร้อมพาชมและดูแลสินเชื่อฟรี',
        property_type: propertyType,
        status,
        price: Number(price),
        province,
        district,
        subdistrict,
        address: address || `${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} จ.${province}`,
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
        agent_id: resolvedAgent.id,
        agent: resolvedAgent,
      };

      if (editId) {
        await updateProperty(editId, propertyData);
      } else {
        await createProperty(propertyData);
      }

      router.push('/admin/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-700">กำลังโหลดข้อมูลทรัพย์...</p>
      </div>
    );
  }

  if (!editorLoaded) {
    return (
      <div className="p-8 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center space-y-3">
        <p className="font-bold">{error || 'ไม่สามารถเปิดรายการนี้ได้'}</p>
        <Link href="/admin/properties" className="text-xs font-bold underline">กลับหน้ารายการทรัพย์</Link>
      </div>
    );
  }

  // Completion calculation for seamless UX
  const completionItems = [
    { label: 'ชื่อประกาศ', done: Boolean(title.trim()) },
    { label: 'ราคา', done: Boolean(price && Number(price) > 0) },
    { label: 'ทำเลสงขลา', done: Boolean(district && subdistrict) },
    { label: 'รูปภาพ', done: images.length > 0 },
    { label: 'นายหน้าผู้ดูแล', done: Boolean(selectedAgentId) },
  ];
  const completedCount = completionItems.filter(i => i.done).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);

  return (
    <div className="space-y-6 pb-24">
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs sm:text-sm text-red-700 flex items-center space-x-2 animate-in fade-in">
          <X className="w-4 h-4 text-red-600 flex-shrink-0 cursor-pointer" onClick={() => setError('')} />
          <span>{error}</span>
        </div>
      )}

      {/* Sticky Section Jump Navigation Bar */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {[
            { id: 'section-1-basic', label: '1. ข้อมูล & ราคา' },
            { id: 'section-2-location', label: '2. ทำเล (สงขลา)' },
            { id: 'section-3-specs', label: '3. สเปก & จุดเด่น' },
            { id: 'section-4-images', label: `4. รูปภาพ (${images.length})` },
            { id: 'section-5-agent', label: '5. นายหน้าผู้ดูแล' },
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-xl font-semibold text-navy-950 hover:bg-gold-50 hover:text-gold-700 bg-gray-50 border border-gray-200/80 transition-all cursor-pointer whitespace-nowrap"
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Progress Pill */}
        <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-gray-200 flex-shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">ความสมบูรณ์:</span>
          <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                completionPercentage === 100 ? 'bg-emerald-500' : 'bg-gold-500'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-navy-950">{completionPercentage}%</span>
        </div>
      </div>

      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-sm gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/properties"
            className="p-2 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950">
              {editId ? 'แก้ไขอสังหาริมทรัพย์' : 'เพิ่มอสังหาริมทรัพย์ใหม่'}
            </h1>
            <p className="text-xs text-brand-muted">
              {editId ? 'ปรับปรุงข้อมูลประกาศทรัพย์ให้ทันสมัย' : 'ลงประกาศง่ายและรวดเร็ว พร้อมระบบซิงค์ข้อมูลนายหน้าอัตโนมัติ'}
            </p>
          </div>
        </div>

        {/* Quick Save Button at Top */}
        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{editId ? 'บันทึกการแก้ไข' : 'บันทึกและเผยแพร่ทันที'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1-Click Fast Templates (แม่แบบโพสต์ด่วน 1 คลิก ช่วยให้โพสต์งานง่ายกว่าเดิม) */}
      {!editId && (
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white p-5 rounded-2xl border border-navy-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-gold-400" />
              <span className="text-xs sm:text-sm font-bold text-white">แม่แบบโพสต์ด่วน 1 คลิก (ช่วยกรอกข้อมูลอัตโนมัติ):</span>
            </div>
            <span className="text-[11px] text-gold-300/80 hidden sm:inline">คลิกเพื่อเติมข้อมูลและรูปภาพตัวอย่างทันที</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => applyPreset('house')}
              className="px-3 py-2 bg-navy-800/80 hover:bg-gold-500 hover:text-navy-950 rounded-xl text-xs font-semibold text-gray-200 transition-all border border-navy-700/60 flex items-center space-x-1.5 justify-center text-center"
            >
              <span>🏡 บ้านเดี่ยวหาดใหญ่</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('condo')}
              className="px-3 py-2 bg-navy-800/80 hover:bg-gold-500 hover:text-navy-950 rounded-xl text-xs font-semibold text-gray-200 transition-all border border-navy-700/60 flex items-center space-x-1.5 justify-center text-center"
            >
              <span>🏢 คอนโดย่าน ม.อ.</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('land')}
              className="px-3 py-2 bg-navy-800/80 hover:bg-gold-500 hover:text-navy-950 rounded-xl text-xs font-semibold text-gray-200 transition-all border border-navy-700/60 flex items-center space-x-1.5 justify-center text-center"
            >
              <span>🌳 ที่ดินเมืองสงขลา</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('townhome')}
              className="px-3 py-2 bg-navy-800/80 hover:bg-gold-500 hover:text-navy-950 rounded-xl text-xs font-semibold text-gray-200 transition-all border border-navy-700/60 flex items-center space-x-1.5 justify-center text-center"
            >
              <span>🏬 ทาวน์โฮมทำเลดี</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('commercial')}
              className="px-3 py-2 bg-navy-800/80 hover:bg-gold-500 hover:text-navy-950 rounded-xl text-xs font-semibold text-gray-200 transition-all border border-navy-700/60 flex items-center space-x-1.5 justify-center text-center col-span-2 sm:col-span-1"
            >
              <span>🏢 อาคารพาณิชย์</span>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information & Price */}
        <div id="section-1-basic" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4 scroll-mt-28">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3 flex items-center space-x-2">
            <Home className="w-4 h-4 text-gold-600" />
            <span>1. ข้อมูลประกาศและราคา</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ชื่อหัวข้อประกาศ (Title) *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ขายบ้านเดี่ยว 2 ชั้น โครงการหรู ทำเลควนลัง หาดใหญ่ ใกล้สนามบิน"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none font-semibold text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">
                  Slug (URL ลิงก์ภาษาอังกฤษ) *
                </label>
                <button
                  type="button"
                  onClick={generateRandomSlug}
                  className="text-[11px] text-gold-600 hover:text-gold-700 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>สุ่มรหัส URL ใหม่</span>
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="modern-house-hatyai-01"
                value={slug}
                onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ราคา (บาท) *
              </label>
              <input
                type="number" 
                step="any"
                required
                placeholder="เช่น 3890000 หรือ 12000 (กรณีปล่อยเช่า)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />

              {/* Thai Baht Word and Readable Preview */}
              {Number(price) > 0 && (
                <div className="mt-2 p-2.5 bg-gold-50/80 border border-gold-200 rounded-xl text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-gold-950">
                    <span className="text-sm">{formatThaiBahtReadable(Number(price))}</span>
                    <span className="text-[11px] text-navy-900 bg-gold-200/80 px-2 py-0.5 rounded font-mono font-bold">
                      {formatPrice(Number(price), status)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    คำอ่าน: <span className="font-semibold text-navy-900">{numberToThaiBahtWords(Number(price))}</span>
                  </div>
                </div>
              )}

              {/* Quick Price Buttons */}
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">กดเลือกราคาด่วน:</span>
                {status === 'sale' ? (
                  [1990000, 2500000, 3200000, 4500000, 6900000].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrice(String(p))}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gold-500 hover:text-navy-950 text-gray-700 rounded-md font-medium transition-all cursor-pointer"
                    >
                      {(p / 1000000).toFixed(2).replace(/\.?0+$/, '')} ลบ.
                    </button>
                  ))
                ) : (
                  [6000, 8500, 12000, 15000, 25000].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrice(String(p))}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gold-500 hover:text-navy-950 text-gray-700 rounded-md font-medium transition-all cursor-pointer"
                    >
                      {p.toLocaleString()} / ด.
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ประเภทอสังหาริมทรัพย์ *
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              >
                <option value="house">บ้านเดี่ยว / ทาวน์โฮม / บ้านแฝด</option>
                <option value="condo">คอนโดมิเนียม</option>
                <option value="land">ที่ดินเปล่า / ที่ดินจัดสรร</option>
                <option value="commercial">อาคารพาณิชย์ / ตึกแถว / โฮมออฟฟิศ</option>
                <option value="investment">อสังหาฯ เพื่อการลงทุน (อพาร์ทเม้นท์/โรงแรม)</option>
                <option value="consignment">ขายฝาก / จำนองดอกเบี้ยต่ำ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                สถานะประกาศ *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('sale')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    status === 'sale' ? 'bg-navy-950 text-gold-400 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  สำหรับขาย
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('rent')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    status === 'rent' ? 'bg-navy-950 text-gold-400 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  สำหรับเช่า
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Songkhla Districts & Subdistricts (เพิ่มอำเภอ ตำบล ทั้งหมดในสงขลา) */}
        <div id="section-2-location" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-gold-600" />
              <span>2. ทำเลที่ตั้งในจังหวัดสงขลา (ครบทั้ง 16 อำเภอ 127 ตำบล)</span>
            </h3>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
              ✓ พิกัด GPS เติมอัตโนมัติ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Province */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                จังหวัด
              </label>
              <input
                type="text"
                readOnly
                value={province}
                className="w-full bg-gray-100/80 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 font-semibold cursor-not-allowed"
              />
            </div>

            {/* District (อำเภอ) - All 16 Songkhla Districts */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                อำเภอ (ทั้งหมด 16 อำเภอ) *
              </label>
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950 font-bold focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              >
                {DISTRICTS_LIST.map((dist) => (
                  <option key={dist} value={dist}>อำเภอ{dist}</option>
                ))}
              </select>
            </div>

            {/* Subdistrict (ตำบล) - Filtered to District */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ตำบล (ในอำเภอ{district}) *
              </label>
              {availableSubdistricts.length > 0 ? (
                <select
                  value={subdistrict}
                  onChange={(e) => handleSubdistrictChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950 font-medium focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                >
                  {availableSubdistricts.map((sub) => (
                    <option key={sub} value={sub}>ตำบล{sub}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="ระบุตำบล"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
              )}
            </div>

            {/* Specific Address / Road */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ที่อยู่โดยละเอียด / ซอย / ถนน / จุดสังเกตใกล้เคียง
              </label>
              <input
                type="text"
                placeholder="เช่น ซอย 12 ถนนเพชรเกษม ใกล้บิ๊กซีเอ็กซ์ตร้า หาดใหญ่"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            {/* Google Maps Converter Box */}
            <div className="sm:col-span-3 bg-gradient-to-br from-amber-50/40 via-white to-gold-50/30 border border-gold-300/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gold-500 text-navy-950 flex items-center justify-center font-bold shadow-xs">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                      <span>แปลงพิกัดจาก Google Maps อัตโนมัติ</span>
                      <span className="bg-gold-100 text-gold-900 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gold-300">
                        สะดวกมาก
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      วางลิงก์ที่แชร์จากแอป Google Maps (เช่น maps.app.goo.gl), ลิงก์บนเว็บ, โค้ด iframe หรือตัวเลขพิกัด ระบบจะดึงและแปลงค่าพิกัดให้ทันที
                    </p>
                  </div>
                </div>

                {/* Direct Google Maps open link */}
                {isValidLatLng(Number(latitude), Number(longitude)) && (
                  <a
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-gold-50 text-navy-950 border border-gold-300 rounded-xl text-[11px] font-semibold transition-colors shadow-xs self-start sm:self-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gold-600" />
                    <span>เปิดดูหมุดจริงบน Google Maps</span>
                  </a>
                )}
              </div>

              {/* Input + Action Button */}
              <div className="relative flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={mapsInput}
                    placeholder="วางลิงก์ Google Maps เช่น https://maps.app.goo.gl/... หรือ 7.0084, 100.4747 หรือ <iframe>..."
                    onChange={(e) => {
                      const val = e.target.value;
                      setMapsInput(val);
                      if (val.trim()) {
                        handleConvertMapsInput(val);
                      }
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted) {
                        setMapsInput(pasted);
                        handleConvertMapsInput(pasted);
                      }
                    }}
                    className="w-full bg-white border border-gold-300/90 rounded-xl py-2.5 pl-3 pr-8 text-xs text-navy-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 font-medium"
                  />
                  {mapsInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapsInput('');
                        setMapsMessage(null);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={mapsParsing}
                  onClick={() => handleConvertMapsInput()}
                  className="px-4 py-2.5 bg-navy-950 hover:bg-navy-900 disabled:opacity-50 text-gold-400 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                >
                  {mapsParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gold-400" />
                      <span>กำลังแปลงพิกัด...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-gold-400" />
                      <span>แปลงค่าพิกัด</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Feedback Message */}
              {mapsMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in ${
                    mapsMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {mapsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <span className="font-medium text-[11px] leading-relaxed">{mapsMessage.text}</span>
                </div>
              )}

              {/* Quick Tools */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleGetDeviceGps}
                  disabled={gpsLoading}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 hover:text-navy-950 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  {gpsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-gold-600" />
                  ) : (
                    <Compass className="w-3 h-3 text-gold-600" />
                  )}
                  <span>ดึงพิกัด GPS จากอุปกรณ์</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const c = getSongkhlaCoordinates(district, subdistrict);
                    setLatitude(c.lat.toFixed(6));
                    setLongitude(c.lng.toFixed(6));
                    setMapsMessage({
                      type: 'success',
                      text: `รีเซ็ตพิกัดเป็นจุดศูนย์กลาง อ.${district} ต.${subdistrict} (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}) สำเร็จ`
                    });
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 hover:text-navy-950 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-gold-600" />
                  <span>รีเซ็ตพิกัดศูนย์กลาง อ.{district}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMapPreview(!showMapPreview)}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 hover:text-navy-950 flex items-center space-x-1 transition-colors cursor-pointer sm:ml-auto"
                >
                  <Eye className="w-3 h-3 text-gold-600" />
                  <span>{showMapPreview ? 'ซ่อนพรีวิวแผนที่' : 'แสดงพรีวิวแผนที่'}</span>
                </button>
              </div>

              {/* Map Preview Iframe */}
              {showMapPreview && isValidLatLng(Number(latitude), Number(longitude)) && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gold-200 bg-gray-100 relative shadow-inner">
                  <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-600 px-3">
                    <span className="font-semibold text-navy-950 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gold-600" />
                      พรีวิวหมุดตำแหน่งบน Google Maps: ({Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)})
                    </span>
                    <span className="text-[10px] text-gray-400">อัปเดตตามค่าละติจูดและลองจิจูดแบบเรียลไทม์</span>
                  </div>
                  <iframe
                    title="Google Maps Location Preview"
                    width="100%"
                    height="200"
                    loading="lazy"
                    className="border-0 w-full"
                    src={`https://maps.google.com/maps?q=${latitude},${longitude}&hl=th&z=15&output=embed`}
                  />
                </div>
              )}
            </div>

            {/* Editable Lat & Lng Numeric Fields */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                พิกัดละติจูด (Latitude)
              </label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                พิกัดลองจิจูด (Longitude)
              </label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                สถานะความถูกต้องพิกัด
              </label>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs flex items-center justify-between text-navy-950">
                <span className="font-semibold text-[11px]">
                  {isValidLatLng(Number(latitude), Number(longitude)) ? 'พิกัดสมบูรณ์ พร้อมแสดงผล' : 'พิกัดไม่ถูกต้อง'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${isValidLatLng(Number(latitude), Number(longitude)) ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Property Specs & Features */}
        <div id="section-3-specs" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4 scroll-mt-28">
          <h3 className="font-bold text-navy-950 text-base border-b border-gray-100 pb-3 flex items-center space-x-2">
            <Maximize className="w-4 h-4 text-gold-600" />
            <span>3. รายละเอียดและสิ่งอำนวยความสะดวก</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center space-x-1">
                <Bed className="w-3.5 h-3.5 text-gold-600" />
                <span>ห้องนอน</span>
              </label>
              <input
                type="number"
                min="0"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center space-x-1">
                <Bath className="w-3.5 h-3.5 text-gold-600" />
                <span>ห้องน้ำ</span>
              </label>
              <input
                type="number"
                min="0"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center space-x-1">
                <Car className="w-3.5 h-3.5 text-gold-600" />
                <span>ที่จอดรถ</span>
              </label>
              <input
                type="number"
                min="0"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                เนื้อที่ดิน (ตร.ว.)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={landSize}
                onChange={(e) => setLandSize(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
              {Number(landSize) > 0 && (
                <div className="text-[10px] text-gray-500 mt-1 font-medium">
                  ≈ {Number(landSize) * 4} ตร.ม. {Number(landSize) >= 400 && `(${ (Number(landSize) / 400).toFixed(2) } ไร่)`}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                พื้นที่ใช้สอย (ตร.ม.)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={usableArea}
                onChange={(e) => setUsableArea(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ปีที่สร้างเสร็จ
              </label>
              <input
                type="text"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-navy-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                สภาพเฟอร์นิเจอร์และการตกแต่ง
              </label>
              <input
                type="text"
                placeholder="เช่น ตกแต่งครบพร้อมอยู่ (Fully Furnished), บ้านเปล่า"
                value={furniture}
                onChange={(e) => setFurniture(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              คำอธิบายรายละเอียดทรัพย์
            </label>
            <textarea
              rows={4}
              placeholder="จุดเด่นของทรัพย์ เส้นทางการเดินทาง สถานที่สำคัญใกล้เคียง สิ่งอำนวยความสะดวกในโครงการ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none leading-relaxed"
            />
          </div>

          {/* Features Checkboxes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              จุดเด่น / สิ่งอำนวยความสะดวก (เลือกได้หลายข้อ)
            </label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((feat) => {
                const active = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleFeature(feat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                      active
                        ? 'bg-navy-950 text-gold-400 border border-navy-900 shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                      active ? 'bg-gold-500 text-navy-950' : 'bg-white border border-gray-300'
                    }`}>
                      {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>{feat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 4: Images */}
        <div id="section-4-images" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-gold-600" />
              <span>4. รูปภาพทรัพย์สิน (Images)</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setImages(SAMPLE_HOUSE_PHOTOS);
                  setCoverImage(SAMPLE_HOUSE_PHOTOS[0]);
                }}
                className="text-[11px] font-semibold text-gold-700 bg-gold-50 hover:bg-gold-100 px-3 py-1.5 rounded-xl border border-gold-200 transition-colors"
              >
                + ใส่ชุดรูปภาพตัวอย่างทันที
              </button>
              <span className="text-xs font-semibold text-gray-500">
                {images.length} รูป
              </span>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragOver 
                ? 'border-gold-500 bg-gold-50/60' 
                : 'border-gray-300 hover:border-gold-400 bg-gray-50/50 hover:bg-white'
            }`}
          >
            <input
              type="file"
              id="property-image-upload"
              multiple
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleFileInputChange}
              disabled={uploadingImages}
              className="sr-only"
            />
            <label
              htmlFor="property-image-upload"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              {uploadingImages ? (
                <div className="flex flex-col items-center space-y-2 py-4">
                  <Loader2 className="w-8 h-8 text-gold-600 animate-spin" />
                  <p className="text-xs font-bold text-navy-950">กำลังประมวลผลรูปภาพ...</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-gold-100 text-gold-700 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-950 bg-gold-100 px-3 py-1.5 rounded-lg hover:bg-gold-200 transition-colors">
                      คลิกเลือกไฟล์รูปภาพจากเครื่อง
                    </span>
                    <span className="text-xs text-gray-500 block mt-1.5">
                      หรือลากไฟล์รูปภาพมาวางที่นี่ (รองรับ JPG, PNG, WebP ไฟล์ละไม่เกิน 50MB สูงสุด 50 รูป คมชัดระดับ Full HD)
                    </span>
                  </div>
                </>
              )}
            </label>
          </div>

          {/* URL Input */}
          <div className="flex space-x-2">
            <input
              type="url"
              placeholder="หรือวางลิงก์รูปภาพ https://images.unsplash.com/..."
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="flex-grow bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-gold-500 outline-none"
            />
            <button
              type="button"
              onClick={handleAddImageUrl}
              className="px-4 py-2 bg-navy-950 text-gold-400 rounded-xl text-xs font-bold hover:bg-navy-900 transition-colors shrink-0"
            >
              เพิ่มรูปจากลิงก์
            </button>
          </div>

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-navy-950 block">
                รูปภาพทั้งหมด ({images.length}) - คลิกรูปภาพใดเพื่อตั้งเป็นหน้าปก:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((img, i) => {
                  const isCover = (coverImage === img) || (!coverImage && i === 0);
                  return (
                    <div 
                      key={i} 
                      className={`relative rounded-xl overflow-hidden border-2 transition-all group aspect-[4/3] bg-gray-100 ${
                        isCover ? 'border-gold-500 ring-2 ring-gold-400/40 shadow-md' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={img} 
                        alt={`Property ${i + 1}`} 
                        fill
                        unoptimized
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                      
                      {isCover ? (
                        <div className="absolute top-1.5 left-1.5 bg-gold-500 text-navy-950 text-[10px] font-black px-2 py-0.5 rounded shadow-sm flex items-center space-x-1">
                          <Star className="w-3 h-3 fill-current" />
                          <span>หน้าปก</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCoverImage(img)}
                          className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/75 hover:bg-gold-500 hover:text-navy-950 text-white text-[10px] font-bold py-1 rounded transition-colors text-center opacity-0 group-hover:opacity-100"
                        >
                          ตั้งเป็นหน้าปก
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        title="ลบรูปภาพนี้"
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/75 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors shadow"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Responsible Agent (นายหน้าที่รับผิดชอบทรัพย์นี้ - อ้างอิงจากสมาชิกที่มียศ นายหน้า และ แอดมิน เท่านั้น และแสดงข้อมูลของคนโพสต์) */}
        <div id="section-5-agent" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-4 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-gold-600" />
              <span>5. นายหน้าที่รับผิดชอบทรัพย์นี้ (อ้างอิงจากสมาชิกยศ นายหน้า และ แอดมิน)</span>
            </h3>
            <span className="text-[11px] text-brand-muted flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-600" />
              <span>เฉพาะสมาชิกสิทธิ์ ADMIN และ AGENT</span>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Left: Dropdown to select authorized staff */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700">
                เลือกนายหน้าผู้ดูแลทรัพย์นี้ *
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none"
              >
                {eligibleStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name} ({staff.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'นายหน้า'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                ℹ️ สมาชิกที่แสดงในรายการนี้ได้รับการตรวจสอบสิทธิ์แล้ว (ผู้ใช้งานทั่วไปไม่มีสิทธิ์เป็นผู้ดูแลทรัพย์)
              </p>

              {/* Publishing & Featured Toggles */}
              <div className="pt-3 border-t border-gray-100 space-y-2.5">
                <label className="flex items-center space-x-2 text-xs font-bold text-navy-950 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={published} 
                    onChange={e => setPublished(e.target.checked)} 
                    className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500"
                  />
                  <span>เผยแพร่ประกาศบนเว็บไซต์ทันที</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-bold text-navy-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500"
                  />
                  <span>ตั้งเป็นทรัพย์เด่นประจำหน้าแรก (Featured Property)</span>
                </label>
              </div>
            </div>

            {/* Right: Rich Card Showing Poster / Assigned Agent Details (แสดงข้อมูลของคนโพสต์) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100/80 rounded-2xl p-4 sm:p-5 border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-navy-950 flex-shrink-0 border-2 border-gold-400 shadow-md">
                {currentAssignedStaff?.avatar_url ? (
                  <Image
                    src={currentAssignedStaff.avatar_url}
                    alt={currentAssignedStaff.full_name || 'Agent'}
                    fill
                    unoptimized
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                    {currentAssignedStaff?.full_name?.charAt(0) || 'A'}
                  </div>
                )}
              </div>

              <div className="flex-grow space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-navy-950">
                    {currentAssignedStaff?.full_name}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    currentAssignedStaff?.role === 'ADMIN'
                      ? 'bg-gold-100 text-gold-800 border border-gold-300'
                      : 'bg-navy-100 text-navy-800 border border-navy-300'
                  }`}>
                    {currentAssignedStaff?.role === 'ADMIN' ? '🛡️ ยศ: แอดมิน (Admin)' : '👔 ยศ: นายหน้า (Agent)'}
                  </span>
                </div>

                <p className="text-xs text-brand-muted">
                  {currentAssignedStaff?.role === 'ADMIN' 
                    ? 'ยศ: แอดมิน ผู้ดูแลระบบและที่ปรึกษาอสังหาริมทรัพย์ Chantakorn Property' 
                    : 'ยศ: นายหน้า ตัวแทนนายหน้าอสังหาริมทรัพย์ประจำจังหวัดสงขลา'}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-900 pt-1">
                  {currentAssignedStaff?.phone && (
                    <span className="flex items-center space-x-1 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-gold-600" />
                      <span>{currentAssignedStaff.phone}</span>
                    </span>
                  )}
                  {currentAssignedStaff?.line_id && (
                    <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>LINE: {currentAssignedStaff.line_id}</span>
                    </span>
                  )}
                  {currentAssignedStaff?.email && (
                    <span className="flex items-center space-x-1 text-gray-500">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{currentAssignedStaff.email}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="sticky bottom-4 z-40 bg-navy-950/95 backdrop-blur-md rounded-2xl p-4 border border-navy-800 shadow-2xl flex items-center justify-between gap-3">
          <Link
            href="/admin/properties"
            className="px-5 py-2.5 rounded-xl border border-navy-700 text-gray-300 hover:text-white text-xs font-bold hover:bg-navy-900 transition-colors"
          >
            ยกเลิก
          </Link>

          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-navy-950 rounded-xl text-xs font-extrabold shadow-lg transition-all active:scale-95 flex items-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูลทรัพย์...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-navy-950" />
                  <span>{editId ? 'บันทึกการแก้ไขทรัพย์' : 'บันทึกและเผยแพร่งานทันที'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AddPropertyPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center space-y-2">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto" />
        <p className="text-xs text-gray-500">กำลังเปิดระบบจัดการทรัพย์...</p>
      </div>
    }>
      <PropertyEditor />
    </Suspense>
  );
}
