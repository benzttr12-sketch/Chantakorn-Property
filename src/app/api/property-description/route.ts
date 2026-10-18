import { NextRequest, NextResponse } from 'next/server';
import { PropertyType, PropertyStatus } from '@/lib/types';
import { requireStaff } from '@/lib/server-auth';
import { readJsonBody } from '@/lib/server-request';

interface GenerateDescriptionRequest {
  title?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  price?: number | string;
  district?: string;
  subdistrict?: string;
  address?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  parking?: number | string;
  landSize?: number | string;
  usableArea?: number | string;
  furniture?: string;
  facingDirection?: string;
  features?: string[];
  landmarks?: string[];
  agentName?: string;
  agentPhone?: string;
  agentLine?: string;
  agentFacebook?: string;
  tone?: 'luxury' | 'high_converting' | 'social_media' | 'investor';
  customHighlights?: string;
}

function isDescriptionRequest(value: unknown): value is GenerateDescriptionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const textLimits: Record<string, number> = {
    title: 500, district: 200, subdistrict: 200, address: 1000,
    furniture: 500, facingDirection: 100, agentName: 200, agentPhone: 100,
    agentLine: 200, agentFacebook: 1000, customHighlights: 4000,
  };
  const numericFields = ['price', 'bedrooms', 'bathrooms', 'parking', 'landSize', 'usableArea'];
  const enums: Record<string, string[]> = {
    propertyType: ['house', 'condo', 'land', 'commercial', 'investment', 'consignment'],
    status: ['sale', 'rent'],
    tone: ['luxury', 'high_converting', 'social_media', 'investor'],
  };
  for (const [key, field] of Object.entries(body)) {
    if (Object.hasOwn(textLimits, key)) {
      if (typeof field !== 'string' || field.length > textLimits[key]) return false;
    } else if (numericFields.includes(key)) {
      if (field === '') continue;
      if (typeof field !== 'number' && typeof field !== 'string') return false;
      if (typeof field === 'string' && (field.length > 32 || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(field))) return false;
      const numeric = Number(field);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1e14) return false;
    } else if (key === 'features' || key === 'landmarks') {
      if (!Array.isArray(field) || field.length > 32 || field.some(item => typeof item !== 'string' || item.length > 200)) return false;
    } else if (Object.hasOwn(enums, key)) {
      if (typeof field !== 'string' || !enums[key].includes(field)) return false;
    } else {
      return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const parsedBody = await readJsonBody(req, 32 * 1024);
    if (parsedBody.error) return parsedBody.error;
    if (!isDescriptionRequest(parsedBody.data)) {
      return NextResponse.json({ success: false, error: 'ข้อมูลรายละเอียดทรัพย์ไม่ถูกต้องหรือยาวเกินกำหนด' }, { status: 400 });
    }
    const body = parsedBody.data;

    const {
      title = '',
      propertyType = 'house',
      status = 'sale',
      price = '',
      district = 'หาดใหญ่',
      subdistrict = '',
      address = '',
      bedrooms = 0,
      bathrooms = 0,
      parking = 0,
      landSize = 0,
      usableArea = 0,
      furniture = '',
      facingDirection = '',
      features = [],
      landmarks = [],
      agentName = 'คุณฉันทากร (เบนซ์)',
      agentPhone = '081-604-0097',
      agentLine = '@930xzcyi',
      agentFacebook = 'Chantakorn Property รับฝากขายบ้าน ที่ดิน คอนโด หาดใหญ่ สงขลา',
      tone = 'high_converting',
      customHighlights = '',
    } = body;

    const typeNames: Record<string, string> = {
      house: 'บ้านเดี่ยว / ทาวน์โฮม / พูลวิลล่า',
      condo: 'คอนโดมิเนียม',
      land: 'ที่ดินเปล่า / ที่ดินจัดสรร',
      commercial: 'อาคารพาณิชย์ / ตึกแถว / โฮมออฟฟิศ',
      investment: 'อสังหาริมทรัพย์เพื่อการลงทุน',
      consignment: 'ทรัพย์รับขายฝาก-จำนอง',
    };

    const actionText = status === 'rent' ? 'ให้เช่า' : 'เสนอขาย';
    const numPrice = Number(price);
    const formattedPrice = numPrice > 0
      ? `${numPrice.toLocaleString('th-TH')} บาท${status === 'rent' ? '/เดือน' : ''}`
      : 'ราคาพิเศษ (ติดต่อสอบถาม)';

    const headline = title.trim() || `${actionText}${typeNames[propertyType] || 'บ้าน'} ${subdistrict ? `ทำเล ${subdistrict}` : `ทำเล ${district}`} ${numPrice > 0 ? formattedPrice : ''} จ.สงขลา`.trim();
    const templateHeadings = {
      high_converting: 'ข้อมูลประกาศและจุดเด่น',
      luxury: 'รายละเอียดทรัพย์และพื้นที่ใช้สอย',
      social_media: 'ประกาศสำหรับแชร์บนโซเชียล',
      investor: 'ข้อมูลประกอบการพิจารณาลงทุน',
    };

    const specBullets: string[] = [];
    if (Number(bedrooms) > 0) specBullets.push(`• ${bedrooms} ห้องนอน`);
    if (Number(bathrooms) > 0) specBullets.push(`• ${bathrooms} ห้องน้ำ`);
    if (Number(parking) > 0) specBullets.push(`• ที่จอดรถ ${parking} คัน`);
    if (Number(landSize) > 0) specBullets.push(`• ขนาดที่ดิน ${landSize} ตารางวา`);
    if (Number(usableArea) > 0) specBullets.push(`• พื้นที่ใช้สอย ${usableArea} ตารางเมตร`);
    if (furniture) specBullets.push(`• เฟอร์นิเจอร์: ${furniture}`);
    if (facingDirection) specBullets.push(`• ทิศหน้าทรัพย์: ${facingDirection}`);

    const description = [
      `🌟 ${headline}`,
      templateHeadings[tone],
      ``,
      `📍 ทำเลที่ตั้ง: ${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} จ.สงขลา ${address ? `(${address})` : ''}`,
      `💰 ราคา${actionText}: ${formattedPrice}`,
      ``,
      `📐 ฟังก์ชันและรายละเอียดตัวทรัพย์:`,
      specBullets.join('\n'),
      ``,
      features.length > 0 ? `✨ จุดเด่นและสิ่งอำนวยความสะดวก:\n${features.map(f => `• ${f}`).join('\n')}\n` : '',
      landmarks.length > 0 ? `📍 สถานที่ใกล้เคียง:\n${landmarks.map(landmark => `• ${landmark}`).join('\n')}\n` : '',
      customHighlights ? `📝 ข้อมูลเพิ่มเติม:\n${customHighlights}\n` : '',
      `📞 ติดต่อสอบถามและนัดชมทรัพย์ได้ทุกวัน:`,
      `• โทร: ${agentPhone} (${agentName})`,
      `• LINE: ${agentLine}`,
      `• Facebook: ${agentFacebook}`,
    ].filter(Boolean).join('\n').trim();

    return NextResponse.json({
      success: true,
      source: 'property-template',
      headline,
      description,
      keyPoints: [
        `ทำเล ${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district}`,
        `ราคา${actionText} ${formattedPrice}`,
        ...features.slice(0, 3),
      ],
      socialCaption: `${headline}\n\nราคา ${formattedPrice} สนใจนัดชมติดต่อ ${agentPhone} (${agentName}) หรือ LINE: ${agentLine}`,
      hashtags: ['#อสังหาหาดใหญ่', '#บ้านหาดใหญ่', '#ChantakornProperty', '#ที่ดินสงขลา'],
    });
  } catch (error) {
    console.error('Error generating property description:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างคำบรรยาย',
      },
      { status: 500 }
    );
  }
}
