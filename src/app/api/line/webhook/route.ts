import { jsonResponse } from '@/lib/api-response';
import { Property } from '@/lib/types';
import { requireStaff } from '@/lib/server-auth';
import { createFirestoreDocument, listFirestoreDocuments, patchFirestoreDocument } from '@/lib/firestore-rest';
import { getLinePropertyImageUrl } from '@/lib/line-property-image';
import { formatPropertyCode } from '@/lib/format-code';

const OFFICIAL_LINE_OA_URL = 'https://lin.ee/NMSe28T3';
const DEFAULT_PHONE = '081-604-0097';
const DEFAULT_LINE_ID = '@930xzcyi';

interface LineOaConfig {
  channelAccessToken: string;
  channelSecret: string;
  targetUserId: string;
}

async function getLineConfig(): Promise<LineOaConfig> {
  return {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    targetUserId: process.env.LINE_TARGET_USER_ID || '',
  };
}

// Verify LINE Signature using HMAC-SHA256
async function verifyLineSignature(bodyText: string, signature: string | null, channelSecret: string): Promise<boolean> {
  if (!channelSecret || !channelSecret.trim()) {
    return false;
  }
  if (!signature) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(channelSecret.trim()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText)));
    const expected = btoa(String.fromCharCode(...digest));
    if (expected.length !== signature.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    }
    return difference === 0;
  } catch {
    console.error('[LINE Webhook] Signature verification failed', { code: 'LINE_SIGNATURE_ERROR' });
    return false;
  }
}

// Send reply message using LINE Messaging API
type ReplyResult = { success: true } | { success: false; code: string };

async function replyLineMessage(replyToken: string, channelAccessToken: string, messages: any[]): Promise<ReplyResult> {
  if (!channelAccessToken || !channelAccessToken.trim()) {
    return { success: false, code: 'LINE_TOKEN_MISSING' };
  }

  if (typeof replyToken !== 'string' || !replyToken || replyToken === '00000000000000000000000000000000' || replyToken.startsWith('test_')) {
    // Verification has no events; simulated events are handled separately.
    return { success: false, code: 'LINE_REPLY_TOKEN_INVALID' };
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken.trim()}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: messages.slice(0, 5), // LINE supports max 5 messages per reply
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // Classify LINE's validation response without logging its body, which may echo customer data.
      let validationMessage = '';
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.message === 'string') validationMessage = errorBody.message;
      } catch { /* The HTTP status still identifies the failure category. */ }
      const code = response.status === 401 || response.status === 403 ? 'LINE_TOKEN_REJECTED'
        : response.status === 429 ? 'LINE_RATE_LIMITED'
        : response.status === 400 && /invalid reply token/i.test(validationMessage) ? 'LINE_REPLY_TOKEN_EXPIRED'
        : response.status === 400 ? 'LINE_MESSAGE_INVALID'
        : 'LINE_REPLY_UNAVAILABLE';
      console.error('[LINE Webhook] Reply rejected', { code, status: response.status });
      return { success: false, code };
    }

    return { success: true };
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
    const code = name === 'TimeoutError' || name === 'AbortError' ? 'LINE_REPLY_TIMEOUT' : 'LINE_REPLY_NETWORK_ERROR';
    console.error('[LINE Webhook] Reply request failed', { code });
    return { success: false, code };
  }
}

// Save customer inquiry into Firestore database
type InquiryData = {
  userId?: string;
  name?: string;
  message: string;
  inquiry_type?: string;
  property_title?: string;
};

async function saveInquiry(inquiryData: InquiryData): Promise<boolean> {
  try {
    const response = await createFirestoreDocument('inquiries', {
      name: inquiryData.name || `ลูกค้า LINE OA (${inquiryData.userId ? inquiryData.userId.slice(0, 8) : 'ผู้ใช้'})`,
      phone: '-',
      line_id: inquiryData.userId || '-',
      message: inquiryData.message,
      inquiry_type: inquiryData.inquiry_type || 'inquiry',
      property_title: inquiryData.property_title || '',
      status: 'new',
      created_at: new Date().toISOString(),
      source: 'line_messaging_api_webhook',
    });
    if (!response.ok) {
      console.warn('[LINE Webhook] Inquiry storage failed', { code: 'INQUIRY_STORAGE_UNAVAILABLE', status: response.status });
      return false;
    }
    return true;
  } catch {
    console.warn('[LINE Webhook] Inquiry storage failed', { code: 'INQUIRY_STORAGE_UNAVAILABLE' });
    return false;
  }
}

// Register/refresh the LINE follower so the system can notify them about new properties later.
async function upsertFollower(userId: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const response = await patchFirestoreDocument('line_followers', userId, {
      user_id: userId,
      followed_at: nowIso,
      last_active_at: nowIso,
      is_active: true,
      source: 'line_webhook',
    });
    if (!response.ok) {
      console.warn('[LINE Webhook] Follower storage failed', { code: 'FOLLOWER_STORAGE_UNAVAILABLE', status: response.status });
      return false;
    }
    return true;
  } catch {
    console.warn('[LINE Webhook] Follower storage failed', { code: 'FOLLOWER_STORAGE_UNAVAILABLE' });
    return false;
  }
}

type PropertySearchResult =
  | { status: 'available'; properties: Property[]; publishedCount: number }
  | { status: 'unavailable' };

const PROPERTY_TYPES = [
  { type: 'land', pattern: /ที่ดิน|\bland\b/gi },
  { type: 'condo', pattern: /คอนโด(?:มิเนียม)?|\bcondo(?:minium)?\b/gi },
  { type: 'commercial', pattern: /อาคารพาณิชย์|ตึกแถว|ร้านค้า|โฮมออฟฟิศ|\bcommercial\b/gi },
  { type: 'investment', pattern: /ลงทุน|อพาร์ทเมนท์|อพาร์ทเม้นท์|อพาร์ตเมนต์|โรงแรม|\binvestment\b/gi },
  { type: 'consignment', pattern: /ขายฝาก|\bconsignment\b/gi },
  { type: 'house', pattern: /บ้าน(?:เดี่ยว)?|ทาวน์(?:โฮม|เฮ้าส์|เฮาส์)|\bhouse\b|\btownhome\b/gi },
];

function matchesPropertySearch(property: Property, keyword: string, knownLocations: string[]): boolean {
  let query = keyword.toLowerCase().trim();
  const code = query.match(/\bckp?-[a-z0-9]+\b/i)?.[0];
  if (code) return formatPropertyCode(property.id).toLowerCase() === code;
  if (property.id && query === property.id.toLowerCase()) return true;

  // Protect place names such as บ้านพรุ from being mistaken for the house category.
  const requestedLocations: string[] = [];
  for (const location of knownLocations) {
    if (query.includes(location)) {
      requestedLocations.push(location);
      query = query.split(location).join(' ');
    }
  }
  const propertyLocation = [property.district, property.subdistrict, property.province].filter(Boolean).join(' ').toLowerCase();
  if (requestedLocations.some(location => !propertyLocation.includes(location))) return false;

  const requestedTypes: string[] = [];
  for (const { type, pattern } of PROPERTY_TYPES) {
    query = query.replace(pattern, () => { requestedTypes.push(type); return ' '; });
  }
  const wantsRent = /เช่า|\brent\b/.test(query);
  const wantsSale = /ขาย|ซื้อ|\bsale\b|\bbuy\b/.test(query);
  query = query.replace(/เช่า|ขาย|ซื้อ|\brent\b|\bsale\b|\bbuy\b/g, ' ');
  if (requestedTypes.length && !requestedTypes.includes(property.property_type)) return false;
  if (wantsRent && !wantsSale && property.status !== 'rent') return false;
  if (wantsSale && !wantsRent && property.status !== 'sale') return false;

  // Remove conversational phrasing while retaining unknown places/keywords as constraints.
  query = query.replace(/อสังหาริมทรัพย์|อสังหาฯ|รายการทรัพย์|ดูทรัพย์|ค้นหาทรัพย์|ทรัพย์ทั้งหมด|ทั้งหมด|\ball\b|\bproperties\b|\bproperty\b|\bplease\b|\bfind\b|\bshow\b/gi, ' ').trim();
  query = query.replace(/^(?:(?:ต้องการ|กำลัง|สนใจ|อยาก|ค้นหา|ช่วยหา|มี|ขอดู|ขอ|ดู|หา|แถว|โซน|ย่าน|บริเวณ|ให้|ปล่อย|สำหรับ|ใน|ที่)(?=\s|$)\s*)+/, ' ');
  query = query.replace(/(?:\s*(?:ไหม|มั้ย|บ้าง|หน่อย|ครับ|ค่ะ|คะ|นะ))+\s*$/, ' ');
  query = query.replace(/(^|\s)(?:และ|หรือ|ใน|ที่)(?=\s|$)|(^|\s)(?:อ\.|ต\.|จ\.|อำเภอ|ตำบล|จังหวัด)/g, ' ');
  const terms = query.split(/[\s,/?!ๆ]+/).filter(Boolean);
  const searchable = [property.title, property.description, property.district, property.subdistrict, property.province, property.slug]
    .filter(value => typeof value === 'string').join(' ').toLowerCase();
  return terms.every(term => searchable.includes(term));
}

function isConsignmentRequest(text: string): boolean {
  return /ฝากขาย|ฝากเช่า|ประเมิน|จำนอง|(?:ต้องการ|อยาก|จะ|ช่วย|รับ)\s*ขาย|(?:ผม|ฉัน|ดิฉัน|เรา)\s*(?:มี.*)?(?:ขายบ้าน|ขายที่ดิน)|ปล่อยเช่า|\bconsignment\b/.test(text);
}

// Search only published production listings; failed storage is different from zero matches.
async function searchProperties(keyword: string): Promise<PropertySearchResult> {
  try {
    const list = ((await listFirestoreDocuments('properties', 200, { publishedOnly: true })) as Property[])
      .filter((property) => property.published === true);
    const knownLocations = [...new Set(list.flatMap(property => [property.district, property.subdistrict, property.province])
      .filter((location): location is string => typeof location === 'string' && location.trim().length > 0)
      .map(location => location.toLowerCase().trim()))].sort((a, b) => b.length - a.length);
    return { status: 'available', properties: list.filter(property => matchesPropertySearch(property, keyword, knownLocations)).slice(0, 8), publishedCount: list.length };
  } catch {
    console.warn('[LINE Webhook] Property search failed', { code: 'PROPERTY_STORAGE_UNAVAILABLE' });
    return { status: 'unavailable' };
  }
}

function buildSearchUnavailableMessage(result: PropertySearchResult, hostOrigin: string) {
  const text = result.status === 'unavailable'
    ? 'ขณะนี้ระบบค้นหาทรัพย์ใน LINE ขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง หรือดูรายการบนเว็บไซต์'
    : result.publishedCount === 0
      ? 'ขณะนี้ยังไม่มีรายการทรัพย์ที่เผยแพร่ในระบบ สามารถติดตามรายการใหม่บนเว็บไซต์ หรือติดต่อทีมงานได้'
      : 'ยังไม่พบทรัพย์ที่ตรงกับคำค้น ลองระบุประเภททรัพย์และทำเล เช่น ที่ดิน สิงหนคร หรือดูรายการทั้งหมดบนเว็บไซต์';
  return { type: 'text', text: `${text}\n${hostOrigin}/properties\nโทร ${DEFAULT_PHONE}` };
}

// Build LINE Flex Carousel for Properties
function buildPropertyCarouselFlex(properties: Property[], hostOrigin: string, queryTitle: string, imageOrigin: string): any {
  const bubbles = properties.slice(0, 10).map((p) => {
    const priceFormatted = p.price
      ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(p.price)
      : 'ราคาพิเศษ';
    const actionText = p.status === 'rent' ? 'ปล่อยเช่า' : 'เสนอขาย';
    const propertyKey = (p.id ? formatPropertyCode(p.id) : '') || p.slug;
    const detailUrl = propertyKey ? `${hostOrigin}/properties/${encodeURIComponent(propertyKey)}` : `${hostOrigin}/properties/`;
    const coverImg = getLinePropertyImageUrl(p, imageOrigin);

    return {
      type: 'bubble',
      size: 'kilo',
      ...(coverImg ? { hero: {
        type: 'image',
        url: coverImg,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: {
          type: 'uri',
          uri: detailUrl,
        },
      } } : {}),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '13px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `${actionText}อสังหาฯ`,
                weight: 'bold',
                color: '#B45309',
                size: 'xxs',
                flex: 1,
              },
              {
                type: 'text',
                text: p.property_type === 'land' ? 'ที่ดิน' : p.property_type === 'condo' ? 'คอนโด' : 'บ้านเดี่ยว/ทาวน์เฮ้าส์',
                color: '#6B7280',
                size: 'xxs',
                align: 'end',
                flex: 1,
              },
            ],
          },
          {
            type: 'text',
            text: p.title || 'อสังหาริมทรัพย์หาดใหญ่-สงขลา',
            weight: 'bold',
            size: 'sm',
            wrap: true,
            maxLines: 2,
            color: '#0F172A',
          },
          {
            type: 'text',
            text: `📍 ต.${p.subdistrict || 'ควนลัง'} อ.${p.district || 'หาดใหญ่'} จ.สงขลา`,
            size: 'xxs',
            color: '#64748B',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'baseline',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `${priceFormatted}${p.status === 'rent' ? '/เดือน' : ''}`,
                weight: 'bold',
                size: 'md',
                color: '#059669',
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: `🛏️ ${p.bedrooms || 0} นอน`,
                size: 'xxs',
                color: '#475569',
              },
              {
                type: 'text',
                text: `🚿 ${p.bathrooms || 0} น้ำ`,
                size: 'xxs',
                color: '#475569',
              },
              {
                type: 'text',
                text: `📐 ${p.usable_area || p.land_size || '-'} ตร.ม.`,
                size: 'xxs',
                color: '#475569',
                align: 'end',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        paddingAll: '10px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#0F172A',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียดบนเว็บ ➔',
              uri: detailUrl,
            },
          },
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            color: '#06C755',
            action: {
              type: 'uri',
              label: `โทรด่วน ${DEFAULT_PHONE}`,
              uri: `tel:${DEFAULT_PHONE.replace(/[^0-9]/g, '')}`,
            },
          },
        ],
      },
    };
  });

  return {
    type: 'flex',
    altText: `🏡 รายการอสังหาริมทรัพย์ที่ค้นพบ (${Array.from(queryTitle).slice(0, 120).join('')}) - Chantakorn Property`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

// Build Main Menu / Welcome Flex Message
function buildWelcomeFlex(hostOrigin: string): any {
  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ Chantakorn Property (ฉันทากร พร็อพเพอร์ตี้ หาดใหญ่)',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        size: 'full',
        aspectRatio: '20:11',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'CHANTAKORN PROPERTY',
            weight: 'bold',
            color: '#D97706',
            size: 'xs',
            letterSpacing: '2px',
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่บริการอสังหาฯ ครบวงจร',
            weight: 'bold',
            size: 'lg',
            color: '#0F172A',
          },
          {
            type: 'text',
            text: 'ศูนย์รวมบ้านเดี่ยว ทาวน์โฮม คอนโด และที่ดินทำเลศักยภาพ หาดใหญ่-สงขลา พร้อมบริการรับฝากขาย วิเคราะห์ราคา และตรวจฮวงจุ้ยฟรี',
            size: 'xs',
            color: '#475569',
            wrap: true,
            lineSpacing: '3px',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#0F172A',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '🏠 ดูทรัพย์เด่นทั้งหมดบนเว็บไซต์',
                  uri: `${hostOrigin}/properties`,
                },
              },
              {
                type: 'button',
                style: 'secondary',
                color: '#06C755',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '📝 ส่งข้อมูลฝากขายบ้าน / ที่ดิน ฟรี',
                  uri: `${hostOrigin}/sell`,
                },
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '📊 คำนวณสินเชื่อ / ประเมินราคา',
                  uri: `${hostOrigin}/valuation`,
                },
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            color: '#059669',
            action: {
              type: 'uri',
              label: `📞 ติดต่อนายหน้า (${DEFAULT_PHONE})`,
              uri: `tel:${DEFAULT_PHONE.replace(/[^0-9]/g, '')}`,
            },
          },
        ],
      },
    },
  };
}

// Build Consignment Service Flex Message
function buildConsignmentFlex(hostOrigin: string): any {
  return {
    type: 'flex',
    altText: 'บริการรับฝากขายอสังหาริมทรัพย์ หาดใหญ่-สงขลา - Chantakorn Property',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '🏡 บริการรับฝากขาย - ปล่อยเช่า ฟรีค่าการตลาด!',
            weight: 'bold',
            size: 'md',
            color: '#0F172A',
            wrap: true,
          },
          {
            type: 'text',
            text: 'ต้องการฝากขายบ้าน ที่ดิน คอนโด ในโซนหาดใหญ่ สงขลา หรือภาคใต้? ทีมงาน Chantakorn พร้อมดูแลทำการตลาดออนไลน์ วิเคราะห์ราคาตลาด และพาชมทรัพย์จนกว่าจะปิดการขาย',
            size: 'xs',
            color: '#475569',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            backgroundColor: '#F8FAFC',
            paddingAll: '10px',
            cornerRadius: '8px',
            contents: [
              {
                type: 'text',
                text: '✓ ถ่ายภาพ/วิดีโอทรัพย์มุมมองสวยงามฟรี',
                size: 'xxs',
                color: '#059669',
                weight: 'bold',
              },
              {
                type: 'text',
                text: '✓ วิเคราะห์ราคาประเมินและทิศทางฮวงจุ้ย',
                size: 'xxs',
                color: '#059669',
                weight: 'bold',
              },
              {
                type: 'text',
                text: '✓ ยิงโฆษณาโซเชียลมีเดียและโปรโมทบนเว็บไซต์ชั้นนำ',
                size: 'xxs',
                color: '#059669',
                weight: 'bold',
              },
            ],
          },
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: {
              type: 'uri',
              label: 'กรอกแบบฟอร์มฝากขายทันที ➔',
              uri: `${hostOrigin}/sell`,
            },
          },
        ],
      },
    },
  };
}

// Build Contact & Agent Info Flex Message
function buildContactFlex(hostOrigin: string): any {
  return {
    type: 'flex',
    altText: 'ติดต่อทีมงาน Chantakorn Property',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '🏢 CHANTAKORN PROPERTY',
            weight: 'bold',
            size: 'md',
            color: '#0F172A',
          },
          {
            type: 'text',
            text: 'ตัวแทนอสังหาริมทรัพย์มืออาชีพ หาดใหญ่-สงขลา',
            size: 'xs',
            color: '#D97706',
            weight: 'bold',
          },
          {
            type: 'separator',
            margin: 'sm',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `📞 เบอร์โทรศัพท์: ${DEFAULT_PHONE}`,
                size: 'xs',
                color: '#1E293B',
                weight: 'bold',
              },
              {
                type: 'text',
                text: `💬 LINE Official: ${DEFAULT_LINE_ID}`,
                size: 'xs',
                color: '#06C755',
                weight: 'bold',
              },
              {
                type: 'text',
                text: '📍 พื้นที่บริการ: อ.หาดใหญ่, อ.เมืองสงขลา, อ.สิงหนคร, และพื้นที่ใกล้เคียง',
                size: 'xs',
                color: '#64748B',
                wrap: true,
              },
              {
                type: 'text',
                text: '⏰ เวลาทำการ: จันทร์ - อาทิตย์ (08:30 - 18:00 น.)',
                size: 'xs',
                color: '#64748B',
              },
            ],
          },
          {
            type: 'button',
            style: 'primary',
            color: '#0F172A',
            margin: 'md',
            action: {
              type: 'uri',
              label: `โทรหานายหน้า (${DEFAULT_PHONE})`,
              uri: `tel:${DEFAULT_PHONE.replace(/[^0-9]/g, '')}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#06C755',
            action: {
              type: 'uri',
              label: 'เยี่ยมชมเว็บไซต์หลัก',
              uri: hostOrigin,
            },
          },
        ],
      },
    },
  };
}

// GET: Health Check & Webhook Diagnostic Endpoint
export async function GET(req: Request) {
  const config = await getLineConfig();
  const hostOrigin = new URL(req.url).origin;
  const isChannelAccessTokenConfigured = Boolean(config.channelAccessToken?.trim());
  const isChannelSecretConfigured = Boolean(config.channelSecret?.trim());

  return jsonResponse({
    status: isChannelAccessTokenConfigured && isChannelSecretConfigured ? 'configured' : 'configuration_required',
    buildRevision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_BUILD_SHA || 'unknown',
    credentialValidation: 'presence_only',
    service: 'LINE Messaging API Webhook for Chantakorn Property',
    webhookEndpoint: `${hostOrigin}/api/line/webhook`,
    officialLineOaUrl: OFFICIAL_LINE_OA_URL,
    lineId: DEFAULT_LINE_ID,
    isChannelAccessTokenConfigured,
    isChannelSecretConfigured,
    signatureVerificationSupported: true,
    supportedEvents: ['message (text)', 'follow', 'postback'],
    instructions: {
      step1: 'คัดลอก Webhook URL ไปวางใน LINE Developers Console > Messaging API > Webhook settings',
      step2: 'เปิดใช้งานสวิตช์ "Use webhook" เป็น Enabled',
      step3: 'กดปุ่ม Verify เพื่อตรวจสอบความถูกต้องของระบบ',
    },
    timestamp: new Date().toISOString(),
  });
}

// POST: Handles incoming LINE Messaging API Webhook events
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature');
    const config = await getLineConfig();

    // Admin-only test requests can simulate LINE events without weakening real webhook verification.
    const isSimulation = req.headers.get('x-line-simulation') === 'true';
    if (isSimulation) {
      const denied = await requireStaff(req);
      if (denied) return denied;
    } else if (!(await verifyLineSignature(rawBody, signature, config.channelSecret))) {
      console.warn('[LINE Webhook] Invalid x-line-signature header received.');
      return jsonResponse(
        { success: false, error: 'Invalid signature verification' },
        { status: 401 }
      );
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !Array.isArray(body.events) || body.events.some((event: any) =>
      !event || typeof event !== 'object' || typeof event.type !== 'string' ||
      (event.type === 'message' && event.message?.type === 'text' && typeof event.message.text !== 'string')
    )) {
      return jsonResponse({ success: false, error: 'Invalid event payload', code: 'LINE_EVENT_PAYLOAD_INVALID' }, { status: 400 });
    }
    const events: any[] = body.events;
    const imageOrigin = new URL(req.url).origin;
    const hostOrigin = (process.env.NEXT_PUBLIC_SITE_URL || imageOrigin).replace(/\/+$/, '');
    let failedReplies = 0;
    let successfulReplies = 0;
    let simulatedReplies = 0;
    let unavailableSearches = 0;
    const errorCodes = new Set<string>();
    const pendingInquiries: InquiryData[] = [];
    const pendingFollowers = new Set<string>();
    const reply = async (replyToken: string, messages: any[]) => {
      if (isSimulation) {
        simulatedReplies += 1;
      } else {
        const result = await replyLineMessage(replyToken, config.channelAccessToken, messages);
        if (result.success) successfulReplies += 1;
        else {
          failedReplies += 1;
          errorCodes.add(result.code);
        }
      }
    };
    const replyWithProperties = async (replyToken: string, keyword: string) => {
      const result = await searchProperties(keyword);
      if (result.status === 'unavailable') {
        unavailableSearches += 1;
        errorCodes.add('PROPERTY_STORAGE_UNAVAILABLE');
      }
      const message = result.status === 'available' && result.properties.length > 0
        ? buildPropertyCarouselFlex(result.properties, hostOrigin, keyword, imageOrigin)
        : buildSearchUnavailableMessage(result, hostOrigin);
      await reply(replyToken, [message]);
    };

    // Handle each event in batch
    for (const event of events) {
      const { type, replyToken, source } = event;
      const userId = source?.userId;
      if (!isSimulation && (type === 'follow' || type === 'message') && typeof userId === 'string' && /^U[0-9a-f]{32}$/i.test(userId)) {
        pendingFollowers.add(userId);
      }

      // Event A: User adds LINE OA as friend (Follow)
      if (type === 'follow') {
        if (!isSimulation) pendingInquiries.push({
          userId,
          message: 'ผู้ใช้เพิ่มเพื่อนใหม่ (Followed LINE Official Account)',
          inquiry_type: 'inquiry',
        });

        const welcomeFlex = buildWelcomeFlex(hostOrigin);
        await reply(replyToken, [welcomeFlex]);
      }

      // Event B: User sends a text message
      else if (type === 'message' && event.message?.type === 'text') {
        const userText = (event.message.text || '').trim();
        const lowerText = userText.toLowerCase();

        // Website form submissions are already stored before the customer opens LINE.
        // Keep the LINE chat message, but avoid creating a duplicate inbox record.
        const isWebsiteFormSubmission = /\[CP-WEB-FORM:[0-9a-f-]{36}\]/i.test(userText);
        if (!isSimulation && !isWebsiteFormSubmission) {
          pendingInquiries.push({
            userId,
            message: userText,
            inquiry_type: 'inquiry',
          });
        }

        // Intent 1: Greetings, Help, Main Menu
        if (
          lowerText === 'สวัสดี' ||
          lowerText === 'ดีครับ' ||
          lowerText === 'ดีค่ะ' ||
          lowerText === 'hi' ||
          lowerText === 'hello' ||
          lowerText === 'เมนู' ||
          lowerText === 'menu' ||
          lowerText === 'ช่วยเหลือ' ||
          lowerText === 'help' ||
          lowerText === 'เริ่มต้น'
        ) {
          const welcomeMsg = buildWelcomeFlex(hostOrigin);
          await reply(replyToken, [welcomeMsg]);
        }

        // Intent 2: Consignment / Selling / Valuation
        else if (isWebsiteFormSubmission || isConsignmentRequest(lowerText)) {
          const consignmentMsg = buildConsignmentFlex(hostOrigin);
          await reply(replyToken, [consignmentMsg]);
        }

        // Intent 3: Contact / Agent / Phone / Office
        else if (
          lowerText.includes('ติดต่อ') ||
          lowerText.includes('เบอร์') ||
          lowerText.includes('โทร') ||
          lowerText.includes('นายหน้า') ||
          lowerText.includes('แอดมิน') ||
          lowerText.includes('ออฟฟิศ') ||
          lowerText.includes('แผนที่') ||
          lowerText.includes('contact')
        ) {
          const contactMsg = buildContactFlex(hostOrigin);
          await reply(replyToken, [contactMsg]);
        }

        // Intent 4: Search Properties (Houses, Land, Condo, Location, Price, Status)
        else {
          await replyWithProperties(replyToken, userText);
        }
      }

      // Event C: Postback Actions (Buttons clicked from Flex or Rich Menu)
      else if (type === 'postback') {
        const postbackData = event.postback?.data || '';
        const params = new URLSearchParams(postbackData);
        const action = params.get('action');

        if (action === 'search_all' || action === 'search') {
          const keyword = params.get('keyword') || 'all';
          await replyWithProperties(replyToken, keyword);
        } else if (action === 'consignment') {
          const consignmentMsg = buildConsignmentFlex(hostOrigin);
          await reply(replyToken, [consignmentMsg]);
        } else if (action === 'contact') {
          const contactMsg = buildContactFlex(hostOrigin);
          await reply(replyToken, [contactMsg]);
        } else {
          const welcomeMsg = buildWelcomeFlex(hostOrigin);
          await reply(replyToken, [welcomeMsg]);
        }
      }
    }

    // Keep inbox latency out of the reply-token window, including every event in a batch.
    const [inquiryResults, followerResults] = await Promise.all([
      Promise.all(pendingInquiries.map(saveInquiry)),
      Promise.all([...pendingFollowers].map(upsertFollower)),
    ]);
    const failedInquiryWrites = inquiryResults.filter(saved => !saved).length;
    const failedFollowerWrites = followerResults.filter(saved => !saved).length;
    if (failedInquiryWrites) errorCodes.add('INQUIRY_STORAGE_UNAVAILABLE');
    if (failedFollowerWrites) errorCodes.add('FOLLOWER_STORAGE_UNAVAILABLE');
    // Acknowledge processed LINE events; reply and storage outcomes remain explicit.
    console.info('[LINE Webhook] Processing result', {
      processedEvents: events.length, successfulReplies, failedReplies, simulatedReplies, unavailableSearches,
      failedInquiryWrites, failedFollowerWrites, errorCodes: [...errorCodes], simulation: isSimulation,
    });
    return jsonResponse({
      success: failedReplies === 0,
      processedEvents: events.length,
      successfulReplies,
      failedReplies,
      simulatedReplies,
      unavailableSearches,
      failedInquiryWrites,
      failedFollowerWrites,
      errorCodes: [...errorCodes],
      simulation: isSimulation,
      timestamp: new Date().toISOString(),
    });
  } catch {
    console.error('[LINE Webhook] Unexpected processing failure', { code: 'LINE_WEBHOOK_PROCESSING_FAILED' });
    return jsonResponse(
      { success: false, error: 'Webhook processing failed', code: 'LINE_WEBHOOK_PROCESSING_FAILED' },
      { status: 200 }
    );
  }
}
