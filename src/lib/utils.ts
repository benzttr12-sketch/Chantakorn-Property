import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PropertyType, PropertyStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, status: PropertyStatus = 'sale'): string {
  if (!price && price !== 0) return 'ติดต่อสอบถาม';
  const formatted = new Intl.NumberFormat('th-TH').format(price);
  if (status === 'rent') {
    return `฿${formatted} / เดือน`;
  }
  return `฿${formatted}`;
}

export function formatThaiNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}

export function getPropertyTypeName(type: PropertyType | string): string {
  switch (type) {
    case 'house':
      return 'บ้าน / ทาวน์โฮม';
    case 'land':
      return 'ที่ดิน';
    case 'condo':
      return 'คอนโดมิเนียม';
    case 'commercial':
      return 'อาคารพาณิชย์';
    case 'investment':
      return 'อสังหาฯ เพื่อการลงทุน';
    case 'consignment':
      return 'ขายฝาก / จำนอง';
    default:
      return 'อสังหาริมทรัพย์';
  }
}

export function getPropertyStatusBadge(status: PropertyStatus): { text: string; bgClass: string; textClass: string } {
  if (status === 'rent') {
    return {
      text: 'ให้เช่า',
      bgClass: 'bg-emerald-600',
      textClass: 'text-white'
    };
  }
  return {
    text: 'ขาย',
    bgClass: 'bg-gold-500',
    textClass: 'text-navy-950 font-bold'
  };
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0E00-\u0E7F-]+/g, '')
    .replace(/--+/g, '-');
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

/**
 * แปลงตัวเลขเป็นข้อความภาษาไทย เช่น 3500000 -> "3.5 ล้านบาท"
 */
export function formatThaiBahtReadable(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '';
  if (num >= 1000000) {
    const millions = num / 1000000;
    const formatted = Number.isInteger(millions) ? millions.toString() : millions.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted} ล้านบาท`;
  }
  if (num >= 100000) {
    const hundredThousands = num / 100000;
    return `${hundredThousands} แสนบาท`;
  }
  return `${new Intl.NumberFormat('th-TH').format(num)} บาท`;
}

/**
 * แปลงตัวเลขจำนวนเงินเป็นคำอ่านภาษาไทยแบบสมบูรณ์
 */
export function numberToThaiBahtWords(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return '';
  const thaiNumbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const thaiUnits = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const convertGroup = (numStr: string): string => {
    let result = '';
    const len = numStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i], 10);
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos === 1 && digit === 1) {
          result += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          result += 'ยี่สิบ';
        } else if (pos === 0 && digit === 1 && len > 1 && parseInt(numStr[len - 2], 10) !== 0) {
          result += 'เอ็ด';
        } else {
          result += thaiNumbers[digit] + thaiUnits[pos];
        }
      }
    }
    return result;
  };

  const integerPart = Math.floor(amount);
  if (integerPart === 0) return 'ศูนย์บาทถ้วน';

  const str = integerPart.toString();
  if (integerPart < 1000000) {
    return convertGroup(str) + 'บาทถ้วน';
  }

  const millions = Math.floor(integerPart / 1000000);
  const remainder = integerPart % 1000000;

  let result = convertGroup(millions.toString()) + 'ล้าน';
  if (remainder > 0) {
    result += convertGroup(remainder.toString());
  }
  return result + 'บาทถ้วน';
}

/**
 * โครงสร้างผลลัพธ์การแปลงพิกัด
 */
export interface ParsedCoordinates {
  lat: number;
  lng: number;
  sourceType: 'raw' | 'url' | 'embed' | 'dms' | 'resolved';
  formattedText?: string;
}

/**
 * ตรวจสอบว่าพิกัดอยู่ในขอบเขตที่ถูกต้องหรือไม่
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * ตรวจสอบว่าเป็น Short URL ของ Google Maps หรือไม่
 */
export function isGoogleMapsShortUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(input.trim());
}

/**
 * ฟังก์ชันแปลงข้อความ ลิงก์ หรือ iframe จาก Google Maps ให้เป็นพิกัด Latitude และ Longitude
 * รองรับ:
 * 1. ลิงก์ Google Maps Desktop/Browser: @lat,lng หรือ ?q=lat,lng หรือ query=lat,lng
 * 2. Embed iframe code: !3d(lat)!2d(lng) หรือ !2d(lng)!3d(lat)
 * 3. พิกัดตัวเลขดิบ: "7.0084, 100.4747" หรือ "7.0084 100.4747"
 * 4. พิกัด DMS (องศา ลิปดา): 7°00'31.1"N 100°28'29.0"E
 */
export function parseGoogleMapsCoordinates(input: string): ParsedCoordinates | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Google Maps Embed iframe code: !3d(lat)!2d(lng) หรือ !2d(lng)!3d(lat)
  const embed3d2d = trimmed.match(/!3d(-?\d+(?:\.\d+)?)[^!]*!2d(-?\d+(?:\.\d+)?)/);
  if (embed3d2d) {
    const lat = parseFloat(embed3d2d[1]);
    const lng = parseFloat(embed3d2d[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'embed', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }
  const embed2d3d = trimmed.match(/!2d(-?\d+(?:\.\d+)?)[^!]*!3d(-?\d+(?:\.\d+)?)/);
  if (embed2d3d) {
    const lng = parseFloat(embed2d3d[1]);
    const lat = parseFloat(embed2d3d[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'embed', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 2. Google Maps URL pattern: @lat,lng,zoom
  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'url', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 3. Google Maps URL query parameter: ?q=lat,lng หรือ &q=lat,lng หรือ query=lat,lng หรือ ll=lat,lng หรือ destination=lat,lng
  const paramMatch = trimmed.match(/(?:[?&](?:q|query|ll|daddr|saddr|destination|center)=|place\/)(-?\d+(?:\.\d+)?)\s*[,+]\s*(-?\d+(?:\.\d+)?)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'url', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 4. พิกัด DMS (Degrees, Minutes, Seconds) เช่น 7°00'31.1"N 100°28'29.0"E
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([0-9.]+)["]?\s*([NSns])[,;\s]+(\d+)[°\s]+(\d+)['\s]+([0-9.]+)["]?\s*([EWew])/;
  const dmsMatch = trimmed.match(dmsRegex);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]);
    const latMin = parseFloat(dmsMatch[2]);
    const latSec = parseFloat(dmsMatch[3]);
    const latDir = dmsMatch[4].toUpperCase();

    const lngDeg = parseFloat(dmsMatch[5]);
    const lngMin = parseFloat(dmsMatch[6]);
    const lngSec = parseFloat(dmsMatch[7]);
    const lngDir = dmsMatch[8].toUpperCase();

    let lat = latDeg + latMin / 60 + latSec / 3600;
    if (latDir === 'S') lat = -lat;

    let lng = lngDeg + lngMin / 60 + lngSec / 3600;
    if (lngDir === 'W') lng = -lng;

    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'dms', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 5. พิกัดตัวเลขคู่ดิบ เช่น "7.008432, 100.474712" หรือ "7.008432,100.474712"
  const rawCoordsMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)[,\s\t/]+(-?\d+(?:\.\d+)?)$/);
  if (rawCoordsMatch) {
    const lat = parseFloat(rawCoordsMatch[1]);
    const lng = parseFloat(rawCoordsMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'raw', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 6. ข้อความที่มีพิกัดตัวเลขซ่อนอยู่ เช่น "พิกัดแปลงที่ดิน 7.008432, 100.474712 ใกล้ มอ."
  const anyCoordsMatch = trimmed.match(/(-?\d{1,2}(?:\.\d{3,}))[,\s]+(-?\d{1,3}(?:\.\d{3,}))/);
  if (anyCoordsMatch) {
    const lat = parseFloat(anyCoordsMatch[1]);
    const lng = parseFloat(anyCoordsMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, sourceType: 'raw', formattedText: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  return null;
}


