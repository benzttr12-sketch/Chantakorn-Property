'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Coins, 
  Layers, 
  FileText, 
  Compass, 
  Crosshair, 
  TrendingUp, 
  Award, 
  Share2, 
  Copy, 
  Check, 
  HelpCircle, 
  Info,
  DollarSign,
  ArrowRight,
  Send
} from 'lucide-react';
import { DISTRICTS_LIST } from '@/lib/utils';
import { 
  generateLandsMapsParcelInfo, 
  estimateTreasuryAppraisalRate, 
  sqWahToRaiNganWah,
  calculateLandTransferFees 
} from '@/lib/landsmaps';

// Default Hat Yai Center Coords
const HAT_YAI_COORDS = {
  'หาดใหญ่': { lat: 7.0084, lng: 100.4705 },
  'เมืองสงขลา': { lat: 7.1982, lng: 100.5951 },
  'สะเดา': { lat: 6.6384, lng: 100.4221 },
  'บางกล่ำ': { lat: 7.0851, lng: 100.4120 },
  'ควนเนียง': { lat: 7.1852, lng: 100.3621 },
  'สิงหนคร': { lat: 7.2281, lng: 100.5621 },
  'จะนะ': { lat: 6.9182, lng: 100.7381 },
};

export default function AutoPinLandsMapsValuation() {
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('คอหงส์');
  const [propertyType, setPropertyType] = useState('land'); // land, house, condo, commercial
  const [landSizeSqWah, setLandSizeSqWah] = useState<number>(80);
  const [usableAreaSqM, setUsableAreaSqM] = useState<number>(200);
  const [buildingAgeYears, setBuildingAgeYears] = useState<number>(3);
  
  // Coordinates for auto-pin
  const [lat, setLat] = useState<number>(7.0084);
  const [lng, setLng] = useState<number>(100.4705);
  const [chanoteNo, setChanoteNo] = useState<string>('45892');
  
  const [isLocating, setIsLocating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOwnedOver5Years, setIsOwnedOver5Years] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize interactive Leaflet map for Auto-Pin
  useEffect(() => {
    let isMounted = true;

    async function initLeafletMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: 'custom-landsmaps-pin',
        html: `
          <div style="background-color: #020b18; color: #facc15; border: 2px solid #eab308; border-radius: 9999px; padding: 6px 10px; font-weight: 800; font-size: 11px; display: flex; align-items: center; gap: 4px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); transform: translate(-50%, -100%);">
            <span>📍 หมุดโฉนด DOL</span>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 36],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      // Handle marker drag end to update lat/lng
      marker.on('dragend', (e: any) => {
        const position = e.target.getLatLng();
        setLat(Number(position.lat.toFixed(5)));
        setLng(Number(position.lng.toFixed(5)));
      });

      // Handle map click to re-pin automatically
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const newLat = Number(clickLat.toFixed(5));
        const newLng = Number(clickLng.toFixed(5));
        setLat(newLat);
        setLng(newLng);
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        }
      });

      mapInstanceRef.current = map;
    }

    initLeafletMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when district or GPS changes
  const updateMapPin = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 14);
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
    }
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const coords = HAT_YAI_COORDS[newDistrict as keyof typeof HAT_YAI_COORDS] || HAT_YAI_COORDS['หาดใหญ่'];
    updateMapPin(coords.lat, coords.lng);
  };

  const handleAutoGPSLocate = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์นี้ไม่รองรับระบบระบุพิกัด GPS');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const gpsLat = Number(pos.coords.latitude.toFixed(5));
        const gpsLng = Number(pos.coords.longitude.toFixed(5));
        updateMapPin(gpsLat, gpsLng);
      },
      () => {
        setIsLocating(false);
        alert('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์');
      },
      { timeout: 10000 }
    );
  };

  // --- VALUATION COMPUTATION ENGINE ---
  const treasuryRatePerSqWah = estimateTreasuryAppraisalRate(district, subdistrict);
  const totalTreasuryAppraisal = Math.round((landSizeSqWah || 0) * treasuryRatePerSqWah);

  // Market multiplier based on property type & district
  let marketPricePerSqWah = treasuryRatePerSqWah * 1.5;
  if (propertyType === 'house') marketPricePerSqWah = treasuryRatePerSqWah * 1.8 + (usableAreaSqM * 12000) / (landSizeSqWah || 1);
  if (propertyType === 'condo') marketPricePerSqWah = treasuryRatePerSqWah * 2.2 + (usableAreaSqM * 18000) / (landSizeSqWah || 1);
  if (propertyType === 'commercial') marketPricePerSqWah = treasuryRatePerSqWah * 2.5 + (usableAreaSqM * 15000) / (landSizeSqWah || 1);

  const estimatedMarketTotal = Math.round(marketPricePerSqWah * (landSizeSqWah || 1));
  const marketLow = Math.round(estimatedMarketTotal * 0.88);
  const marketHigh = Math.round(estimatedMarketTotal * 1.15);

  const estimatedMonthlyRent = Math.round((estimatedMarketTotal * 0.055) / 12);
  const estimatedAnnualYield = 5.5;

  const transferFees = calculateLandTransferFees(estimatedMarketTotal, totalTreasuryAppraisal, isOwnedOver5Years);
  const parcelInfo = generateLandsMapsParcelInfo(
    'valuation_calc',
    district,
    'สงขลา',
    subdistrict,
    landSizeSqWah,
    estimatedMarketTotal,
    lat,
    lng,
    chanoteNo
  );

  const handleCopyValuationReport = () => {
    const reportText = [
      `🏠 รายงานประเมินราคาอสังหาริมทรัพย์ & ที่ดิน (Chantakorn Valuation & DOL LandsMaps)`,
      `ทำเล: ต.${subdistrict} อ.${district} จ.สงขลา (พิกัด GPS: ${lat}, ${lng})`,
      `ประเภท: ${propertyType === 'land' ? 'ที่ดินเปล่า' : propertyType === 'house' ? 'บ้าน / ทาวน์โฮม' : propertyType === 'condo' ? 'คอนโดมิเนียม' : 'อาคารพาณิชย์'}`,
      `เนื้อที่: ${landSizeSqWah} ตร.ว. | พื้นที่ใช้สอย: ${usableAreaSqM} ตร.ม.`,
      `----------------------------------------------`,
      `💰 ราคาประเมินทุนทรัพย์ราชการ (กรมธนารักษ์): ฿${treasuryRatePerSqWah.toLocaleString()} / ตร.ว. (รวม ฿${totalTreasuryAppraisal.toLocaleString()})`,
      `📈 ประเมินราคาขายตลาดสากล: ฿${marketLow.toLocaleString()} - ฿${marketHigh.toLocaleString()} (เฉลี่ย ฿${estimatedMarketTotal.toLocaleString()})`,
      `🔑 ประมาณการค่าเช่า: ฿${estimatedMonthlyRent.toLocaleString()} / เดือน (Yield ~${estimatedAnnualYield}%)`,
      `🏛️ สรุปค่าโอน ณ กรมที่ดินประเมิน: ฿${transferFees.totalDepartmentOfLandsFees.toLocaleString()}`,
      `🌐 ตรวจสอบรูปแปลงโฉนดที่ดินจริงบน DOL LandsMaps: ${parcelInfo.landsmapsUrl}`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gold-500/30 shadow-xl overflow-hidden space-y-0">
      
      {/* Top Header */}
      <div className="bg-gradient-to-r from-navy-950 via-blue-950 to-navy-900 p-6 sm:p-8 text-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-gold-500 text-navy-950 text-[10px] font-black uppercase tracking-wider">
                DOL LandsMaps AI Engine
              </span>
              <span className="text-xs text-gold-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>อ้างอิงฐานข้อมูลกรมที่ดิน & กรมธนารักษ์</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 leading-tight">
              ระบบประเมินราคาที่ดิน & ปักหมุดโฉนดอัตโนมัติ
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
              เลือกทำเลและปักหมุดบนแผนที่เพื่อคำนวณราคาประเมินราชการ, ราคาตลาดหาดใหญ่–สงขลา, ภาษีค่าโอน ณ กรมที่ดิน และลิงก์รูปแปลงบน https://landsmaps.dol.go.th/
            </p>
          </div>

          <a
            href={parcelInfo.landsmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-400 hover:to-gold-400 text-navy-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg border border-gold-300 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 flex-shrink-0"
          >
            <span>🌐 เปิดดูรูปแปลงที่ดินจริงบน DOL LandsMaps</span>
            <ExternalLink className="w-4 h-4 text-navy-950" />
          </a>
        </div>
      </div>

      {/* Main Grid: Controls + Interactive Auto-Pin Map */}
      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-navy-950 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-gold-600" />
              <span>ระบุสเปกทรัพย์และทำเลที่ดิน</span>
            </h3>
            <button
              type="button"
              onClick={handleAutoGPSLocate}
              disabled={isLocating}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Crosshair className={`w-3.5 h-3.5 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'กำลังค้นหา GPS...' : 'ปักหมุด GPS'}</span>
            </button>
          </div>

          {/* Property Type Selector */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">ประเภทอสังหาริมทรัพย์</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'land', label: 'ที่ดินเปล่า', icon: '🏕️' },
                { id: 'house', label: 'บ้าน / ทาวน์โฮม', icon: '🏡' },
                { id: 'condo', label: 'คอนโดมิเนียม', icon: '🏢' },
                { id: 'commercial', label: 'อาคารพาณิชย์', icon: '🏬' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPropertyType(t.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    propertyType === t.id
                      ? 'bg-navy-950 text-gold-400 border-navy-950 shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">อำเภอ (จ.สงขลา)</label>
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none cursor-pointer"
              >
                {DISTRICTS_LIST.map((dist) => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">ตำบล / ย่าน</label>
              <input
                type="text"
                value={subdistrict}
                onChange={(e) => setSubdistrict(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="เช่น คอหงส์, คลองแห"
              />
            </div>
          </div>

          {/* Land Size & Usable Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">เนื้อที่ดิน (ตารางวา)</label>
              <input
                type="number"
                value={landSizeSqWah}
                onChange={(e) => setLandSizeSqWah(Number(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="80"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">เลขที่โฉนดที่ดิน (ถ้ามี)</label>
              <input
                type="text"
                value={chanoteNo}
                onChange={(e) => setChanoteNo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="45892"
              />
            </div>
          </div>

          {/* Coordinates Auto-Pin Display */}
          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-gold-300 text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-navy-950">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gold-600" />
                <span>พิกัดหมุดบนแผนที่ (Auto-Pin Coordinates)</span>
              </span>
              <span className="text-[10px] text-gray-500">ลากหมุดเพื่อปรับตำแหน่งได้</span>
            </div>
            <div className="font-mono text-xs font-black text-navy-950">
              Latitude: {lat} | Longitude: {lng}
            </div>
          </div>
        </div>

        {/* Right Auto-Pin Interactive Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-navy-950 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-navy-900" />
              <span>แผนที่หมุดระวางโฉนด DOL (คลิกบนแผนที่เพื่อปักหมุดตำแหน่งที่ดิน)</span>
            </label>
            <span className="text-[10px] text-gray-500 font-semibold">
              อัปเดตตำแหน่งพิกัดแบบเรียลไทม์
            </span>
          </div>

          <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden border border-gray-300 shadow-inner bg-gray-100">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Map Overlay Badge */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-navy-950/90 backdrop-blur-xs text-white p-2.5 rounded-xl border border-gold-500/40 text-[11px] shadow-lg flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <div>
                <div className="font-extrabold text-gold-300">ตำแหน่งหมุด: {district}, {subdistrict}</div>
                <div className="text-[10px] text-gray-300">ระวางโฉนด #{chanoteNo} | DOL LandsMaps Ready</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* VALUATION RESULTS SUMMARY SECTION */}
      <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-navy-950 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-600" />
              <span>ผลสรุปการประเมินราคา & ค่าโอน ณ สำนักงานที่ดิน</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              การประเมินวิเคราะห์ตามฐานกรมธนารักษ์และแนวโน้มซื้อขายจริงโซน {district}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyValuationReport}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-navy-950 font-bold text-xs rounded-xl border border-gray-300 shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              <span>{copied ? 'คัดลอกรายงานแล้ว' : 'คัดลอกรายงานประเมิน'}</span>
            </button>

            <a
              href={parcelInfo.landsmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md border border-gold-500/30 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>🌐 ตรวจรูปแปลงจริงบน DOL</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Treasury Official Appraisal */}
          <div className="bg-white p-5 rounded-2xl border border-gold-300 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">1. ราคาประเมินราชการ</span>
              <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                กรมธนารักษ์
              </span>
            </div>
            <div className="text-xl font-black text-navy-950">
              ฿{totalTreasuryAppraisal.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-gold-700">
              ฿{treasuryRatePerSqWah.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">/ ตร.ว.</span>
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              ฐานประเมินทุนทรัพย์ที่ดินสำหรับคิดค่าธรรมเนียมโอน
            </p>
          </div>

          {/* Card 2: Estimated Market Value */}
          <div className="bg-navy-950 text-white p-5 rounded-2xl border border-gold-500/40 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gold-300">2. ราคาประเมินตลาดสากล</span>
              <span className="bg-gold-500 text-navy-950 text-[9px] font-black px-2 py-0.5 rounded">
                Market Avg
              </span>
            </div>
            <div className="text-xl font-black text-gold-400">
              ฿{estimatedMarketTotal.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-300">
              ช่วงราคา: ฿{marketLow.toLocaleString()} - ฿{marketHigh.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-navy-800">
              ประเมินจากแนวโน้มราคาซื้อขายจริงในโซน {district}
            </p>
          </div>

          {/* Card 3: Department of Lands Transfer Fees */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">3. ค่าธรรมเนียม & ภาษีโอน</span>
              <span className="bg-blue-100 text-blue-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                กรมที่ดิน
              </span>
            </div>
            <div className="text-xl font-black text-navy-950">
              ฿{transferFees.totalDepartmentOfLandsFees.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-600">
              โอน 2%: ฿{transferFees.transferFee.toLocaleString()} | อากร: ฿{transferFees.stampDutyOrBusinessTax.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              ประมาณการค่าใช้จ่ายสุทธิ ณ สำนักงานที่ดิน
            </p>
          </div>

          {/* Card 4: Rental Yield & Income */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">4. ศักยภาพการปล่อยเช่า</span>
              <span className="bg-emerald-100 text-emerald-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                Yield ~{estimatedAnnualYield}%
              </span>
            </div>
            <div className="text-xl font-black text-emerald-700">
              ฿{estimatedMonthlyRent.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ เดือน</span>
            </div>
            <div className="text-xs font-medium text-gray-600">
              ประมาณการรายได้เช่าปีละ ~฿{(estimatedMonthlyRent * 12).toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              อัตราผลตอบแทนจากการลงทุนเฉลี่ยในทำเล
            </p>
          </div>

        </div>

        {/* Official Reference Verification Banner */}
        <div className="bg-white p-4 rounded-2xl border border-gold-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-gold-600 flex-shrink-0" />
            <div>
              <span className="font-extrabold text-navy-950">อ้างอิงข้อมูลทางการจากเว็บไซต์ระบบค้นหารูปแปลงที่ดิน กรมที่ดิน:</span>
              <a
                href={parcelInfo.landsmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-bold hover:underline ml-1.5 inline-flex items-center gap-1"
              >
                <span>https://landsmaps.dol.go.th/</span>
                <ExternalLink className="w-3 h-3 text-blue-600" />
              </a>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 font-medium">
            * ผลประเมินเบื้องต้นเพื่อใช้เป็นแนวทางอ้างอิงในการซื้อขายและตั้งราคาประกาศ
          </div>
        </div>

      </div>

    </div>
  );
}
