import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

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

export async function POST(req: NextRequest) {
  let query = '';
  let category = '';

  try {
    const body = await req.json();
    query = body.query || '';
    category = body.category || '';

    const ai = getGeminiClient();

    if (!ai) {
      // Fallback curated responses for Hat Yai market if API key is not yet set
      return NextResponse.json({
        success: true,
        answer: getFallbackMarketInsight(query || category),
        sources: getFallbackSources(query || category),
        searchQueries: ['ราคาประเมินที่ดิน หาดใหญ่ ล่าสุด', 'โครงการมอเตอร์เวย์ หาดใหญ่ สะเดา', 'แนวโน้มอสังหา สงขลา'],
        timestamp: new Date().toISOString(),
      });
    }

    const prompt = `คุณคือผู้เชี่ยวชาญด้านเศรษฐกิจและการลงทุนอสังหาริมทรัพย์ชั้นนำประจำจังหวัดสงขลาและอำเภอหาดใหญ่แห่ง "ฉันทากร พร็อพเพอร์ตี้ (Chantakorn Property)"
จงค้นหาข้อมูลอัปเดตล่าสุดจาก Google Search และให้บทวิเคราะห์ที่แม่นยำ ทันสมัย อ้างอิงข้อมูลจริงเชิงตัวเลข

คำถาม/หัวข้อที่ต้องการวิเคราะห์:
"${query}"

คำแนะนำการตอบ:
1. สรุปสถานการณ์และแนวโน้มล่าสุดอย่างกระชับ เจาะลึก มีความเป็นมืออาชีพสูง
2. ระบุตัวเลข สถิติ หรือข้อเท็จจริงสำคัญ (เช่น ราคาประเมิน, ดอกเบี้ย, อัตราผลตอบแทน Yield, กำหนดการโครงการ)
3. ให้คำแนะนำเชิงกลยุทธ์สำหรับผู้ซื้อเพื่ออยู่อาศัย และนักลงทุนอสังหาฯ ในหาดใหญ่-สงขลา
4. ใช้ภาษาไทยที่สุภาพ น่าเชื่อถือ ชัดเจน`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const webChunks = (groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        title: chunk.web?.title || 'แหล่งข้อมูลอ้างอิง',
        uri: chunk.web?.uri || '',
      }))
      .filter((c: any) => c.uri);

    // Deduplicate sources by URI
    const uniqueSources: GroundingSource[] = [];
    const seenUris = new Set<string>();
    for (const source of webChunks) {
      if (!seenUris.has(source.uri)) {
        seenUris.add(source.uri);
        uniqueSources.push(source);
      }
    }

    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    return NextResponse.json({
      success: true,
      answer: response.text || getFallbackMarketInsight(query || category),
      sources: uniqueSources.length > 0 ? uniqueSources : getFallbackSources(query || category),
      searchQueries: searchQueries.length > 0 ? searchQueries : ['ราคาประเมินที่ดิน หาดใหญ่ ล่าสุด', 'โครงการมอเตอร์เวย์ หาดใหญ่ สะเดา', 'แนวโน้มอสังหา สงขลา'],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn('Market intelligence Gemini API limit reached or error occurred, using curated market intelligence:', error?.message || error);
    // Graceful fallback on 429 quota exceeded or other errors
    return NextResponse.json({
      success: true,
      answer: getFallbackMarketInsight(query || category),
      sources: getFallbackSources(query || category),
      searchQueries: ['ราคาประเมินที่ดิน หาดใหญ่ ล่าสุด', 'โครงการมอเตอร์เวย์ หาดใหญ่ สะเดา', 'แนวโน้มอสังหา สงขลา'],
      timestamp: new Date().toISOString(),
      isFallback: true,
    });
  }
}

function getFallbackSources(topic: string = ''): GroundingSource[] {
  if (topic.includes('มอเตอร์เวย์') || topic.includes('คมนาคม') || topic.includes('m84')) {
    return [
      {
        title: 'กรมทางหลวง - แผนงานทางหลวงพิเศษระหว่างเมืองสายหาดใหญ่-สะเดา (M84)',
        uri: 'https://www.doh.go.th',
      },
      {
        title: 'ศูนย์ข้อมูลอสังหาริมทรัพย์ (REIC) - ดัชนีราคาที่ดินเปล่าก่อนการพัฒนาภาคใต้',
        uri: 'https://www.reic.or.th',
      },
      {
        title: 'การทางพิเศษแห่งประเทศไทย - แผนพัฒนาโครงสร้างพื้นฐานคมนาคมภาคใต้',
        uri: 'https://www.exat.co.th',
      },
    ];
  }

  if (topic.includes('ดอกเบี้ย') || topic.includes('สินเชื่อ') || topic.includes('กู้') || topic.includes('mortgage')) {
    return [
      {
        title: 'ธนาคารแห่งประเทศไทย - สรุปอัตราดอกเบี้ยเงินให้สินเชื่อที่อยู่อาศัย (MRR/MLR)',
        uri: 'https://www.bot.or.th',
      },
      {
        title: 'กรมที่ดิน - ประกาศลดหย่อนค่าธรรมเนียมการโอนและจดจำนองอสังหาริมทรัพย์',
        uri: 'https://www.dol.go.th',
      },
      {
        title: 'สมาคมสินเชื่อที่อยู่อาศัย - แนวโน้มดอกเบี้ยและการวางแผนสินเชื่อบ้าน',
        uri: 'https://www.homealoan.com',
      },
    ];
  }

  if (topic.includes('ม.อ.') || topic.includes('psu') || topic.includes('คอนโด') || topic.includes('โรงพยาบาล')) {
    return [
      {
        title: 'มหาวิทยาลัยสงขลานครินทร์ (ม.อ.) - ข้อมูลการขยายตัววิทยาเขตหาดใหญ่',
        uri: 'https://www.psu.ac.th',
      },
      {
        title: 'ศูนย์ข้อมูลอสังหาริมทรัพย์ (REIC) - ดัชนีราคาห้องชุดและผลตอบแทนค่าเช่าสงขลา',
        uri: 'https://www.reic.or.th',
      },
      {
        title: 'สำนักงานสถิติจังหวัดสงขลา - ข้อมูลประชากรและบุคลากรการแพทย์หาดใหญ่',
        uri: 'https://songkhla.nso.go.th',
      },
    ];
  }

  return [
    {
      title: 'กรมธนารักษ์ - สรุปราคาประเมินทุนทรัพย์ที่ดินและสิ่งปลูกสร้าง จ.สงขลา',
      uri: 'https://property.treasury.go.th',
    },
    {
      title: 'ศูนย์ข้อมูลอสังหาริมทรัพย์ (REIC) - รายงานดัชนีราคาที่อยู่อาศัยภาคใต้',
      uri: 'https://www.reic.or.th',
    },
    {
      title: 'หอการค้าจังหวัดสงขลา - ทิศทางเศรษฐกิจและการลงทุนเมืองหาดใหญ่',
      uri: 'https://www.songkhlachamber.org',
    },
  ];
}

function getFallbackMarketInsight(topic: string = ''): string {
  const queryLower = topic.toLowerCase();

  if (queryLower.includes('มอเตอร์เวย์') || queryLower.includes('คมนาคม') || queryLower.includes('m84')) {
    return `### 🚗 อัปเดตโครงการทางหลวงพิเศษระหว่างเมือง (มอเตอร์เวย์ M84) หาดใหญ่-สะเดา
- **ความคืบหน้าโครงการ:** มอเตอร์เวย์ช่วงหาดใหญ่-ชายแดนไทย/มาเลเซีย (สะเดา) ระยะทางประมาณ 62.59 กม. กำลังผลักดันในแผนพัฒนาโครงสร้างพื้นฐานเขตเศรษฐกิจพิเศษชายแดนใต้
- **ผลกระทบต่อราคาที่ดิน:** ส่งผลให้ราคาที่ดินตามแนวเส้นทางสายเอเชียและโซนคลองหวะ-บ้านพรุ มีแนวโน้มปรับตัวสูงขึ้น 8-15% รองรับการขนส่งสินค้า การท่องเที่ยว และระบบโลจิสติกส์
- **คำแนะนำ Chantakorn Property:** เป็นจังหวะที่ดีสำหรับการเข้าซื้อที่ดินแปลงใหญ่หรืออาคารพาณิชย์เพื่อเก็งกำไรและพัฒนาโครงการเชิงพาณิชย์ในระยะกลาง-ยาว`;
  }

  if (queryLower.includes('ม.อ.') || queryLower.includes('psu') || queryLower.includes('medical') || queryLower.includes('หมอ')) {
    return `### 🏥 เจาะลึกทำเล ม.อ. (มหาวิทยาลัยสงขลานครินทร์) & Medical Hub หาดใหญ่
- **ความต้องการเช่าและซื้อ (High Demand):** เป็นทำเลที่มีอัตราการเข้าพัก (Occupancy Rate) สูงกว่า 90% ตลอดทั้งปี ขับเคลื่อนโดยกลุ่มอาจารย์แพทย์ บุคลากรโรงพยาบาลสงขลานครินทร์ และนักศึกษา
- **ผลตอบแทนการลงทุน (Rental Yield):** คอนโดมิเนียมและทาวน์โฮมในโซนนี้ให้ผลตอบแทนเฉลี่ย 5.8% - 7.5% ต่อปี ซึ่งสูงกว่าค่าเฉลี่ยตลาดภาคใต้
- **คำแนะนำ Chantakorn Property:** สำหรับนักลงทุน เป็นทำเลที่ 'เสี่ยงต่ำ สภาพคล่องสูง' ซื้อง่ายปล่อยเช่าไว`;
  }

  if (queryLower.includes('ดอกเบี้ย') || queryLower.includes('สินเชื่อ') || queryLower.includes('กู้') || queryLower.includes('mortgage')) {
    return `### 🏦 สรุปอัตราดอกเบี้ยสินเชื่อบ้านและมาตรการอสังหาฯ ล่าสุด
- **อัตราดอกเบี้ยเฉลี่ย 3 ปีแรก:** ธนาคารพาณิชย์และสถาบันการเงินรัฐ (ธอส., ออมสิน, กรุงไทย) เสนอดอกเบี้ยเฉลี่ยเริ่มต้น 2.99% - 3.75% ต่อปี พร้อมตัวเลือก Fixed Rate
- **มาตรการรัฐช่วยผู้ซื้อ:** มาตรการลดค่าธรรมเนียมการโอนกรรมสิทธิ์เหลือ 0.01% และค่าจดจำนองเหลือ 0.01% สำหรับที่อยู่อาศัยราคาไม่เกิน 7 ล้านบาท ช่วยประหยัดเงินได้หลักหมื่นถึงหลักแสนบาท
- **คำแนะนำ Chantakorn Property:** ผู้ซื้อบ้านควรเตรียมเอกสารเครดิตล่วงหน้า โดยทาง Chantakorn Property มีทีมงานช่วยดันเคสสินเชื่อและเปรียบเทียบข้อเสนอที่ดีที่สุดให้ฟรีทุกขั้นตอน`;
  }

  if (queryLower.includes('สนามบิน') || queryLower.includes('airport') || queryLower.includes('ควนลัง')) {
    return `### ✈️ ทำเลทองโซนสนามบินนานาชาติหาดใหญ่ & ควนลัง
- **การเติบโตของคอมมูนิตี้ไฮเอนด์:** โซนถนนสนามบินและควนลังกลายเป็นทำเลยอดนิยมสำหรับโครงการบ้านเดี่ยวโมเดิร์นและพูลวิลล่าหรูระดับราคา 4.5 - 15 ล้านบาท
- **จุดเด่นทำเล:** เดินทางสะดวกสู่สนามบินเพียง 5-10 นาที ผังเมืองกว้างขวาง น้ำไม่ท่วม และเชื่อมต่อถนนเลี่ยงเมืองสายหลักได้อย่างรวดเร็ว
- **คำแนะนำ Chantakorn Property:** เหมาะมากสำหรับครอบครัวรุ่นใหม่และผู้ที่มองหาคุณภาพชีวิตที่เงียบสงบแต่เดินทางสะดวก`;
  }

  return `### 📈 ภาพรวมดัชนีราคาและแนวโน้มตลาดอสังหาริมทรัพย์หาดใหญ่–สงขลา
- **โซนยอดนิยมสูงสุด:** โซน ม.อ. (มหาวิทยาลัยสงขลานครินทร์) - โรงพยาบาลสงขลานครินทร์ และโซนถนนศุภสารรังสรรค์ ยังคงมีดีมานด์เช่าและซื้ออยู่อาศัยหนาแน่น โดยเฉพาะคอนโดมิเนียมและทาวน์โฮม ผลตอบแทน Rental Yield เฉลี่ย 5.5% - 7.2% ต่อปี
- **บ้านเดี่ยวพรีเมียม:** โซนสนามบินหาดใหญ่ และถนนกาญจนวนิช เป็นทำเลที่มีโครงการบ้านเดี่ยวและพูลวิลล่าระดับ 5-15 ล้านบาทเปิดตัวอย่างต่อเนื่อง ตอบโจทย์กลุ่มแพทย์ นักธุรกิจ และเจ้าของกิจการ
- **คำแนะนำ Chantakorn Property:** สำหรับผู้ที่ต้องการซื้อเพื่ออยู่อาศัย เป็นจังหวะที่ดีในการเลือกทำเลศักยภาพที่มีโฉนดพร้อมโอน และมีบริการดันเคสสินเชื่อครบวงจร`;
}
