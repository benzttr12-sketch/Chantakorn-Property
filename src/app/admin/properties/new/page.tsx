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
  Eye,
  Facebook,
  ShieldAlert,
  Video,
  Film,
  Play,
  Gauge,
  Sliders,
  CheckCheck,
  Trash2
} from 'lucide-react';
import { 
  createProperty, 
  updateProperty, 
  fetchAdminProperties, 
  fetchUsers 
} from '@/lib/store/properties-store';
import { getAgents } from '@/lib/store/agents-store';
import { PropertyType, PropertyStatus, UserProfile, Agent, AgentRank } from '@/lib/types';
import { 
  slugify, 
  formatPrice, 
  formatThaiBahtReadable, 
  numberToThaiBahtWords, 
  parseGoogleMapsCoordinates, 
  isValidLatLng,
  DEFAULT_OFFICIAL_FACEBOOK,
  formatLineUrl,
  formatFacebookUrl
} from '@/lib/utils';
import { 
  DISTRICTS_LIST, 
  getSongkhlaSubdistricts, 
  getSongkhlaCoordinates 
} from '@/data/locations';
import { getStoredUser } from '@/lib/auth-helpers';
import { 
  compressMultipleImages, 
  parseVideoUrl, 
  formatBytes,
  MAX_UPLOAD_IMAGE_SIZE_BYTES,
  MAX_UPLOAD_VIDEO_SIZE_BYTES
} from '@/lib/image-compressor';
import { calculateNearbyLandmarks } from '@/lib/nearby-landmarks';

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
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{
    current: number;
    total: number;
    currentName?: string;
    originalSize?: string;
    compressedSize?: string;
    percentSaved?: number;
  } | null>(null);
  const [uploadStatsList, setUploadStatsList] = useState<Array<{
    url: string;
    origSize: string;
    compSize: string;
    saved: number;
  }>>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);

  // Auto-calculated nearby landmarks based on pinned coordinates
  const autoLandmarks = isValidLatLng(Number(latitude), Number(longitude))
    ? calculateNearbyLandmarks(Number(latitude), Number(longitude), { limit: 8 })
    : [];

  const handleAppendLandmarksToDescription = () => {
    if (!autoLandmarks.length) return;
    const landmarkText = `\n\n📍 สถานที่สำคัญใกล้เคียง (คำนวณจากพิกัดอัตโนมัติ):\n` +
      autoLandmarks.map(item => `• ${item.title}: ${item.combinedText}`).join('\n');
    setDescription(prev => (prev ? `${prev.trim()}${landmarkText}` : landmarkText.trim()));
  };

  // Staff (Agent & Admin) List & Specific Contact Channels
  const [eligibleStaff, setEligibleStaff] = useState<UserProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentPhone, setAgentPhone] = useState<string>('081-604-0097');
  const [agentLine, setAgentLine] = useState<string>('@chantakorn');
  const [agentFacebook, setAgentFacebook] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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
        const current = getStoredUser();
        if (current) {
          setCurrentUserRole(current.role || 'USER');
        }

        const users = await fetchUsers();
        const customAgents = getAgents();

        // Convert custom agents to staff list if not already present
        const staffOnly = users.filter(u => u.role === 'ADMIN' || u.role === 'AGENT');
        
        customAgents.forEach(agent => {
          const alreadyExists = staffOnly.some(s => 
            s.id === agent.id || 
            s.id === agent.user_id || 
            (agent.email && s.email && s.email.toLowerCase() === agent.email.toLowerCase()) ||
            s.full_name.trim() === agent.name.trim()
          );

          if (!alreadyExists) {
            staffOnly.push({
              id: agent.id,
              full_name: agent.name,
              role: agent.rank === 'แอดมิน' ? 'ADMIN' : 'AGENT',
              email: agent.email,
              phone: agent.phone,
              line_id: agent.line_id,
              facebook: agent.facebook,
              avatar_url: agent.photo_url,
              bio: agent.bio
            });
          }
        });

        // Also ensure current user is represented if they are staff
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
            facebook: DEFAULT_OFFICIAL_FACEBOOK,
            avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
          });
        }

        setEligibleStaff(staffOnly);

        // Pre-select current user as default if not in edit mode
        if (!editId && staffOnly.length > 0) {
          let chosen = staffOnly[0];
          if (current) {
            const matchCurrent = staffOnly.find(s => s.id === current.id || s.email === current.email);
            if (matchCurrent) {
              chosen = matchCurrent;
            }
          }
          setSelectedAgentId(chosen.id);
          setAgentPhone(chosen.phone || '081-604-0097');
          setAgentLine(chosen.line_id || '@chantakorn');
          setAgentFacebook(chosen.facebook || (chosen.role === 'ADMIN' ? DEFAULT_OFFICIAL_FACEBOOK : ''));
        }
      } catch (err) {
        console.warn('Error fetching staff list:', err);
      }
    }
    loadStaff();
  }, [editId]);

  // Handle manual selection of agent from dropdown
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const target = eligibleStaff.find(s => s.id === agentId);
    if (target) {
      setAgentPhone(target.phone || '081-604-0097');
      setAgentLine(target.line_id || '@chantakorn');
      setAgentFacebook(target.facebook || (target.role === 'ADMIN' ? DEFAULT_OFFICIAL_FACEBOOK : ''));
    }
  };

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
      setVideoUrl(property.video_url || '');
      setSelectedFeatures(property.features || []);
      setFeatured(property.featured || false);
      setSelectedAgentId(property.agent_id || property.agent?.id || '');
      setAgentPhone(property.agent?.phone || '081-604-0097');
      setAgentLine(property.agent?.line_id || '@chantakorn');
      setAgentFacebook(property.agent?.facebook || '');
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

  // Image Processing with Auto-Compression (up to 100MB per file)
  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (!validFiles.length) {
      setError('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WebP, HEIC/HEIF)');
      return;
    }
    const oversized = validFiles.filter(f => f.size > MAX_UPLOAD_IMAGE_SIZE_BYTES);
    if (oversized.length > 0) {
      setError(`ไฟล์ ${oversized.map(f => f.name).join(', ')} มีขนาดเกิน 100MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 100MB`);
      return;
    }
    if (images.length + validFiles.length > 60) {
      setError('สามารถเพิ่มรูปภาพได้สูงสุด 60 รูปต่อประกาศ');
      return;
    }

    setUploadingImages(true);
    setError('');
    setCompressionProgress({
      current: 0,
      total: validFiles.length,
    });

    try {
      const results = await compressMultipleImages(validFiles, (curr, total, item) => {
        setCompressionProgress({
          current: curr,
          total,
          currentName: item.name,
          originalSize: item.originalSizeFormatted,
          compressedSize: item.compressedSizeFormatted,
          percentSaved: item.percentSaved,
        });
      });

      const newPhotos = results.map(r => r.dataUrl);
      const newStats = results.map(r => ({
        url: r.dataUrl,
        origSize: r.originalSizeFormatted,
        compSize: r.compressedSizeFormatted,
        saved: r.percentSaved,
      }));

      setUploadStatsList(prev => [...prev, ...newStats]);
      setImages(prev => {
        const updated = [...prev, ...newPhotos];
        if (!coverImage && updated.length > 0) {
          setCoverImage(updated[0]);
        }
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผลและบีบอัดรูปภาพ');
    } finally {
      setUploadingImages(false);
      setTimeout(() => setCompressionProgress(null), 4000);
    }
  };

  // Video File Upload Handler (MP4, WebM, MOV up to 100MB)
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('กรุณาเลือกไฟล์วิดีโอที่ถูกต้อง (MP4, WebM, MOV)');
      return;
    }
    if (file.size > MAX_UPLOAD_VIDEO_SIZE_BYTES) {
      setError(`ไฟล์วิดีโอมีขนาด ${formatBytes(file.size)} ซึ่งเกินขนาดสูงสุด 100MB`);
      return;
    }

    setUploadingVideo(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const videoDataUrl = String(reader.result);
        setVideoUrl(videoDataUrl);
        setUploadingVideo(false);
      };
      reader.onerror = () => {
        setError('ไม่สามารถอ่านไฟล์วิดีโอได้');
        setUploadingVideo(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดวิดีโอ');
      setUploadingVideo(false);
    }
    e.target.value = '';
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

    // Permission enforcement: only ADMIN and AGENT
    const current = getStoredUser();
    if (current && current.role === 'USER') {
      setError('ขออภัย เฉพาะสมาชิกที่มียศ "แอดมิน" หรือ "นายหน้า" เท่านั้นที่สามารถบันทึกข้อมูลทรัพย์สินได้');
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
        phone: agentPhone.trim() || agentProfile?.phone || '081-604-0097',
        line_id: agentLine.trim() || agentProfile?.line_id || '@chantakorn',
        facebook: agentFacebook.trim() || agentProfile?.facebook || (resolvedRank === 'แอดมิน' ? DEFAULT_OFFICIAL_FACEBOOK : ''),
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
        video_url: videoUrl.trim() || undefined,
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

      {currentUserRole === 'USER' && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-xs sm:text-sm text-amber-900 flex items-start space-x-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950">จำกัดสิทธิ์การลงประกาศทรัพย์สิน (Role Restricted)</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              ขออภัย เฉพาะสมาชิกที่มียศ <strong>แอดมิน (ADMIN)</strong> และ <strong>นายหน้า (AGENT)</strong> เท่านั้นที่สามารถลงประกาศหรือแก้ไขข้อมูลทรัพย์สินได้ หากคุณต้องการลงทรัพย์ กรุณาติดต่อแอดมินเพื่อปรับยศบัญชีของคุณ
            </p>
          </div>
        </div>
      )}

      {currentUserRole && currentUserRole !== 'USER' && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center space-x-2 text-emerald-950 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>เข้าสู่ระบบด้วยยศ: <strong className="text-navy-950">{currentUserRole === 'ADMIN' ? '🛡️ แอดมิน (Admin)' : '👔 นายหน้า (Agent)'}</strong> — สามารถลงข้อมูลทรัพย์สินและระบุ LINE, Facebook และเบอร์โทรของตนเองได้</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
            สิทธิ์ได้รับอนุมัติ
          </span>
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
            { id: 'section-5-video', label: videoUrl ? '5. วิดีโอพาทัวร์ (มี)' : '5. วิดีโอพาทัวร์' },
            { id: 'section-6-agent', label: '6. นายหน้าผู้ดูแล' },
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

          {/* Auto-Discovered Nearby Landmarks Box */}
          {isValidLatLng(Number(latitude), Number(longitude)) && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-slate-50 to-gold-50/30 border border-gold-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-gold-600 flex-shrink-0" />
                  <h4 className="text-xs font-bold text-navy-950">
                    สถานที่สำคัญใกล้เคียงที่ค้นพบอัตโนมัติจากหมุดพิกัด ({Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAppendLandmarksToDescription}
                  className="px-3 py-1.5 bg-navy-950 hover:bg-navy-900 text-gold-400 text-[11px] font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>เเทรกสถานที่ใกล้เคียงลงในคำอธิบายประกาศ 1-Click</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {autoLandmarks.map((lm, idx) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-navy-100 text-navy-800 flex-shrink-0">
                        {lm.categoryLabel}
                      </span>
                      <span className="font-semibold text-navy-950 truncate">{lm.title}</span>
                    </div>
                    <span className="text-gold-700 font-extrabold text-[11px]">
                      {lm.combinedText}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

        {/* Section 4: Property Images (รองรับสูงสุด 100MB พร้อมระบบบีบอัดอัตโนมัติ Full HD) */}
        <div id="section-4-images" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-5 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-gold-600" />
                <span>4. รูปภาพทรัพย์สิน & แกลเลอรี (บีบอัดอัตโนมัติ Full HD รองรับไฟล์สูงสุด 100MB)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                เลือกรูปภาพที่มีความคมชัดสูง ระบบจะช่วยบีบอัดให้อัตโนมัติทันทีเพื่อให้เว็บโหลดเร็วและประหยัดพื้นที่
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setImages(SAMPLE_HOUSE_PHOTOS);
                  setCoverImage(SAMPLE_HOUSE_PHOTOS[0]);
                }}
                className="text-[11px] font-semibold text-gold-700 bg-gold-50 hover:bg-gold-100 px-3 py-1.5 rounded-xl border border-gold-200 transition-colors"
              >
                + ใส่รูปตัวอย่าง
              </button>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setImages([]);
                    setCoverImage('');
                  }}
                  className="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-xl border border-red-200 transition-colors"
                  title="ล้างรูปทั้งหมด"
                >
                  ล้างรูปทั้งหมด
                </button>
              )}
              <span className="text-xs font-bold text-navy-950 bg-gray-100 px-2.5 py-1 rounded-lg">
                {images.length} รูป
              </span>
            </div>
          </div>

          {/* Auto Compression Feature Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-950 flex items-start space-x-3 shadow-xs">
            <Gauge className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-emerald-900">⚡ ระบบบีบอัดรูปภาพอัตโนมัติ (Smart Auto-Compressor)</span>
                <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  รองรับ 100MB/รูป
                </span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                คุณสามารถเลือกไฟล์ภาพความละเอียดสูง (DSLR, มือถือ 4K/8K) ขนาดใหญ่สูงสุดถึง <strong>100MB ต่อไฟล์</strong> โดยระบบบนเบราว์เซอร์จะทำการรีไซส์และบีบอัดคุณภาพสูง (Full HD 1920px WebP/JPEG) ให้อัตโนมัติทันที ลดขนาดลงถึง <strong>90-98%</strong> โดยที่ภาพยังคงสวยคมชัด
              </p>
            </div>
          </div>

          {/* Real-time Compression Progress Indicator */}
          {compressionProgress && (
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-xs text-emerald-950 space-y-2.5 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center space-x-2 text-emerald-950">
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span>กำลังบีบอัดรูปภาพอัตโนมัติ: รูปที่ {compressionProgress.current} จาก {compressionProgress.total}</span>
                </span>
                <span className="text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-black">
                  {Math.round((compressionProgress.current / compressionProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-emerald-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(compressionProgress.current / compressionProgress.total) * 100}%` }}
                />
              </div>
              {compressionProgress.currentName && (
                <div className="flex flex-wrap items-center justify-between text-[11px] text-emerald-900 pt-0.5 font-medium">
                  <span className="truncate max-w-xs">{compressionProgress.currentName}</span>
                  <span>
                    ขนาด: <strong className="text-gray-700">{compressionProgress.originalSize}</strong> ➔ <strong className="text-emerald-700">{compressionProgress.compressedSize}</strong> (ประหยัด {compressionProgress.percentSaved}%)
                  </span>
                </div>
              )}
            </div>
          )}

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
              className="cursor-pointer flex flex-col items-center justify-center space-y-2.5"
            >
              {uploadingImages ? (
                <div className="flex flex-col items-center space-y-2 py-4">
                  <Loader2 className="w-8 h-8 text-gold-600 animate-spin" />
                  <p className="text-xs font-bold text-navy-950">กำลังบีบอัดและปรับคุณภาพรูปภาพ...</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-gold-100 text-gold-700 flex items-center justify-center shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-950 bg-gold-100 hover:bg-gold-200 px-4 py-2 rounded-xl transition-colors inline-block shadow-sm">
                      คลิกเลือกไฟล์รูปภาพจากเครื่อง
                    </span>
                    <span className="text-xs text-gray-500 block mt-2">
                      หรือลากไฟล์รูปภาพมาวางที่นี่ (รองรับ JPG, PNG, WebP สูงสุด <strong>100MB ต่อไฟล์</strong> ระบบจะบีบอัดให้อัตโนมัติ)
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
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-950 block">
                  รูปภาพทั้งหมด ({images.length} รูป) — คลิกปุ่มเพื่อตั้งเป็นรูปปกหลัก:
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>บีบอัดอัตโนมัติเรียบร้อย</span>
                </span>
              </div>
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
                        <div className="absolute top-1.5 left-1.5 bg-gold-500 text-navy-950 text-[10px] font-black px-2 py-0.5 rounded shadow-sm flex items-center space-x-1 z-10">
                          <Star className="w-3 h-3 fill-current" />
                          <span>หน้าปก</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCoverImage(img)}
                          className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/75 hover:bg-gold-500 hover:text-navy-950 text-white text-[10px] font-bold py-1 rounded transition-colors text-center opacity-0 group-hover:opacity-100 z-10"
                        >
                          ตั้งเป็นหน้าปก
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        title="ลบรูปภาพนี้"
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/75 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors shadow z-10"
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

        {/* Section 5: Property Video Tour (วิดีโอพาทัวร์อสังหาริมทรัพย์) */}
        <div id="section-5-video" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-5 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
                <Video className="w-4 h-4 text-red-600" />
                <span>5. วิดีโอพาทัวร์อสังหาริมทรัพย์ (Video Tour)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                ใส่วิดีโอพาทัวร์สถานที่จริงเพื่อดึงดูดลูกค้าและเพิ่มความน่าสนใจของประกาศ
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setVideoUrl('https://www.youtube.com/watch?v=ScMzIvxBSi4')}
                className="text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-200 transition-colors flex items-center space-x-1"
              >
                <Play className="w-3 h-3 fill-red-700" />
                <span>+ ทดลองใส่วิดีโอตัวอย่าง (YouTube)</span>
              </button>
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  className="text-[11px] font-semibold text-gray-600 hover:text-red-600 bg-gray-100 px-2.5 py-1.5 rounded-xl transition-colors"
                >
                  ลบวิดีโอ
                </button>
              )}
            </div>
          </div>

          {/* Helpful Tip */}
          <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-950 leading-relaxed flex items-start gap-2.5">
            <Film className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ช่องทางใส่วิดีโอที่รองรับ:</p>
              <p className="text-red-900 text-[11px] mt-0.5">
                รองรับลิงก์ <strong>YouTube</strong> (ลิงก์ทั่วไป, youtu.be, YouTube Shorts), <strong>TikTok</strong>, <strong>Facebook Video</strong>, ลิงก์ไฟล์ <strong>MP4</strong> โดยตรง หรือจะ<strong>อัปโหลดไฟล์วิดีโอจากเครื่อง</strong> (สูงสุด 100MB) ก็ได้เช่นกัน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Video inputs */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5 flex items-center justify-between">
                  <span>วางลิงก์วิดีโอ (YouTube / TikTok / Facebook / MP4 URL)</span>
                  <span className="text-[10px] text-gray-400 font-normal">ระบบจะตรวจจับอัตโนมัติ</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={videoUrl.startsWith('data:video/') ? '' : videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="เช่น https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pr-24 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition-all shadow-sm"
                  />
                  {videoUrl && !videoUrl.startsWith('data:video/') && (
                    <button
                      type="button"
                      onClick={() => setVideoUrl('')}
                      className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded bg-gray-100 hover:bg-red-50 transition-colors"
                    >
                      ล้างลิงก์
                    </button>
                  )}
                </div>
              </div>

              {/* Or Direct Video File Upload */}
              <div className="pt-2 border-t border-gray-100">
                <span className="block text-xs font-bold text-navy-950 mb-2">
                  หรือเลือกอัปโหลดไฟล์คลิปวิดีโอจากเครื่อง (สูงสุด 100MB):
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    id="property-video-file-upload"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg"
                    onChange={handleVideoFileUpload}
                    disabled={uploadingVideo}
                    className="sr-only"
                  />
                  <label
                    htmlFor="property-video-file-upload"
                    className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2.5 bg-navy-950 hover:bg-navy-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    {uploadingVideo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
                        <span>กำลังโหลดไฟล์วิดีโอ...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-gold-400" />
                        <span>เลือกไฟล์วิดีโอจากเครื่อง</span>
                      </>
                    )}
                  </label>

                  {videoUrl.startsWith('data:video/') && (
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>แนบไฟล์วิดีโอจากเครื่องเรียบร้อย</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  รองรับนามสกุล .mp4, .webm, .mov (ขนาดสูงสุด 100MB)
                </p>
              </div>
            </div>

            {/* Right 5 Cols: Live Video Preview */}
            <div className="lg:col-span-5">
              <span className="block text-xs font-bold text-navy-950 mb-2">
                ตัวอย่างการแสดงผลวิดีโอ (Live Preview):
              </span>

              {videoUrl ? (
                (() => {
                  const parsed = parseVideoUrl(videoUrl);
                  return (
                    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black aspect-video shadow-md relative group">
                      {parsed?.type === 'youtube' && parsed.embedUrl && (
                        <iframe
                          src={parsed.embedUrl}
                          title="YouTube Tour Preview"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}

                      {parsed?.type === 'direct' && (
                        <video controls preload="metadata" className="w-full h-full object-contain">
                          <source src={parsed.url} />
                          เบราว์เซอร์ไม่รองรับการเล่นวิดีโอนี้
                        </video>
                      )}

                      {(parsed?.type === 'tiktok' || parsed?.type === 'facebook' || parsed?.type === 'other') && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-white bg-slate-900 space-y-2">
                          <Film className="w-8 h-8 text-gold-400" />
                          <p className="text-xs font-bold">{parsed?.title || 'วิดีโอจากแพลตฟอร์มภายนอก'}</p>
                          <a
                            href={parsed?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] bg-gold-500 text-navy-950 px-3 py-1 rounded-lg font-bold"
                          >
                            เปิดดูวิดีโอ
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="aspect-video rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-4 text-center text-gray-400 space-y-2">
                  <Film className="w-8 h-8 text-gray-300" />
                  <p className="text-xs font-medium">ยังไม่มีวิดีโอพาทัวร์</p>
                  <p className="text-[10px] text-gray-400 max-w-xs">
                    วางลิงก์ YouTube หรืออัปโหลดไฟล์วิดีโอเพื่อแสดงตัวอย่างที่นี่
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: Responsible Agent (นายหน้าที่รับผิดชอบทรัพย์นี้ - อ้างอิงจากสมาชิกที่มียศ นายหน้า และ แอดมิน เท่านั้น และให้ใส่วิธีติดต่อของนายหน้าคนนั้นเอง) */}
        <div id="section-6-agent" className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm space-y-5 scroll-mt-28">
          <div className="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-navy-950 text-base flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-gold-600" />
              <span>6. ข้อมูลนายหน้าผู้ลงประกาศ & ช่องทางติดต่อตรง (เฉพาะยศแอดมิน และยศนายหน้า)</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>จำกัดสิทธิ์: ยศแอดมิน & ยศนายหน้า</span>
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">นโยบายช่องทางติดต่อนายหน้าผู้ลงทรัพย์:</p>
              <p className="text-blue-800 text-[11px] mt-0.5">
                เวลานายหน้าหรือแอดมินท่านใดลงข้อมูลทรัพย์ ให้ใส่ <strong>LINE</strong> และ <strong>Facebook</strong> ของนายหน้าคนนั้นเอง เพื่อให้ผู้ซื้อ/ผู้เช่าสามารถคลิกแชทหรือโทรติดต่อตรงกับนายหน้าผู้ดูแลได้ทันที
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 cols: Inputs for Agent Contact Channels */}
            <div className="lg:col-span-7 space-y-4">
              {/* Agent Picker */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5 flex items-center justify-between">
                  <span>เลือกนายหน้าผู้ดูแลประกาศนี้ *</span>
                  <span className="text-[10px] font-normal text-brand-muted">สมาชิกที่มียศ แอดมิน หรือ นายหน้า เท่านั้น</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => handleSelectAgent(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all shadow-sm"
                >
                  {eligibleStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.role === 'ADMIN' ? '🛡️ ยศ: แอดมิน' : '👔 ยศ: นายหน้า'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent Phone */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-gold-600" />
                  <span>เบอร์โทรศัพท์ของนายหน้าผู้ดูแลทรัพย์ *</span>
                </label>
                <input
                  type="tel"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  placeholder="เช่น 081-604-0097 หรือ 082-xxx-xxxx"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  💡 เบอร์โทรนี้จะเชื่อมต่อกับปุ่ม &quot;โทรด่วน&quot; บนหน้ารายละเอียดทรัพย์ให้ลูกค้ากดโทรหาทันที
                </p>
              </div>

              {/* Agent LINE */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5 flex items-center space-x-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#06C755]" />
                  <span>LINE ID หรือ ลิงก์ LINE ของนายหน้าคนนี้ *</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={agentLine}
                    onChange={(e) => setAgentLine(e.target.value)}
                    placeholder="เช่น @chantakorn หรือ benz_agent หรือ https://line.me/ti/p/~..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pr-20 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none transition-all"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <span className="text-[10px] font-bold bg-[#06C755]/10 text-[#06C755] px-2 py-0.5 rounded-md border border-[#06C755]/30">
                      LINE
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  💬 ลูกค้ากดปุ่ม &quot;LINE&quot; ระบบจะเปิดห้องแชทหา LINE ของนายหน้าคนนี้โดยตรง
                </p>
              </div>

              {/* Agent Facebook */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1.5 flex items-center space-x-1.5">
                  <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
                  <span>ลิงก์ Facebook หรือเพจเฟสบุ๊คของนายหน้าคนนี้ *</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={agentFacebook}
                    onChange={(e) => setAgentFacebook(e.target.value)}
                    placeholder="เช่น https://www.facebook.com/yourname หรือ ลิงก์เพจเฟสบุ๊ค"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pr-20 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#1877F2] outline-none transition-all"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <span className="text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] px-2 py-0.5 rounded-md border border-[#1877F2]/30">
                      Facebook
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  🌐 เวลานายหน้าคนไหนลงข้อมูล ให้ใส่ Facebook ของตนเอง หรือปล่อยว่างเพื่อใช้ Facebook เพจหลัก
                </p>
              </div>

              {/* Publishing & Featured Toggles */}
              <div className="pt-3 border-t border-gray-100 space-y-2.5">
                <label className="flex items-center space-x-2 text-xs font-bold text-navy-950 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={published} 
                    onChange={e => setPublished(e.target.checked)} 
                    className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500"
                  />
                  <span>เผยแพร่ประกาศบนเว็บไซต์ทันที (เปิดให้บุคคลทั่วไปเข้าดู)</span>
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

            {/* Right 5 cols: Live Preview Card of Agent Contacts as seen on the detail page */}
            <div className="lg:col-span-5 bg-gradient-to-b from-navy-950 to-navy-900 text-white rounded-2xl p-5 border border-navy-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-navy-800/80">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-gold-400">
                  <Eye className="w-3.5 h-3.5" />
                  <span>ตัวอย่างแสดงผลบนหน้าเว็บ (Live Preview)</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                  แสดงข้อมูลจริง
                </span>
              </div>

              {/* Agent Profile Header */}
              <div className="flex items-center space-x-3.5">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-navy-800 flex-shrink-0 border-2 border-gold-400 shadow-md">
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

                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white">
                    {currentAssignedStaff?.full_name || 'คุณฉันทากร นวลจันทร์ (เบนซ์)'}
                  </h4>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    currentAssignedStaff?.role === 'ADMIN'
                      ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  }`}>
                    {currentAssignedStaff?.role === 'ADMIN' ? '🛡️ ยศ: แอดมิน (Admin)' : '👔 ยศ: นายหน้า (Agent)'}
                  </span>
                  <p className="text-[11px] text-gray-400">
                    {currentAssignedStaff?.role === 'ADMIN' ? 'ผู้ดูแลระบบและที่ปรึกษา' : 'ตัวแทนนายหน้าผู้รับผิดชอบทรัพย์นี้'}
                  </p>
                </div>
              </div>

              {/* Contact Buttons as seen by customers */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="p-2 rounded-xl bg-navy-800/90 border border-navy-700 text-center">
                  <Phone className="w-3.5 h-3.5 text-gold-400 mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-white">โทร</span>
                  <span className="block text-[9px] text-gray-400 truncate" title={agentPhone}>
                    {agentPhone || '081-604-0097'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[#06C755]/15 border border-[#06C755]/30 text-center">
                  <MessageCircle className="w-3.5 h-3.5 text-[#06C755] mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-[#06C755]">LINE</span>
                  <span className="block text-[9px] text-gray-300 truncate" title={agentLine}>
                    {agentLine || '@chantakorn'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/30 text-center">
                  <Facebook className="w-3.5 h-3.5 text-[#1877F2] mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-[#1877F2]">Facebook</span>
                  <span className="block text-[9px] text-gray-300 truncate" title={agentFacebook || 'เพจหลัก'}>
                    {agentFacebook ? 'เฟสนายหน้า' : 'เพจหลัก'}
                  </span>
                </div>
              </div>

              {/* Contact Detail Card */}
              <div className="bg-navy-900/90 rounded-xl p-3 border border-navy-800 text-[11px] space-y-1.5 text-gray-300">
                <div className="flex justify-between items-center text-[10px] text-gold-400 font-bold uppercase tracking-wider pb-1 border-b border-navy-800">
                  <span>ข้อมูลติดต่อที่จะแสดงบนประกาศ</span>
                  <ShieldCheck className="w-3 h-3 text-gold-400" />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">📞 เบอร์โทร:</span>
                  <span className="font-bold text-white">{agentPhone || '081-604-0097'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">💬 LINE:</span>
                  <span className="font-semibold text-emerald-400 max-w-[140px] truncate">{agentLine || '@chantakorn'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">🌐 Facebook:</span>
                  <span className="font-semibold text-blue-400 max-w-[140px] truncate">
                    {agentFacebook ? 'ลิงก์เฟสบุ๊คนายหน้า' : 'Chantakorn Property'}
                  </span>
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
