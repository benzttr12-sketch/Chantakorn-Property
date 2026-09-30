import { jsonResponse } from '@/lib/api-response';
import { GEMINI_PRIMARY_MODEL, generateGeminiContent, getGeminiClient } from '@/lib/gemini';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MarketIntelligenceResponse {
  answer: string;
  sources: GroundingSource[];
  searchQueries: string[];
  timestamp: string;
}

// In-memory cache for market intelligence to protect against Gemini API rate limits & 429 quota errors
interface CachedInsight {
  data: {
    answer: string;
    sources: GroundingSource[];
    searchQueries: string[];
    timestamp: string;
  };
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const insightCache = new Map<string, CachedInsight>();

export async function POST(req: Request) {
  let query = '';
  let category = '';

  try {
    const body = await req.json().catch(() => ({}));
    query = (body.query || '').trim();
    category = (body.category || '').trim();

    const cacheKey = (query || category || 'default').toLowerCase().replace(/\s+/g, ' ');

    // Check in-memory cache first to save quota
    const cached = insightCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return jsonResponse({
        success: true,
        ...cached.data,
        fromCache: true,
      });
    }

    const ai = getGeminiClient();

    if (!ai) return jsonResponse({ success: false, error: 'ยังไม่ได้ตั้งค่า Gemini' }, { status: 503 });

    const prompt = `คุณคือผู้เชี่ยวชาญด้านเศรษฐกิจและการลงทุนอสังหาริมทรัพย์ชั้นนำประจำจังหวัดสงขลาและอำเภอหาดใหญ่แห่ง "ฉันทากร พร็อพเพอร์ตี้ (Chantakorn Property)"
จงค้นหาข้อมูลอัปเดตล่าสุดจาก Google Search และให้บทวิเคราะห์ที่แม่นยำ ทันสมัย อ้างอิงข้อมูลจริงเชิงตัวเลข

คำถาม/หัวข้อที่ต้องการวิเคราะห์:
"${query}"

คำแนะนำการตอบ:
1. สรุปสถานการณ์และแนวโน้มล่าสุดอย่างกระชับ เจาะลึก มีความเป็นมืออาชีพสูง
2. ระบุตัวเลข สถิติ หรือข้อเท็จจริงสำคัญ (เช่น ราคาประเมิน, ดอกเบี้ย, อัตราผลตอบแทน Yield, กำหนดการโครงการ)
3. ให้คำแนะนำเชิงกลยุทธ์สำหรับผู้ซื้อเพื่ออยู่อาศัย และนักลงทุนอสังหาฯ ในหาดใหญ่-สงขลา
4. ใช้ภาษาไทยที่สุภาพ น่าเชื่อถือ ชัดเจน`;

    let responseText = '';
    let uniqueSources: GroundingSource[] = [];
    let searchQueries: string[] = [];

    try {
      const { response } = await generateGeminiContent(ai, {
        model: GEMINI_PRIMARY_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      responseText = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const webChunks = (groundingMetadata?.groundingChunks || [])
        .map((chunk: any) => ({
          title: chunk.web?.title || 'แหล่งข้อมูลอ้างอิง',
          uri: chunk.web?.uri || '',
        }))
        .filter((c: any) => c.uri);

      const seenUris = new Set<string>();
      for (const source of webChunks) {
        if (!seenUris.has(source.uri)) {
          seenUris.add(source.uri);
          uniqueSources.push(source);
        }
      }

      searchQueries = groundingMetadata?.webSearchQueries || [];
    } catch (genError) {
      throw genError;
    }
    if (!responseText) throw new Error('Gemini ไม่ส่งคำตอบกลับมา');

    const finalResult = {
      answer: responseText,
      sources: uniqueSources,
      searchQueries,
      timestamp: new Date().toISOString(),
    };

    // Store in cache to minimize future API calls
    insightCache.set(cacheKey, { data: finalResult, cachedAt: Date.now() });

    return jsonResponse({
      success: true,
      ...finalResult,
    });
  } catch {
    return jsonResponse({ success: false, error: 'ไม่สามารถค้นหาข้อมูลผ่าน Gemini ได้ กรุณาลองอีกครั้ง' }, { status: 503 });
  }
}
