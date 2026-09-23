/**
 * Utility for calculating and finding nearby landmarks & places of interest (Songkhla & Hat Yai)
 * Uses Haversine distance formula + estimated drive/walk times
 * With online OpenStreetMap Overpass API search capability + curated fallback database
 */

export interface LandmarkItem {
  id: string;
  name: string;
  nameEn?: string;
  category: 'education' | 'hospital' | 'shopping' | 'transport' | 'attraction' | 'government' | 'other';
  categoryLabel: string;
  lat: number;
  lng: number;
}

export interface NearbyLandmarkResult {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  distanceKm: number;
  formattedDistance: string;
  estimatedTime: string;
  combinedText: string;
}

// ฐานข้อมูลสถานที่สำคัญหลักในจังหวัดสงขลา (หาดใหญ่, เมืองสงขลา, สะเดา, ควนลัง, คลองแห, เกาะยอ ฯลฯ)
export const SONGKHLA_MAJOR_LANDMARKS: LandmarkItem[] = [
  // 1. สถานศึกษา (Education)
  { id: 'psu-hatyai', name: 'มหาวิทยาลัยสงขลานครินทร์ (ม.อ. หาดใหญ่)', category: 'education', categoryLabel: 'การศึกษา', lat: 7.0086, lng: 100.4984 },
  { id: 'hu-hatyai', name: 'มหาวิทยาลัยหาดใหญ่ (HU)', category: 'education', categoryLabel: 'การศึกษา', lat: 6.9780, lng: 100.4625 },
  { id: 'skru-mueang', name: 'มหาวิทยาลัยราชภัฏสงขลา', category: 'education', categoryLabel: 'การศึกษา', lat: 7.1702, lng: 100.6120 },
  { id: 'rmutsv-mueang', name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย', category: 'education', categoryLabel: 'การศึกษา', lat: 7.1818, lng: 100.5982 },
  { id: 'yorwor-school', name: 'โรงเรียนหาดใหญ่วิทยาลัย (ญ.ว.)', category: 'education', categoryLabel: 'การศึกษา', lat: 7.0182, lng: 100.4788 },
  { id: 'saengthong-school', name: 'โรงเรียนแสงทองวิทยา', category: 'education', categoryLabel: 'การศึกษา', lat: 7.0035, lng: 100.4720 },
  { id: 'thammawit-school', name: 'โรงเรียนธรรมวิทยามูลนิธิ', category: 'education', categoryLabel: 'การศึกษา', lat: 7.0012, lng: 100.4650 },
  { id: 'yorwor2-school', name: 'โรงเรียนหาดใหญ่วิทยาลัย 2', category: 'education', categoryLabel: 'การศึกษา', lat: 6.9550, lng: 100.3880 },

  // 2. โรงพยาบาล & ศูนย์การแพทย์ (Hospitals)
  { id: 'psu-hospital', name: 'โรงพยาบาลสงขลานครินทร์ (รพ.ม.อ.)', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.0089, lng: 100.4965 },
  { id: 'bangkok-hospital-hy', name: 'โรงพยาบาลกรุงเทพหาดใหญ่', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.0125, lng: 100.4851 },
  { id: 'rajyindee-hospital', name: 'โรงพยาบาลราษฎร์ยินดี', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.0012, lng: 100.4800 },
  { id: 'hatyai-hospital', name: 'โรงพยาบาลหาดใหญ่', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.0162, lng: 100.4682 },
  { id: 'sikarin-hospital-hy', name: 'โรงพยาบาลศิครินทร์ หาดใหญ่', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.0255, lng: 100.4750 },
  { id: 'songkhla-hospital', name: 'โรงพยาบาลสงขลา (เกาะยอ)', category: 'hospital', categoryLabel: 'การแพทย์', lat: 7.1550, lng: 100.5650 },

  // 3. ห้างสรรพสินค้า & ตลาด (Shopping & Markets)
  { id: 'central-hatyai', name: 'เซ็นทรัล หาดใหญ่ (Central Hatyai)', category: 'shopping', categoryLabel: 'ห้างสรรพสินค้า', lat: 6.9934, lng: 100.4842 },
  { id: 'kim-yong-market', name: 'ตลาดกิมหยง หาดใหญ่', category: 'shopping', categoryLabel: 'ตลาด & ช้อปปิ้ง', lat: 7.0076, lng: 100.4688 },
  { id: 'asean-night-bazaar', name: 'ตลาดนัดอาเซียนเทรด (Asean Night Bazaar)', category: 'shopping', categoryLabel: 'ตลาด & ช้อปปิ้ง', lat: 6.9972, lng: 100.4835 },
  { id: 'greenway-night-market', name: 'ตลาดนัดกรีนเวย์ (Greenway Night Market)', category: 'shopping', categoryLabel: 'ตลาด & ช้อปปิ้ง', lat: 6.9985, lng: 100.4850 },
  { id: 'bigc-extra-hy', name: 'บิ๊กซี เอ็กซ์ตร้า หาดใหญ่ (ถนน 30 เมตร)', category: 'shopping', categoryLabel: 'ห้างสรรพสินค้า', lat: 7.0135, lng: 100.4832 },
  { id: 'lotus-psu', name: 'โลตัส หาดใหญ่ 1 (หน้า ม.อ.)', category: 'shopping', categoryLabel: 'ห้างสรรพสินค้า', lat: 7.0032, lng: 100.4930 },
  { id: 'makro-hatyai', name: 'แม็คโคร หาดใหญ่', category: 'shopping', categoryLabel: 'ห้างสรรพสินค้า', lat: 6.9890, lng: 100.4820 },
  { id: 'plaza-hatyai', name: 'ตลาดพลาซ่าหาดใหญ่ & หอนาฬิกา', category: 'shopping', categoryLabel: 'ตลาด & ช้อปปิ้ง', lat: 7.0062, lng: 100.4645 },
  { id: 'khlonghae-floating-market', name: 'ตลาดน้ำคลองแห', category: 'shopping', categoryLabel: 'ตลาด & ช้อปปิ้ง', lat: 7.0465, lng: 100.4740 },
  { id: 'bigc-khuanlang', name: 'บิ๊กซี หาดใหญ่ 2 (ควนลัง)', category: 'shopping', categoryLabel: 'ห้างสรรพสินค้า', lat: 6.9852, lng: 100.4420 },

  // 4. การเดินทาง & สถานีขนส่ง (Transport)
  { id: 'hdy-airport', name: 'สนามบินนานาชาติหาดใหญ่ (HDY)', category: 'transport', categoryLabel: 'การเดินทาง', lat: 6.9332, lng: 100.3933 },
  { id: 'train-station-hy', name: 'สถานีรถไฟชุมทางหาดใหญ่', category: 'transport', categoryLabel: 'การเดินทาง', lat: 7.0038, lng: 100.4670 },
  { id: 'bus-terminal-hy', name: 'สถานีขนส่งผู้โดยสารหาดใหญ่ (บขส.)', category: 'transport', categoryLabel: 'การเดินทาง', lat: 6.9945, lng: 100.4818 },
  { id: 'sadao-border-customs', name: 'ด่านชายแดนสะเดา-มาเลเซีย (ด่านนอก)', category: 'transport', categoryLabel: 'การเดินทาง', lat: 6.5225, lng: 100.4215 },

  // 5. สถานที่ท่องเที่ยว & พักผ่อน (Attractions & Parks)
  { id: 'hatyai-park-khohong', name: 'สวนสาธารณะเทศบาลนครหาดใหญ่ (เขาคอหงส์)', category: 'attraction', categoryLabel: 'สวนสาธารณะ', lat: 7.0385, lng: 100.5090 },
  { id: 'samila-beach', name: 'แหลมสมิหลา & รูปปั้นนางเงือกทอง (สงขลา)', category: 'attraction', categoryLabel: 'สถานที่ท่องเที่ยว', lat: 7.2185, lng: 100.5975 },
  { id: 'chalatat-beach', name: 'หาดชลาทัศน์ เมืองสงขลา', category: 'attraction', categoryLabel: 'สถานที่ท่องเที่ยว', lat: 7.2025, lng: 100.6012 },
  { id: 'songkhla-old-town', name: 'ย่านเมืองเก่าสงขลา (ถนนนางงาม - นครนอก)', category: 'attraction', categoryLabel: 'สถานที่ท่องเที่ยว', lat: 7.1982, lng: 100.5888 },
  { id: 'tin-bridge-kohyo', name: 'สะพานติณสูลานนท์ & เกาะยอ', category: 'attraction', categoryLabel: 'สถานที่ท่องเที่ยว', lat: 7.1482, lng: 100.5562 },
  { id: 'songkhla-zoo', name: 'สวนสัตว์สงขลา', category: 'attraction', categoryLabel: 'สถานที่ท่องเที่ยว', lat: 7.1580, lng: 100.6020 },

  // 6. หน่วยงานราชการ & นิคม (Government & Industrial)
  { id: 'songkhla-provincial-hall', name: 'ศาลากลางจังหวัดสงขลา', category: 'government', categoryLabel: 'สถานที่ราชการ', lat: 7.2065, lng: 100.5910 },
  { id: 'hatyai-city-hall', name: 'เทศบาลนครหาดใหญ่', category: 'government', categoryLabel: 'สถานที่ราชการ', lat: 7.0145, lng: 100.4725 },
  { id: 'chalong-industrial-estate', name: 'นิคมอุตสาหกรรมภาคใต้ (ฉลุง)', category: 'government', categoryLabel: 'นิคมอุตสาหกรรม', lat: 6.9380, lng: 100.3320 },
  { id: 'songkhla-deep-sea-port', name: 'ท่าเรือน้ำลึกสงขลา (สิงหนคร)', category: 'government', categoryLabel: 'โลจิสติกส์', lat: 7.2280, lng: 100.5750 },
];

/**
 * คำนวณระยะทางตรงระหว่างพิกัด 2 จุดโดยใช้สูตร Haversine (กิโลเมตร)
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100;
}

/**
 * แปลงระยะทางกิโลเมตร เป็นรูปแบบเวลาเดินทางและข้อความภาษาไทย
 */
export function formatTravelEstimate(distanceKm: number): { formattedDistance: string; estimatedTime: string; combinedText: string } {
  let formattedDistance = '';
  let estimatedTime = '';

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    formattedDistance = `${meters} เมตร`;
    const walkMinutes = Math.max(1, Math.round(meters / 80)); // ~80m / min walk
    estimatedTime = `เดินประมาณ ${walkMinutes} นาที`;
  } else if (distanceKm <= 3) {
    formattedDistance = `${distanceKm.toFixed(1)} กม.`;
    const driveMinutes = Math.max(2, Math.round(distanceKm * 2.5)); // ~25-30 km/h in city
    estimatedTime = `ขับรถ ${driveMinutes} นาที`;
  } else if (distanceKm <= 10) {
    formattedDistance = `${distanceKm.toFixed(1)} กม.`;
    const driveMinutes = Math.round(distanceKm * 2); // ~35 km/h
    estimatedTime = `ขับรถ ${driveMinutes} นาที`;
  } else {
    formattedDistance = `${distanceKm.toFixed(1)} กม.`;
    const driveMinutes = Math.round(distanceKm * 1.5); // ~40-50 km/h highway
    estimatedTime = `ขับรถ ${driveMinutes} นาที`;
  }

  const combinedText = `${formattedDistance} (${estimatedTime})`;
  return { formattedDistance, estimatedTime, combinedText };
}

/**
 * คำนวณสถานที่สำคัญใกล้เคียงจากพิกัด (Latitude, Longitude) อัตโนมัติ
 */
export function calculateNearbyLandmarks(
  lat: number,
  lng: number,
  options: { limit?: number; maxDistanceKm?: number } = {}
): NearbyLandmarkResult[] {
  const { limit = 8, maxDistanceKm = 40 } = options;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return [];
  }

  // คำนวณระยะทางไปยังสถานที่สำคัญทั้งหมด
  const list = SONGKHLA_MAJOR_LANDMARKS.map(item => {
    const distanceKm = haversineDistanceKm(lat, lng, item.lat, item.lng);
    const estimate = formatTravelEstimate(distanceKm);
    return {
      id: item.id,
      title: item.name,
      category: item.category,
      categoryLabel: item.categoryLabel,
      distanceKm,
      formattedDistance: estimate.formattedDistance,
      estimatedTime: estimate.estimatedTime,
      combinedText: estimate.combinedText,
    };
  })
  .filter(item => item.distanceKm <= maxDistanceKm)
  .sort((a, b) => a.distanceKm - b.distanceKm);

  return list.slice(0, limit);
}

/**
 * ค้นหาสถานที่สำคัญจาก OpenStreetMap Overpass API แบบ Real-Time (พร้อม Fallback ถ้าระบบออฟไลน์)
 */
export async function fetchLiveNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters: number = 3000
): Promise<NearbyLandmarkResult[]> {
  try {
    const query = `
      [out:json][timeout:5];
      (
        node["amenity"~"hospital|clinic|school|university|mall|supermarket|bank"](around:${radiusMeters},${lat},${lng});
        way["amenity"~"hospital|clinic|school|university|mall|supermarket|bank"](around:${radiusMeters},${lat},${lng});
        node["tourism"~"attraction|theme_park|zoo"](around:${radiusMeters},${lat},${lng});
      );
      out center 12;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.elements) && data.elements.length > 0) {
        const liveResults: NearbyLandmarkResult[] = [];
        const seenNames = new Set<string>();

        for (const el of data.elements) {
          const tags = el.tags || {};
          const name = tags['name:th'] || tags.name;
          if (!name || seenNames.has(name.trim())) continue;
          seenNames.add(name.trim());

          const eLat = el.lat || el.center?.lat;
          const eLng = el.lon || el.center?.lon;
          if (!eLat || !eLng) continue;

          const distanceKm = haversineDistanceKm(lat, lng, eLat, eLng);
          const estimate = formatTravelEstimate(distanceKm);

          let cat = 'other';
          let catLabel = 'สถานที่ใกล้เคียง';
          if (tags.amenity === 'school' || tags.amenity === 'university') { cat = 'education'; catLabel = 'การศึกษา'; }
          else if (tags.amenity === 'hospital' || tags.amenity === 'clinic') { cat = 'hospital'; catLabel = 'การแพทย์'; }
          else if (tags.amenity === 'mall' || tags.amenity === 'supermarket') { cat = 'shopping'; catLabel = 'ห้าง/ตลาด'; }

          liveResults.push({
            id: `osm-${el.id}`,
            title: name.trim(),
            category: cat,
            categoryLabel: catLabel,
            distanceKm,
            formattedDistance: estimate.formattedDistance,
            estimatedTime: estimate.estimatedTime,
            combinedText: estimate.combinedText,
          });
        }

        if (liveResults.length >= 4) {
          return liveResults.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
        }
      }
    }
  } catch {
    // If online API is slow or offline, gracefully fallback to local dataset
  }

  // Fallback to local calculated dataset
  return calculateNearbyLandmarks(lat, lng, { limit: 8 });
}
