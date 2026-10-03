import { formatPrice, formatPropertyCode, DEFAULT_OFFICIAL_LINE_URL, propertyHref } from '@/lib/utils';
import { Property, PropertyCardProps } from '@/lib/types';

export interface PropertyLineData {
  id: string;
  title: string;
  price: number;
  status?: string;
  district?: string;
  subdistrict?: string;
  province?: string;
  slug: string;
  cover_image?: string;
  images?: string[];
  property_type?: string;
  video_url?: string;
  agent?: any;
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
export const OFFICIAL_LINE_BASIC_ID = '@930xzcyi';

/**
 * สร้าง URL สำหรับส่งข้อความเข้าแชท LINE Official Account โดยตรง (@930xzcyi)
 * เปิดห้องแชทของ LINE OA พร้อมพิมพ์ข้อความใส่ในช่องพิมพ์ข้อความให้อัตโนมัติ 1 คลิก
 */
export function getLineOaDirectMessageUrl(message: string, basicId: string = OFFICIAL_LINE_BASIC_ID): string {
  const cleanId = basicId.startsWith('@') ? basicId : `@${basicId}`;
  return `https://line.me/R/oaMessage/${encodeURIComponent(cleanId)}/?${encodeURIComponent(message)}`;
}

/**
 * สร้างข้อความแจ้งฝากขายทรัพย์สำหรับส่งเข้า LINE OA
 */
export function generateConsignmentLineMessage(data: {
  name: string;
  phone: string;
  line_id?: string;
  property_type?: string;
  expected_price?: number;
  district?: string;
  province?: string;
  description?: string;
}): string {
  const priceFormatted = data.expected_price
    ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(data.expected_price)
    : 'ตามตกลง';

  return `🔔 มีข้อมูลฝากขายอสังหาริมทรัพย์ใหม่จากเว็บไซต์ Chantakorn Property!
----------------------------------
👤 ผู้ติดต่อ: ${data.name || 'ลูกค้า'}
📞 เบอร์โทรศัพท์: ${data.phone || '-'}
💬 LINE ID: ${data.line_id || '-'}
🏠 ประเภททรัพย์: ${data.property_type || 'อสังหาริมทรัพย์'}
📍 ทำเล: ${data.district || 'หาดใหญ่'} ${data.province || 'จ.สงขลา'}
💰 ราคาที่ต้องการ: ${priceFormatted}
📝 รายละเอียด: ${data.description || '-'}
----------------------------------
ขอให้ทีมงาน Chantakorn Property ติดต่อกลับเพื่อดำเนินงานด้วยครับ ขอบคุณครับ`;
}
