import { jsonResponse } from '@/lib/api-response';
import { Property } from '@/lib/types';
import { requireStaff } from '@/lib/server-auth';
import { createFirestoreDocument, listFirestoreDocuments } from '@/lib/firestore-rest';

const OFFICIAL_LINE_OA_URL = 'https://lin.ee/NMSe28T3';
const DEFAULT_PHONE = '081-604-0097';
const DEFAULT_LINE_ID = '@chantakorn';

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
  } catch (err) {
    console.error('Error verifying LINE signature:', err);
    return false;
  }
}

// Send reply message using LINE Messaging API
async function replyLineMessage(replyToken: string, channelAccessToken: string, messages: any[]): Promise<boolean> {
  if (!channelAccessToken || !channelAccessToken.trim()) {
    console.log('[LINE Webhook] Channel Access Token not set. Simulated reply payload:', JSON.stringify(messages));
    return true;
  }

  if (!replyToken || replyToken === '00000000000000000000000000000000' || replyToken.startsWith('test_')) {
    // LINE Developers Webhook Verification ping token
    return true;
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
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[LINE Webhook] Failed to send reply (${response.status}):`, errBody);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[LINE Webhook] Error calling LINE Reply API:', error);
    return false;
  }
}

// Save customer inquiry into Firestore database
async function saveInquiry(inquiryData: {
  userId?: string;
  name?: string;
  message: string;
  inquiry_type?: string;
  property_title?: string;
}) {
  try {
    const response = await createFirestoreDocument('inquiries', {
      name: inquiryData.name || `ลูกค้า LINE OA (${inquiryData.userId ? inquiryData.userId.slice(0, 8) : 'ผู้ใช้'})`,
      phone: '-',
      line_id: inquiryData.userId || '@chantakorn',
      message: inquiryData.message,
      inquiry_type: inquiryData.inquiry_type || 'inquiry',
      property_title: inquiryData.property_title || '',
      status: 'new',
      created_at: new Date().toISOString(),
      source: 'line_messaging_api_webhook',
    });
    if (!response.ok) throw new Error(`Firestore write failed with status ${response.status}`);
  } catch (err) {
    console.warn('[LINE Webhook] Could not save inquiry to Firestore:', err);
  }
}

// Search properties from Firestore or Sample Data
async function searchProperties(keyword: string): Promise<Property[]> {
  let list: Property[] = [];

  // Try reading from Firestore first
  try {
    list = (await listFirestoreDocuments('properties', 20)) as Property[];
  } catch (err) {
    console.warn('[LINE Webhook] Firestore properties read warning:', err);
  }

  const cleanKey = keyword.toLowerCase().trim();
  if (!cleanKey || cleanKey === 'all' || cleanKey === 'ทั้งหมด' || cleanKey === 'ดูทรัพย์' || cleanKey === 'บ้าน') {
    return list.slice(0, 8);
  }

  // Filter matching keywords
  const matched = list.filter((p) => {
    const titleMatch = p.title?.toLowerCase().includes(cleanKey);
    const descMatch = p.description?.toLowerCase().includes(cleanKey);
    const districtMatch = p.district?.toLowerCase().includes(cleanKey);
    const subdistrictMatch = p.subdistrict?.toLowerCase().includes(cleanKey);
    const provinceMatch = p.province?.toLowerCase().includes(cleanKey);
    const typeMatch = p.property_type?.toLowerCase().includes(cleanKey);
    const statusMatch = (cleanKey.includes('เช่า') && p.status === 'rent') || (cleanKey.includes('ขาย') && p.status === 'sale');

    return titleMatch || descMatch || districtMatch || subdistrictMatch || provinceMatch || typeMatch || statusMatch;
  });

  return matched.length > 0 ? matched.slice(0, 8) : list.slice(0, 6);
}

// Build LINE Flex Carousel for Properties
function buildPropertyCarouselFlex(properties: Property[], hostOrigin: string, queryTitle: string): any {
  const bubbles = properties.slice(0, 10).map((p) => {
    const priceFormatted = p.price
      ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(p.price)
      : 'ราคาพิเศษ';
    const actionText = p.status === 'rent' ? 'ปล่อยเช่า' : 'เสนอขาย';
    const detailUrl = p.slug ? `${hostOrigin}/properties/${p.slug}` : `${hostOrigin}/properties`;
    const coverImg = p.cover_image && /^https?:\/\//i.test(p.cover_image)
      ? p.cover_image
      : 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80';

    return {
      type: 'bubble',
      size: 'kilo',
      hero: {
        type: 'image',
        url: coverImg,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: {
          type: 'uri',
          uri: detailUrl,
        },
      },
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
    altText: `🏡 รายการอสังหาริมทรัพย์ที่ค้นพบ (${queryTitle}) - Chantakorn Property`,
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

  return jsonResponse({
    status: 'online',
    service: 'LINE Messaging API Webhook for Chantakorn Property',
    webhookEndpoint: `${hostOrigin}/api/line/webhook`,
    officialLineOaUrl: OFFICIAL_LINE_OA_URL,
    lineId: DEFAULT_LINE_ID,
    isChannelAccessTokenConfigured: Boolean(config.channelAccessToken?.trim()),
    isChannelSecretConfigured: Boolean(config.channelSecret?.trim()),
    signatureVerificationSupported: true,
    supportedEvents: ['message (text/location)', 'follow', 'unfollow', 'postback'],
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

    const events: any[] = body.events || [];
    const hostOrigin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

    // Handle each event in batch
    for (const event of events) {
      const { type, replyToken, source } = event;
      const userId = source?.userId;

      // Event A: User adds LINE OA as friend (Follow)
      if (type === 'follow') {
        await saveInquiry({
          userId,
          message: 'ผู้ใช้เพิ่มเพื่อนใหม่ (Followed LINE Official Account)',
          inquiry_type: 'inquiry',
        });

        const welcomeFlex = buildWelcomeFlex(hostOrigin);
        await replyLineMessage(replyToken, config.channelAccessToken, [welcomeFlex]);
      }

      // Event B: User sends a text message
      else if (type === 'message' && event.message?.type === 'text') {
        const userText = (event.message.text || '').trim();
        const lowerText = userText.toLowerCase();

        // Website form submissions are already stored before the customer opens LINE.
        // Keep the LINE chat message, but avoid creating a duplicate inbox record.
        const isWebsiteFormSubmission = /\[CP-WEB-FORM:[0-9a-f-]{36}\]/i.test(userText);
        if (!isWebsiteFormSubmission) {
          await saveInquiry({
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
          await replyLineMessage(replyToken, config.channelAccessToken, [welcomeMsg]);
        }

        // Intent 2: Consignment / Selling / Valuation
        else if (
          lowerText.includes('ฝากขาย') ||
          lowerText.includes('ขายบ้าน') ||
          lowerText.includes('ขายที่ดิน') ||
          lowerText.includes('ประเมิน') ||
          lowerText.includes('ฝากเช่า') ||
          lowerText.includes('จำนอง')
        ) {
          const consignmentMsg = buildConsignmentFlex(hostOrigin);
          await replyLineMessage(replyToken, config.channelAccessToken, [consignmentMsg]);
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
          await replyLineMessage(replyToken, config.channelAccessToken, [contactMsg]);
        }

        // Intent 4: Search Properties (Houses, Land, Condo, Location, Price, Status)
        else {
          const matchedProperties = await searchProperties(userText);
          if (matchedProperties.length > 0) {
            const carouselMsg = buildPropertyCarouselFlex(matchedProperties, hostOrigin, userText);
            await replyLineMessage(replyToken, config.channelAccessToken, [carouselMsg]);
          } else {
            // Friendly Fallback
            const fallbackWelcome = buildWelcomeFlex(hostOrigin);
            const textResponse = {
              type: 'text',
              text: `ขอบพระคุณที่ติดต่อ Chantakorn Property ครับ/ค่ะ 🏡\n\nทีมงานได้รับข้อความ "${userText}" ของท่านเรียบร้อยแล้ว แอดมินจะรีบติดต่อกลับโดยเร็วที่สุด หรือสามารถเลือกดูรายการทรัพย์และบริการยอดนิยมด้านล่างได้ทันทีครับ`,
            };
            await replyLineMessage(replyToken, config.channelAccessToken, [textResponse, fallbackWelcome]);
          }
        }
      }

      // Event C: Postback Actions (Buttons clicked from Flex or Rich Menu)
      else if (type === 'postback') {
        const postbackData = event.postback?.data || '';
        const params = new URLSearchParams(postbackData);
        const action = params.get('action');

        if (action === 'search_all' || action === 'search') {
          const keyword = params.get('keyword') || 'all';
          const properties = await searchProperties(keyword);
          const carousel = buildPropertyCarouselFlex(properties, hostOrigin, keyword);
          await replyLineMessage(replyToken, config.channelAccessToken, [carousel]);
        } else if (action === 'consignment') {
          const consignmentMsg = buildConsignmentFlex(hostOrigin);
          await replyLineMessage(replyToken, config.channelAccessToken, [consignmentMsg]);
        } else if (action === 'contact') {
          const contactMsg = buildContactFlex(hostOrigin);
          await replyLineMessage(replyToken, config.channelAccessToken, [contactMsg]);
        } else {
          const welcomeMsg = buildWelcomeFlex(hostOrigin);
          await replyLineMessage(replyToken, config.channelAccessToken, [welcomeMsg]);
        }
      }
    }

    // Always respond 200 OK to LINE Webhook requests
    return jsonResponse({
      success: true,
      processedEvents: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[LINE Webhook] Unexpected error handling webhook request:', error);
    // Even on error, LINE expects 200 OK so it doesn't repeatedly retry
    return jsonResponse(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 200 }
    );
  }
}
