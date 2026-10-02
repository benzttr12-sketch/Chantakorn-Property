import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    const ai = getGeminiClient();

    // If Gemini client or API key is not present, return null text so client can use offline smart engine
    if (!ai) {
      return NextResponse.json({
        success: false,
        error: 'No GEMINI_API_KEY configured',
        fallback: true,
      });
    }

    if (action === 'generate-social-post') {
      const { property, channel, tone } = payload;
      const prompt = `คุณคือผู้เชี่ยวชาญด้านการตลาดอสังหาริมทรัพย์ระดับท็อปของเมืองไทย และนายหน้ามือทองแห่งหาดใหญ่-สงขลา (แบรนด์ "ฉันทากร พร็อพเพอร์ตี้")
จงเขียนข้อความโพสต์การตลาดสำหรับช่องทาง: ${channel}
ระดับโทนเสียง (Tone of Voice): ${tone}
ข้อมูลทรัพย์:
- ชื่อทรัพย์: ${property.title}
- ประเภท: ${property.property_type}
- สถานะ: ${property.status === 'rent' ? 'ให้เช่า' : 'ขาย'}
- ราคา: ${property.price.toLocaleString()} บาท ${property.status === 'rent' ? '/เดือน' : ''}
- ทำเล: ${property.district}, ${property.province}
- ขนาด: ที่ดิน ${property.land_size || '-'} ตร.ว., พื้นที่ใช้สอย ${property.usable_area || '-'} ตร.ม.
- ฟังก์ชัน: ${property.bedrooms} ห้องนอน, ${property.bathrooms} ห้องน้ำ, ที่จอดรถ ${property.parking} คัน
- ทิศ: ${property.facing_direction || 'ทิศมงคล'}
- จุดเด่น: ${(property.features || []).join(', ')}

ข้อกำหนด:
- ถ้าเป็น tiktok: ให้เขียนเป็น Shot-by-Shot Script วิดีโอ 60 วินาที พร้อมคำแนะนำมุมกล้อง, บทพูดพากย์เสียง, และตัวหนังสือบนจอ
- ถ้าเป็น line: ให้จัดรูปแบบกระชับ ใส่ Emoji สวยงาม อ่านง่ายบนมือถือ มี CTA ด่วน
- ถ้าเป็น english: เขียนภาษาอังกฤษระดับมืออาชีพ ดึงดูดชาวต่างชาติและนักลงทุน
- ถ้าเป็น chinese: เขียนภาษาจีน สำหรับนักลงทุนชาวจีน/มาเลเซียที่มองหาอสังหาฯ ในหาดใหญ่-สงขลา
- ถ้าเป็น facebook: เขียน Headline หยุดสายตา, Storytelling เล่าอารมณ์ความคุ้มค่า, bullet points ฟังก์ชัน, และ Call to action ชัดเจน`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return NextResponse.json({
        success: true,
        text: response.text,
      });
    }

    if (action === 'smart-lead-match') {
      const { inquiry, property } = payload;
      const prompt = `วิเคราะห์การจับคู่ระหว่างลูกค้ากับอสังหาริมทรัพย์:
ลูกค้า: ${inquiry.name}
ข้อความที่ส่งมา: "${inquiry.message}"
ประเภทที่สนใจ: ${inquiry.consignment_details?.property_type || 'ไม่ระบุ'}
งบประมาณที่คาดหวัง: ${inquiry.consignment_details?.expected_price || 'ไม่ระบุ'}
ทำเล: ${inquiry.consignment_details?.district || 'หาดใหญ่-สงขลา'}

ทรัพย์ที่นำมาจับคู่:
- ชื่อ: ${property.title}
- ราคา: ${property.price.toLocaleString()} บาท
- ทำเล: ${property.district}, ${property.province}
- ฟังก์ชัน: ${property.bedrooms} นอน, ${property.bathrooms} น้ำ
- จุดเด่น: ${(property.features || []).join(', ')}

จงตอบเป็นข้อความวิเคราะห์ 2 ส่วน:
1. เหตุผลที่ทรัพย์นี้ตอบโจทย์ลูกค้าท่านนี้ (3 ข้อสั้นๆ)
2. ข้อความสั้นๆ สุภาพ น่าเชื่อถือ สำหรับนายหน้าใช้ส่งทักทายลูกค้าทาง LINE พร้อมแนบข้อเสนอ`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return NextResponse.json({
        success: true,
        text: response.text,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action',
    });
  } catch (error: any) {
    console.warn('AI Automate Route warning/error, falling back to client templates:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
        fallback: true,
      },
      { status: 200 }
    );
  }
}
