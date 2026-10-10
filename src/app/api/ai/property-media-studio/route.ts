import { jsonResponse } from '@/lib/api-response';
import { getGeminiClient } from '@/lib/gemini';
import { requireStaff } from '@/lib/server-auth';

function mediaResponse(body: unknown, init?: ResponseInit) {
  return jsonResponse(body, { ...init, headers: { 'Cache-Control': 'no-store, private' } });
}

export async function POST(req: Request) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || !['generate_video', 'edit_image'].includes(body.action)) {
    return mediaResponse({ success: false, error: 'กรุณาเลือกเครื่องมือเตรียมสื่อที่ต้องการ' }, { status: 400 });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 4000 ||
    (body.editStyle !== undefined && (typeof body.editStyle !== 'string' || body.editStyle.length > 120))) {
    return mediaResponse({ success: false, error: 'กรุณาระบุบรีฟสื่อไม่เกิน 4,000 ตัวอักษร' }, { status: 400 });
  }

  // Video generation needs a provider, operation polling and private asset delivery.
  // Never substitute unrelated footage or claim that a video has been generated.
  if (body.action === 'generate_video') {
    return mediaResponse({
      success: false,
      code: 'VIDEO_NOT_CONFIGURED',
      error: 'ยังไม่ได้เปิดบริการสร้างวิดีโอ AI สามารถคัดลอกหรือดาวน์โหลดบรีฟเพื่อส่งให้ทีมผลิตสื่อได้',
    }, { status: 503 });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return mediaResponse({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      error: 'ยังไม่ได้เชื่อมต่อบริการ AI สามารถคัดลอกหรือดาวน์โหลดบรีฟการตกแต่งได้',
    }, { status: 503 });
  }

  try {
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model,
      contents: `เขียนแผนเตรียมภาพประกาศอสังหาริมทรัพย์เป็นภาษาไทยให้ทีมงานนำไปใช้ได้จริง
ข้อมูลที่ผู้ดูแลให้: ${body.prompt.trim()}
สไตล์ที่ต้องการ: ${body.editStyle || 'Modern Luxury'}
แบ่งเป็น 1. สิ่งที่ควรจัดเตรียม 2. มุมภาพและแสง 3. บรีฟส่งให้ช่างภาพหรือผู้ออกแบบ
อย่าอ้างว่าได้ดู แก้ไข หรือสร้างรูปภาพแล้ว เพราะได้รับข้อมูลเป็นข้อความเท่านั้น
อย่าเติมข้อเท็จจริงเกี่ยวกับทรัพย์ที่ไม่มีในบรีฟ เช่น ห้องนอน สระว่ายน้ำ หรือสิ่งปลูกสร้าง`,
      config: { maxOutputTokens: 1600, httpOptions: { timeout: 20000 } },
    });
    const text = response.text?.trim();
    if (!text) throw new Error('Empty staging plan');
    return mediaResponse({
      success: true,
      outputType: 'staging_plan',
      stagingDescription: text,
      message: 'สร้างแผนเตรียมภาพแล้ว รูปทรัพย์ต้นฉบับยังเป็นรูปเดิม',
    });
  } catch {
    // Provider errors may contain request text, keys or internal URLs.
    return mediaResponse({
      success: false,
      code: 'AI_PROVIDER_FAILED',
      error: 'บริการ AI ยังสร้างแผนไม่ได้ กรุณาลองอีกครั้ง หรือดาวน์โหลดบรีฟเพื่อทำงานต่อ',
    }, { status: 502 });
  }
}
