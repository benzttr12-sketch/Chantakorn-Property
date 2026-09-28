import { formatPrice, formatPropertyCode, DEFAULT_OFFICIAL_LINE_URL, propertyHref } from '@/lib/utils';
import { Property, PropertyCardProps } from '@/lib/types';

export interface PropertyLineData {
  id: string;
  title: string;
  price: number;
  status?: string;
  district?: string;
  province?: string;
  slug: string;
}

/**
 * สร้างข้อความสอบถามทรัพย์สำหรับส่งให้ทีมงานทาง LINE OA
 */
export function generatePropertyLineMessage(
  property: PropertyLineData,
  origin?: string
): string {
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com');
  const propertyUrl = `${baseUrl}${propertyHref(property.slug)}`;
  const code = formatPropertyCode(property.id);
  const formattedPrice = formatPrice(property.price, (property.status as any) || 'sale');
  const locationText = [property.district, property.province].filter(Boolean).join(', ') || 'หาดใหญ่ สงขลา';

  return `สวัสดีครับ/ค่ะ สนใจสอบถามข้อมูลทรัพย์นี้จากเว็บไซต์ Chantakorn Property ครับ

🏡 ทรัพย์: ${property.title}
🔖 รหัสทรัพย์: ${code}
💰 ราคา: ${formattedPrice}
📍 ทำเล: ${locationText}
🔗 ดูรูปและรายละเอียดบนเว็บ:
👉 ${propertyUrl}

รบกวนขอข้อมูลเพิ่มเติม / นัดหมายเข้าชมสถานที่จริงด้วยครับ ขอบคุณครับ`;
}

/**
 * สร้าง URL สำหรับส่งข้อความเข้า LINE
 */
export function getLineShareUrl(message: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

/**
 * Official LINE OA direct deep link
 */
export const OFFICIAL_LINE_OA_URL = DEFAULT_OFFICIAL_LINE_URL; // https://lin.ee/NMSe28T3
