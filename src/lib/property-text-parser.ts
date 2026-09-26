/**
 * Smart Property Text Parser & Auto-Extractor
 * แปลงข้อความดิบจาก LINE, Facebook, หรือโน้ตของนายหน้าเป็นข้อมูลทรัพย์สินอัตโนมัติ
 * Chantakorn Property - หาดใหญ่ สงขลา
 */

import { PropertyType, PropertyStatus, FacingDirection } from '@/lib/types';
import { DISTRICTS_LIST, getSongkhlaSubdistricts } from '@/data/locations';

export interface ParsedPropertyData {
  title?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  price?: number;
  district?: string;
  subdistrict?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  landSize?: number;
  usableArea?: number;
  facingDirection?: FacingDirection;
  features?: string[];
  extractedNotes?: string;
  address?: string;
}

/**
 * วิเคราะห์และถอดรหัสข้อความภาษาไทยเป็นฟิลด์ข้อมูลอสังหาฯ
 */
export function parseRawPropertyText(rawText: string): ParsedPropertyData {
  const text = rawText.trim();
  if (!text) return {};

  const result: ParsedPropertyData = {
    features: []
  };

  // 1. ตรวจสอบสถานะ (Status: sale vs rent)
  if (/ให้เช่า|ปล่อยเช่า|เช่า|rent|for rent|\/เดือน|ต่อเดือน/i.test(text) && !/ขายฝาก|ฝากขาย/i.test(text)) {
    result.status = 'rent';
  } else {
    result.status = 'sale';
  }

  // 2. ตรวจสอบประเภททรัพย์ (Property Type)
  if (/คอนโด|condo|ห้องชุด|สตูดิโอ|studio/i.test(text)) {
    result.propertyType = 'condo';
  } else if (/ที่ดิน|สวนยาง|สวนปาล์ม|สวน|แปลงสวย|ไร่|งาน|ตารางวา|ตร\.ว\./i.test(text) && !/บ้านเดี่ยว|ทาวน์โฮม|ตึก/i.test(text)) {
    result.propertyType = 'land';
  } else if (/อาคารพาณิชย์|ตึกแถว|โฮมออฟฟิศ|ตึก|commercial|หน้าร้าน/i.test(text)) {
    result.propertyType = 'commercial';
  } else if (/ขายฝาก|รับจำนอง|ขายฝากจำนอง/i.test(text)) {
    result.propertyType = 'consignment';
  } else {
    // Default to house / townhome
    result.propertyType = 'house';
  }

  // 3. ตรวจสอบราคา (Price Extraction)
  // รองรับรูปแบบ: "3.5 ล้าน", "3,500,000", "3.49 ลบ", "12,000/ด", "ราคา 2,890,000 บาท"
  let parsedPrice: number | undefined;

  // Pattern A: "X.X ล้าน" หรือ "X ล้าน" หรือ "X.X ลบ."
  const millionMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:ล้านบาท|ล้าน|ลบ|m|mb)/i);
  if (millionMatch && millionMatch[1]) {
    const val = parseFloat(millionMatch[1]);
    if (!isNaN(val) && val > 0) {
      parsedPrice = Math.round(val * 1000000);
    }
  }

  // Pattern B: ตัวเลขจำนวนเต็มมีจุลภาค เช่น "3,500,000" หรือ "15,000"
  if (!parsedPrice) {
    const commaMatch = text.match(/(?:ราคา|ค่าเช่า|ขาย|เช่า|เพียง)?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*(?:บาท|.-|\/เดือน)?/);
    if (commaMatch && commaMatch[1]) {
      const val = parseInt(commaMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(val) && val > 0) {
        parsedPrice = val;
      }
    }
  }

  // Pattern C: ตัวเลขโดดๆ 5 หลักขึ้นไป เช่น 3500000 หรือ 12000
  if (!parsedPrice) {
    const plainNumMatch = text.match(/(?:ราคา|ขาย|เช่า|เพียง)\s*([0-9]{4,9})\s*(?:บาท)?/);
    if (plainNumMatch && plainNumMatch[1]) {
      const val = parseInt(plainNumMatch[1], 10);
      if (!isNaN(val) && val > 0) {
        parsedPrice = val;
      }
    }
  }

  if (parsedPrice) {
    result.price = parsedPrice;
  }

  // 4. ตรวจสอบอำเภอและตำบล (District & Subdistrict in Songkhla)
  let foundDistrict = 'หาดใหญ่'; // default songkhla hub
  let foundSubdistrict: string | undefined;

  for (const dist of DISTRICTS_LIST) {
    if (text.includes(dist) || text.includes(dist.replace('อำเภอ', '')) || text.includes(dist.replace('อ.', ''))) {
      foundDistrict = dist;
      break;
    }
  }
  result.district = foundDistrict;

  // ตรวจสอบตำบลจากฐานข้อมูลของอำเภอนั้นๆ
  const districtSubdistricts = getSongkhlaSubdistricts(foundDistrict);
  for (const sub of districtSubdistricts) {
    if (text.includes(sub) || text.includes(`ต.${sub}`)) {
      foundSubdistrict = sub;
      break;
    }
  }
  if (foundSubdistrict) {
    result.subdistrict = foundSubdistrict;
  }

  // 5. ตรวจสอบจำนวนห้องนอน (Bedrooms)
  const bedMatch = text.match(/([0-9]+)\s*(?:ห้องนอน|นอน|bed)/i);
  if (bedMatch && bedMatch[1]) {
    result.bedrooms = parseInt(bedMatch[1], 10);
  }

  // 6. ตรวจสอบจำนวนห้องน้ำ (Bathrooms)
  const bathMatch = text.match(/([0-9]+)\s*(?:ห้องน้ำ|น้ำ|bath)/i);
  if (bathMatch && bathMatch[1]) {
    result.bathrooms = parseInt(bathMatch[1], 10);
  }

  // 7. ตรวจสอบที่จอดรถ (Parking)
  const parkMatch = text.match(/([0-9]+)\s*(?:ที่จอดรถ|จอดรถ|คันจอด|จอดได้|คัน)/i);
  if (parkMatch && parkMatch[1]) {
    result.parking = parseInt(parkMatch[1], 10);
  }

  // 8. ตรวจสอบขนาดที่ดิน (Land Size in ตร.ว.)
  // รองรับ "50 ตร.ว.", "50 ตรว", "50 ตารางวา", "1 ไร่ 2 งาน 50 ตรว"
  let totalSqWah = 0;
  const raiMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*ไร่/);
  const nganMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*งาน/);
  const wahMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:ตารางวา|ตร\.ว|ตรว|วา)/);

  if (raiMatch || nganMatch || wahMatch) {
    if (raiMatch && raiMatch[1]) totalSqWah += parseFloat(raiMatch[1]) * 400;
    if (nganMatch && nganMatch[1]) totalSqWah += parseFloat(nganMatch[1]) * 100;
    if (wahMatch && wahMatch[1]) totalSqWah += parseFloat(wahMatch[1]);
    if (totalSqWah > 0) result.landSize = Math.round(totalSqWah * 10) / 10;
  }

  // 9. ตรวจสอบพื้นที่ใช้สอย (Usable Area in ตร.ม.)
  const usableMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:ตารางเมตร|ตร\.ม|ตรม|sqm)/i);
  if (usableMatch && usableMatch[1]) {
    result.usableArea = Math.round(parseFloat(usableMatch[1]));
  }

  // 10. ตรวจสอบทิศหน้าบ้าน (Facing Direction)
  if (/ทิศใต้|หน้าบ้านทิศใต้|หันใต้/i.test(text)) result.facingDirection = 'ทิศใต้';
  else if (/ทิศเหนือ|หน้าบ้านทิศเหนือ|หันเหนือ/i.test(text)) result.facingDirection = 'ทิศเหนือ';
  else if (/ทิศตะวันออกเฉียงเหนือ|อีสาน/i.test(text)) result.facingDirection = 'ทิศตะวันออกเฉียงเหนือ';
  else if (/ทิศตะวันออกเฉียงใต้|อาคเนย์/i.test(text)) result.facingDirection = 'ทิศตะวันออกเฉียงใต้';
  else if (/ทิศตะวันออก|หน้าบ้านทิศตะวันออก|หันออก/i.test(text)) result.facingDirection = 'ทิศตะวันออก';
  else if (/ทิศตะวันตกเฉียงเหนือ|พายัพ/i.test(text)) result.facingDirection = 'ทิศตะวันตกเฉียงเหนือ';
  else if (/ทิศตะวันตกเฉียงใต้|หรดี/i.test(text)) result.facingDirection = 'ทิศตะวันตกเฉียงใต้';
  else if (/ทิศตะวันตก|หน้าบ้านทิศตะวันตก|หันตก/i.test(text)) result.facingDirection = 'ทิศตะวันตก';

  // 11. ตรวจจับสิ่งอำนวยความสะดวก & จุดเด่น (Features)
  const featureKeywords: Array<{ keyword: RegExp; featureName: string }> = [
    { keyword: /แอร์|เครื่องปรับอากาศ/i, featureName: 'เครื่องปรับอากาศ' },
    { keyword: /เฟอร์นิเจอร์|บิ้วอิน|บิวท์อิน|แต่งครบ/i, featureName: 'เฟอร์นิเจอร์ครบ' },
    { keyword: /สระว่ายน้ำ|pool/i, featureName: 'สระว่ายน้ำ' },
    { keyword: /ฟิตเนส|gym|fitness/i, featureName: 'ฟิตเนส' },
    { keyword: /กล้องวงจรปิด|cctv/i, featureName: 'กล้องวงจรปิด CCTV' },
    { keyword: /รปภ|รปภ\.|รักษาความปลอดภัย|security/i, featureName: 'ระบบรักษาความปลอดภัย 24 ชม.' },
    { keyword: /ม\.อ\.|มหาวิทยาลัยสงขลานครินทร์/i, featureName: 'ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)' },
    { keyword: /สนามบิน|airport/i, featureName: 'ใกล้สนามบินหาดใหญ่' },
    { keyword: /เซ็นทรัล|central/i, featureName: 'ใกล้เซ็นทรัลหาดใหญ่' },
    { keyword: /ติดถนนใหญ่|ติดถนน/i, featureName: 'ติดถนนใหญ่' },
    { keyword: /วิวสวย|วิวสระ|วิวเมือง|วิวเขา/i, featureName: 'วิวสวย' }
  ];

  const matchedFeatures: string[] = [];
  for (const item of featureKeywords) {
    if (item.keyword.test(text)) {
      matchedFeatures.push(item.featureName);
    }
  }
  result.features = matchedFeatures;

  // 12. สร้างชื่อประกาศอัตโนมัติ (Smart Title)
  const typeLabel = 
    result.propertyType === 'condo' ? 'คอนโด' :
    result.propertyType === 'land' ? 'ที่ดิน' :
    result.propertyType === 'commercial' ? 'อาคารพาณิชย์' : 'บ้านเดี่ยว';

  const actionLabel = result.status === 'rent' ? 'ให้เช่า' : 'ขาย';
  const locationLabel = result.subdistrict ? `ทำเล ${result.subdistrict} ${result.district}` : `ทำเล ${result.district}`;
  const specLabel = result.bedrooms ? `${result.bedrooms} ห้องนอน` : (result.landSize ? `${result.landSize} ตร.ว.` : '');

  // ดึงบรรทัดแรกที่ดูเหมือนชื่อหัวข้อถ้ามี
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length >= 15 && firstLine.length <= 80 && (firstLine.includes('ขาย') || firstLine.includes('เช่า') || firstLine.includes('บ้าน') || firstLine.includes('ที่ดิน') || firstLine.includes('คอนโด'))) {
    result.title = firstLine;
  } else {
    result.title = `${actionLabel}${typeLabel} ${locationLabel} ${specLabel} จ.สงขลา`.replace(/\s+/g, ' ').trim();
  }

  // บันทึกเนื้อความดิบที่จัดระเบียบแล้ว
  result.extractedNotes = text;

  return result;
}

/**
 * สร้างคำอธิบายประกาศอสังหาริมทรัพย์ระดับมืออาชีพแบบ 1-Click
 */
export function generateProfessionalDescription(params: {
  title: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: number | string;
  district: string;
  subdistrict?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  parking?: number | string;
  landSize?: number | string;
  usableArea?: number | string;
  furniture?: string;
  facingDirection?: string;
  features?: string[];
  rawNotes?: string;
}): string {
  const typeNames: Record<PropertyType, string> = {
    house: 'บ้านเดี่ยว / ทาวน์โฮม',
    condo: 'คอนโดมิเนียม',
    land: 'ที่ดินเปล่า / ที่ดินจัดสรร',
    commercial: 'อาคารพาณิชย์ / ตึกแถว',
    investment: 'อสังหาริมทรัพย์เพื่อการลงทุน',
    consignment: 'ทรัพย์รับขายฝาก-จำนอง'
  };

  const actionText = params.status === 'rent' ? 'ให้เช่า' : 'เสนอขาย';
  const priceDisplay = Number(params.price) > 0 
    ? `${Number(params.price).toLocaleString('th-TH')} บาท${params.status === 'rent' ? '/เดือน' : ''}`
    : 'โปรดสอบถามราคา';

  const sections = [
    `✨ ${params.title || `${actionText}${typeNames[params.propertyType]} ในทำเลคุณภาพ`}`,
    ``,
    `📍 ทำเลที่ตั้ง: ${params.subdistrict ? `ต.${params.subdistrict} ` : ''}อ.${params.district} จ.สงขลา`,
    `💰 ราคา${actionText}: ${priceDisplay}`,
    ``,
    `📐 รายละเอียดและฟังก์ชันตัวทรัพย์:`,
    `• ประเภททรัพย์: ${typeNames[params.propertyType]}`,
    Number(params.bedrooms) > 0 ? `• ห้องนอน: ${params.bedrooms} ห้อง` : '',
    Number(params.bathrooms) > 0 ? `• ห้องน้ำ: ${params.bathrooms} ห้อง` : '',
    Number(params.parking) > 0 ? `• ที่จอดรถ: ${params.parking} คัน` : '',
    Number(params.landSize) > 0 ? `• ขนาดที่ดิน: ${params.landSize} ตารางวา` : '',
    Number(params.usableArea) > 0 ? `• พื้นที่ใช้สอย: ${params.usableArea} ตารางเมตร` : '',
    params.furniture ? `• สภาพเฟอร์นิเจอร์: ${params.furniture}` : '',
    params.facingDirection ? `• ทิศหน้าทรัพย์: ${params.facingDirection}` : '',
    ``,
    params.features && params.features.length > 0 ? [
      `🌟 จุดเด่นและสิ่งอำนวยความสะดวก:`,
      ...params.features.map(f => `• ${f}`)
    ].join('\n') : '',
    ``,
    params.rawNotes ? [
      `📝 ข้อมูลเพิ่มเติมจากผู้ดูแล:`,
      params.rawNotes
    ].join('\n') : '',
    ``,
    `🛡️ การันตีความถูกต้องโดย Chantakorn Property:`,
    `• ตรวจสอบเอกสารสิทธิ์ โฉนดที่ดิน ปลอดภาระหนี้ซ้อน`,
    `• บริการพาชมทรัพย์ฟรีทุกวัน พร้อมให้คำปรึกษาและประสานงานยื่นกู้สินเชื่อธนาคารฟรี 100%`,
    ``,
    `📞 นัดชมทรัพย์และสอบถามข้อมูลเพิ่มเติม:`,
    `• โทร: 081-604-0097 (คุณฉันทากร / เบนซ์)`,
    `• LINE Official: @chantakorn`,
    `• Facebook: Chantakorn Property รับฝากขายบ้าน ที่ดิน คอนโด หาดใหญ่ สงขลา`
  ];

  return sections.filter(s => s !== '').join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
