import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { PropertyType, PropertyStatus } from '@/lib/types';

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

export async function POST(req: NextRequest) {
  try {
    const body: GenerateDescriptionRequest = await req.json();

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
      agentLine = '@chantakorn',
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

    const toneDescriptions = {
      luxury: 'ระดับพรีเมียม หรูหรา สง่างาม เน้นภาพลักษณ์ชีวิตที่ดี สถาปัตยกรรม และความคุ้มค่าระดับมาสเตอร์พีซ',
      high_converting: 'กระตุ้นการตัดสินใจ ปิดการขายไว ชี้จุดเด่นและราคาคุ้มค่า มี Call-to-Action ชวนนัดชมทันที',
      social_media: 'เหมาะสำหรับโพสต์ Facebook และ LINE อ่านง่าย แบ่งข้อย่อยชัดเจน มีอิโมจิสวยงามสะดุดตา',
      investor: 'เจาะกลุ่มนักลงทุน เน้นผลตอบแทน Yield ค่าเช่า ความต้องการของผู้เช่า และศักยภาพการเติบโตของทำเล',
    };

    const actionText = status === 'rent' ? 'ให้เช่า' : 'เสนอขาย';
    const numPrice = Number(price);
    const formattedPrice = numPrice > 0
      ? `${numPrice.toLocaleString('th-TH')} บาท${status === 'rent' ? '/เดือน' : ''}`
      : 'ราคาพิเศษ (ติดต่อสอบถาม)';

    // Check if Gemini API key exists
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const prompt = `คุณคือนักเขียนคำโฆษณาอสังหาริมทรัพย์มืออาชีพ (Senior Real Estate Copywriter) ประจำบริษัท "Chantakorn Property" (ฉันทากร พร็อพเพอร์ตี้) ศูนย์กลางซื้อ ขาย เช่า อสังหาริมทรัพย์หาดใหญ่–สงขลา

กรุณาเขียนบทความและคำบรรยายประกาศอสังหาริมทรัพย์ภาษาไทยที่ดึงดูดใจ น่าเชื่อถือ และสร้างยอดขายได้จริง (High-Converting) โดยใช้ข้อมูลสเปกของทรัพย์ต่อไปนี้:

ข้อมูลทรัพย์สิน:
- ชื่อทรัพย์ปัจจุบัน: ${title || 'ยังไม่ระบุ'}
- ประเภททรัพย์: ${typeNames[propertyType] || propertyType}
- สถานะประกาศ: ${actionText}
- ราคา: ${formattedPrice}
- ทำเลที่ตั้ง: ${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} จ.สงขลา ${address ? `(ที่อยู่: ${address})` : ''}
- จำนวนห้องนอน: ${Number(bedrooms) > 0 ? `${bedrooms} ห้องนอน` : 'ไม่ระบุ'}
- จำนวนห้องน้ำ: ${Number(bathrooms) > 0 ? `${bathrooms} ห้องน้ำ` : 'ไม่ระบุ'}
- ที่จอดรถ: ${Number(parking) > 0 ? `${parking} คัน` : 'ไม่ระบุ'}
- ขนาดที่ดิน: ${Number(landSize) > 0 ? `${landSize} ตร.ว.` : 'ไม่ระบุ'}
- พื้นที่ใช้สอย: ${Number(usableArea) > 0 ? `${usableArea} ตร.ม.` : 'ไม่ระบุ'}
- สภาพเฟอร์นิเจอร์/การตกแต่ง: ${furniture || 'ไม่ระบุ'}
- ทิศหน้าทรัพย์: ${facingDirection || 'ไม่ระบุ'}
- จุดเด่นและสิ่งอำนวยความสะดวก: ${features.length > 0 ? features.join(', ') : 'ทำเลดี เดินทางสะดวก'}
- แลนด์มาร์กสำคัญใกล้เคียง: ${landmarks.length > 0 ? landmarks.join(', ') : 'ใกล้ ม.อ. หาดใหญ่, เซ็นทรัลหาดใหญ่, สนามบินหาดใหญ่'}
- ข้อมูลเพิ่มเติม/จุดเน้นจากนายหน้า: ${customHighlights || 'ไม่มี'}

ข้อมูลผู้ดูแลและติดต่อ (ต้องใส่ท้ายประกาศ):
- นายหน้าที่ปรึกษา: ${agentName}
- เบอร์โทรศัพท์: ${agentPhone}
- LINE ID: ${agentLine}
- Facebook: ${agentFacebook}

โทนการเขียนที่ต้องการ:
- โทน: ${toneDescriptions[tone] || toneDescriptions.high_converting}

ข้อกำหนดและมาตรฐานของ Chantakorn Property:
1. ภาษาไทยไพเราะ สละสลวย ชัดเจน ไม่มีคำกำกวม ไม่ใช้ AI Slop
2. มีพาดหัวที่ดึงดูดสายตา (Hook Headline)
3. แยกหมวดหมู่ให้อ่านง่าย เช่น 📍 ทำเลและจุดเด่น, 📐 ฟังก์ชันตัวทรัพย์, 🌟 สิ่งอำนวยความสะดวก, 🛡️ มาตรฐานความปลอดภัย (ตรวจสอบโฉนด 100% ดูแลสินเชื่อธนาคารฟรี 100%), 📞 ช่องทางติดต่อ
4. สื่อถึงความจริงใจและผลประโยชน์ของผู้ซื้อเป็นสำคัญ`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'คุณคือผู้เชี่ยวชาญการเขียนประกาศอสังหาริมทรัพย์ระดับพรีเมียมในจังหวัดสงขลาและหาดใหญ่ ตอบกลับเป็น JSON ตามสคีมาที่กำหนดเท่านั้น',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: {
                  type: Type.STRING,
                  description: 'พาดหัวประกาศที่ดึงดูดใจและกระตุ้นยอดคลิก สั้น กระชับ ทรงพลัง',
                },
                description: {
                  type: Type.STRING,
                  description: 'เนื้อหาคำบรรยายทรัพย์ฉบับเต็ม พร้อมจัดหมวดหมู่ ข้อย่อย และช่องทางติดต่อ',
                },
                keyPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'จุดเด่นสรุปย่อ 3-5 ข้อ สำหรับอ่านด่วน',
                },
                socialCaption: {
                  type: Type.STRING,
                  description: 'ข้อความสั้นพร้อมอิโมจิ สำหรับแชร์ลง Facebook หรือส่งในห้อง LINE',
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'แฮชแท็กภาษาไทยที่เกี่ยวข้อง',
                },
              },
              required: ['headline', 'description', 'keyPoints', 'socialCaption', 'hashtags'],
            },
          },
        });

        const text = response.text?.trim() || '';
        if (text) {
          const parsed = JSON.parse(text);
          return NextResponse.json({
            success: true,
            source: 'gemini-3.8-flash',
            ...parsed,
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to intelligent template:', geminiError);
      }
    }

    // Intelligent Fallback Generator (Ensures 100% reliability even if offline or key not yet configured)
    const fallbackHeadline = `✨ ${actionText}${typeNames[propertyType] || 'บ้าน'} ${subdistrict ? `ทำเล ${subdistrict}` : `ทำเล ${district}`} ${formattedPrice !== 'ราคาพิเศษ (ติดต่อสอบถาม)' ? `เพียง ${formattedPrice}` : ''} จ.สงขลา`.trim();

    const specBullets: string[] = [];
    if (Number(bedrooms) > 0) specBullets.push(`• ${bedrooms} ห้องนอน`);
    if (Number(bathrooms) > 0) specBullets.push(`• ${bathrooms} ห้องน้ำ`);
    if (Number(parking) > 0) specBullets.push(`• ที่จอดรถ ${parking} คัน`);
    if (Number(landSize) > 0) specBullets.push(`• ขนาดที่ดิน ${landSize} ตารางวา`);
    if (Number(usableArea) > 0) specBullets.push(`• พื้นที่ใช้สอย ${usableArea} ตารางเมตร`);
    if (furniture) specBullets.push(`• เฟอร์นิเจอร์: ${furniture}`);
    if (facingDirection) specBullets.push(`• ทิศหน้าทรัพย์: ${facingDirection}`);

    const fallbackDescription = [
      `🌟 ${fallbackHeadline}`,
      ``,
      `📍 ทำเลที่ตั้ง: ${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} จ.สงขลา ${address ? `(${address})` : ''}`,
      `💰 ราคา${actionText}: ${formattedPrice}`,
      ``,
      `📐 ฟังก์ชันและรายละเอียดตัวทรัพย์:`,
      specBullets.length > 0 ? specBullets.join('\n') : `• ทรัพย์คุณภาพ สภาพดี พร้อมส่งมอบกรรมสิทธิ์`,
      ``,
      features.length > 0 ? `✨ จุดเด่นและสิ่งอำนวยความสะดวก:\n${features.map(f => `• ${f}`).join('\n')}\n` : '',
      customHighlights ? `📝 ข้อมูลเพิ่มเติม:\n${customHighlights}\n` : '',
      `🛡️ มาตรฐานการบริการโดย Chantakorn Property:`,
      `• ตรวจสอบความถูกต้องของเอกสารสิทธิ์และโฉนดที่ดิน 100% ไร้ข้อพิพาท ไร้หนี้ซ้อน`,
      `• ดันเคสสินเชื่อธนาคารเต็มวงเงิน พร้อมดูแลจนถึงวันโอนกรรมสิทธิ์ ณ กรมที่ดิน`,
      `• บริการนัดพาชมสถานที่จริงฟรี ไม่มีค่าใช้จ่ายล่วงหน้า`,
      ``,
      `📞 ติดต่อสอบถามและนัดชมทรัพย์ได้ทุกวัน:`,
      `• โทร: ${agentPhone} (${agentName})`,
      `• LINE: ${agentLine}`,
      `• Facebook: ${agentFacebook}`,
    ].filter(Boolean).join('\n').trim();

    return NextResponse.json({
      success: true,
      source: 'smart-template-engine',
      headline: fallbackHeadline,
      description: fallbackDescription,
      keyPoints: [
        `ทำเลคุณภาพ ${subdistrict ? `ต.${subdistrict} ` : ''}อ.${district} เดินทางสะดวก`,
        `ราคา${actionText} ${formattedPrice}`,
        `โฉนดตรวจสอบแล้ว 100% พร้อมบริการยื่นกู้ธนาคารฟรี`,
      ],
      socialCaption: `${fallbackHeadline}\n\nราคา ${formattedPrice} สนใจนัดชมติดต่อ ${agentPhone} (${agentName}) หรือ LINE: ${agentLine}`,
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
