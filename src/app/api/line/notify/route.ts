import { jsonResponse } from '@/lib/api-response';
import { requireStaff } from '@/lib/server-auth';
import { getFirestoreDocument, patchFirestoreDocument, listFirestoreDocuments } from '@/lib/firestore-rest';
import { getLinePropertyImageUrl } from '@/lib/line-property-image';

const OFFICIAL_LINE_OA_URL = 'https://lin.ee/NMSe28T3';
const DEFAULT_PHONE = '081-604-0097';

interface LineSettings {
  channelAccessToken?: string;
  channelSecret?: string;
  targetUserId?: string;
  adminUserIds?: string[];
  autoNotifyNewProperty?: boolean;
  autoNotifyConsignment?: boolean;
}

// In-memory cache for serverless invocation reuse
let cachedSettings: LineSettings | null = null;
let lastCacheTime = 0;

function configuredRecipients(settings: LineSettings): string[] {
  return Array.from(new Set([
    settings.targetUserId || '', ...(settings.adminUserIds || []),
  ].map((id) => id.trim()).filter(Boolean)));
}

function validRecipient(id: string): boolean {
  return /^U[0-9a-f]{32}$/i.test(id);
}

async function getLineSettings(token?: string): Promise<LineSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastCacheTime < 30000) {
    return cachedSettings;
  }

  const settings: LineSettings = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    targetUserId: process.env.LINE_TARGET_USER_ID || '',
    adminUserIds: (process.env.LINE_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
    autoNotifyNewProperty: true,
    autoNotifyConsignment: true,
  };

  try {
    const response = await getFirestoreDocument('settings', 'line_oa', token);
    if (response.ok) {
      const document = await response.json();
      const fields = document.fields || {};
      if (typeof fields.auto_notify_new_property?.booleanValue === 'boolean') {
        settings.autoNotifyNewProperty = fields.auto_notify_new_property.booleanValue;
      }
      if (typeof fields.auto_notify_consignment?.booleanValue === 'boolean') {
        settings.autoNotifyConsignment = fields.auto_notify_consignment.booleanValue;
      }
      // Do not let a failed anonymous read cache defaults over saved staff preferences.
      cachedSettings = settings;
      lastCacheTime = now;
    }
  } catch (err) {
    console.warn('Could not read line_oa settings from Firestore:', err);
  }

  return settings;
}

export async function GET(req: Request) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const settings = await getLineSettings(token);
  const recipients = configuredRecipients(settings);
  const hostOrigin = new URL(req.url).origin || 'https://ais-dev-4fthqw6uuad4ntgghqrlse-213200673887.asia-east1.run.app';
  return jsonResponse({
    officialLineUrl: OFFICIAL_LINE_OA_URL,
    lineId: '@930xzcyi',
    webhookUrl: `${hostOrigin}/api/line/webhook`,
    isChannelTokenConfigured: Boolean(settings.channelAccessToken?.trim()),
    isChannelSecretConfigured: Boolean(settings.channelSecret?.trim()),
    isRecipientConfigured: recipients.length > 0 && recipients.every(validRecipient),
    recipientCount: recipients.filter(validRecipient).length,
    targetUserId: settings.targetUserId ? `${settings.targetUserId.slice(0, 4)}***` : null,
    autoNotifyNewProperty: settings.autoNotifyNewProperty,
    autoNotifyConsignment: settings.autoNotifyConsignment,
    status: 'online',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const publicInquiry = body.inquiry_type === 'consignment_sell' || body.inquiry_type === 'consignment' || body.inquiry_type === 'inquiry';

    if (publicInquiry && JSON.stringify(body).length > 16000) {
      return jsonResponse({ success: false, error: 'ข้อมูลมีขนาดใหญ่เกินไป' }, { status: 413 });
    }
    if (publicInquiry && (body.overrideToken || body.overrideNotifyToken || body.overrideTargetId)) {
      return jsonResponse({ success: false, error: 'ไม่อนุญาตให้ส่งข้อมูลกำหนด token จากฟอร์มสาธารณะ' }, { status: 400 });
    }
    if (!publicInquiry) {
      const denied = await requireStaff(req);
      if (denied) return denied;
    }

    if (body.action === 'save_settings' && publicInquiry) {
      return jsonResponse({ success: false, error: 'ไม่อนุญาตให้บันทึกการตั้งค่าผ่านฟอร์มสาธารณะ' }, { status: 400 });
    }

    // Special Action: Save Settings
    if (body.action === 'save_settings') {
      const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) {
        return jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบพนักงาน' }, { status: 401 });
      }
      const { autoNotifyNewProperty, autoNotifyConsignment } = body;
      const response = await patchFirestoreDocument('settings', 'line_oa', {
        auto_notify_new_property: Boolean(autoNotifyNewProperty),
        auto_notify_consignment: Boolean(autoNotifyConsignment),
        updated_at: new Date().toISOString(),
      }, token);
      if (!response.ok) {
        return jsonResponse({ success: false, error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 502 });
      }
      cachedSettings = null;
      return jsonResponse({
        success: true,
        message: 'บันทึกสถานะการแจ้งเตือนแล้ว ส่วน LINE secrets ต้องตั้งใน Vercel production'
      });
    }

    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const storedSettings = await getLineSettings(token);
    const lineAccessToken = storedSettings.channelAccessToken || '';
    const autoNotifyEnabled = publicInquiry
      ? storedSettings.autoNotifyConsignment : storedSettings.autoNotifyNewProperty;
    const isStaffManualSend = !publicInquiry && (body.isTest === true || body.manualSend === true);
    if (autoNotifyEnabled === false && !isStaffManualSend) {
      return jsonResponse({ success: true, isRealSent: false, simulated: true, message: 'ปิดการแจ้งเตือนประเภทนี้ไว้ในการตั้งค่า' });
    }
    const recipients = configuredRecipients(storedSettings);

    const hostOrigin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');

    // 1. Check if payload is a Consignment / Customer Inquiry
    const isConsignment = body.inquiry_type === 'consignment_sell' || body.inquiry_type === 'consignment';
    const isGeneralInquiry = body.inquiry_type && !isConsignment;

    let messageText = '';
    let flexMessagePayload: any = null;
    let propertyUrl = '';
    let shareTitle = '';

    if (isConsignment || isGeneralInquiry) {
      const { name, phone, line_id, message, consignment_details } = body;
      const priceText = consignment_details?.expected_price 
        ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(consignment_details.expected_price)
        : 'ตามตกลง';

      shareTitle = isConsignment ? `ฝากขายทรัพย์ใหม่: ${name}` : `ข้อความสอบถามใหม่จากคุณ: ${name}`;

      messageText = `🔔 มีข้อมูล${isConsignment ? 'ฝากขายอสังหาริมทรัพย์' : 'ติดต่อสอบถาม'}ใหม่เข้ามา!
----------------------------------
👤 ผู้ติดต่อ: ${name || 'ไม่ระบุชื่อ'}
📞 โทร: ${phone || '-'}
💬 LINE ID: ${line_id || '-'}
🏠 ประเภท: ${consignment_details?.property_type || 'อสังหาริมทรัพย์'}
📍 ทำเล: ${consignment_details?.district || 'หาดใหญ่-สงขลา'} ${consignment_details?.province || 'จ.สงขลา'}
💰 ราคาที่ต้องการ: ${priceText}
📝 รายละเอียด: ${message || '-'}
----------------------------------
🔗 เข้าสู่ระบบจัดการหลังบ้าน:
👉 ${hostOrigin}/admin/inquiries

LINE Official Account: ${OFFICIAL_LINE_OA_URL}`;

      flexMessagePayload = {
        type: "flex",
        altText: `🔔 ${shareTitle}`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: isConsignment ? "🏡 รับฝากขายอสังหาฯ ใหม่" : "📩 สอบถามข้อมูลใหม่",
                weight: "bold",
                color: "#B45309",
                size: "sm"
              },
              {
                type: "text",
                text: `${name || 'ลูกค้า'} แจ้งข้อมูลเข้ามา`,
                weight: "bold",
                size: "xl",
                margin: "md",
                wrap: true
              },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "xs",
                contents: [
                  {
                    type: "text",
                    text: `📞 เบอร์โทร: ${phone || '-'}`,
                    size: "sm",
                    color: "#111827",
                    weight: "bold"
                  },
                  {
                    type: "text",
                    text: `💰 ราคา: ${priceText}`,
                    size: "sm",
                    color: "#059669",
                    weight: "bold"
                  },
                  {
                    type: "text",
                    text: `📍 พื้นที่: ${consignment_details?.district || 'หาดใหญ่'} จ.สงขลา`,
                    size: "xs",
                    color: "#666666"
                  }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#0F172A",
                action: {
                  type: "uri",
                  label: "เปิดกล่องข้อความ Admin ➔",
                  uri: `${hostOrigin}/admin/inquiries`
                }
              },
              {
                type: "button",
                style: "secondary",
                color: "#06C755",
                action: {
                  type: "uri",
                  label: "ติดต่อทาง LINE OA",
                  uri: OFFICIAL_LINE_OA_URL
                }
              }
            ]
          }
        }
      };

    } else {
      // 2. Standard Property Listing Notification
      const { title, price, status, district, subdistrict, slug, agent } = body;
      
      propertyUrl = slug ? `${hostOrigin}/properties/detail/?slug=${encodeURIComponent(slug)}` : `${hostOrigin}/properties/`;
      const priceFormatted = price 
        ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(price)
        : 'ราคาพิเศษ';
      const actionText = status === 'rent' ? 'ปล่อยเช่า' : 'เสนอขาย';
      shareTitle = `📢 ลงทรัพย์ใหม่: ${title || 'อสังหาริมทรัพย์หาดใหญ่'}`;

      messageText = `📢 มีทรัพย์ลงประกาศใหม่บนเว็บไซต์ Chantakorn Property!
----------------------------------
🏡 [${actionText}] ${title || 'อสังหาริมทรัพย์คุณภาพ'}
📍 ทำเล: ต.${subdistrict || 'ควนลัง'} อ.${district || 'หาดใหญ่'} จ.สงขลา
💰 ราคา: ${priceFormatted} ${status === 'rent' ? '/เดือน' : ''}
👤 นายหน้าผู้ดูแล: ${agent?.name || 'คุณเบนซ์ Chantakorn'} (${agent?.phone || DEFAULT_PHONE})
----------------------------------
🔗 ดูรายละเอียดและรูปภาพทั้งหมดได้ที่:
👉 ${propertyUrl}

LINE Official Account: ${OFFICIAL_LINE_OA_URL}`;

      const heroImg = getLinePropertyImageUrl(body, new URL(req.url).origin);

      flexMessagePayload = {
        type: "flex",
        altText: `📢 ลงทรัพย์ใหม่: ${title || 'อสังหาฯ หาดใหญ่'}`,
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: heroImg,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
            action: {
              type: "uri",
              uri: propertyUrl
            }
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `${actionText}อสังหาริมทรัพย์ใหม่`,
                weight: "bold",
                color: "#B45309",
                size: "sm"
              },
              {
                type: "text",
                text: title || 'บ้านเดี่ยว/ที่ดินทำเลศักยภาพ',
                weight: "bold",
                size: "xl",
                margin: "md",
                wrap: true
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "ราคา",
                        color: "#aaaaaa",
                        size: "sm",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: `${priceFormatted}${status === 'rent' ? ' / เดือน' : ''}`,
                        wrap: true,
                        color: "#111827",
                        size: "sm",
                        flex: 4,
                        weight: "bold"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "ทำเล",
                        color: "#aaaaaa",
                        size: "sm",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: `ต.${subdistrict || 'ควนลัง'} อ.${district || 'หาดใหญ่'} จ.สงขลา`,
                        wrap: true,
                        color: "#666666",
                        size: "sm",
                        flex: 4
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "ผู้ดูแล",
                        color: "#aaaaaa",
                        size: "sm",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: `${agent?.name || 'ทีมงาน Chantakorn'} (${agent?.phone || DEFAULT_PHONE})`,
                        wrap: true,
                        color: "#666666",
                        size: "sm",
                        flex: 4
                      }
                    ]
                  }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#0F172A",
                height: "sm",
                action: {
                  type: "uri",
                  label: "เปิดดูหน้าเว็บไซต์ ➔",
                  uri: propertyUrl
                }
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                color: "#06C755",
                action: {
                  type: "uri",
                  label: "แชทติดต่อทาง LINE OA",
                  uri: OFFICIAL_LINE_OA_URL
                }
              }
            ],
            flex: 1
          }
        }
      };
      if (!heroImg) delete flexMessagePayload.contents.hero;
    }

    if (!lineAccessToken.trim()) {
      return jsonResponse({ success: false, isRealSent: false, code: 'LINE_TOKEN_MISSING', error: 'ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน Vercel Production กรุณาตั้งค่าแล้ว Redeploy' }, { status: 503 });
    }
    if (recipients.length === 0) {
      return jsonResponse({ success: false, isRealSent: false, code: 'LINE_RECIPIENT_MISSING', error: 'ยังไม่ได้กำหนดผู้รับแจ้งเตือน ตั้ง LINE_TARGET_USER_ID หรือ LINE_ADMIN_USER_IDS ใน Vercel Production แล้ว Redeploy' }, { status: 503 });
    }
    if (!recipients.every(validRecipient)) {
      return jsonResponse({ success: false, isRealSent: false, code: 'LINE_RECIPIENT_INVALID', error: 'ผู้รับแจ้งเตือนไม่ใช่ LINE user ID ที่ถูกต้อง ต้องเป็น U ตามด้วยเลขฐานสิบหก 32 ตัว ไม่ใช่ชื่อหรือ @LINE ID' }, { status: 503 });
    }

    // Send only to staff recipients explicitly configured in the server runtime.
    let acceptedRecipients = 0;
    for (const recipient of recipients) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineAccessToken.trim()}` },
      body: JSON.stringify({
        to: recipient,
        messages: [{ type: 'text', text: messageText.slice(0, 5000) }, { ...flexMessagePayload, altText: flexMessagePayload.altText.slice(0, 400) }],
      }),
    });
    const requestId = response.headers.get('x-line-request-id');
    if (!response.ok) {
      console.error('LINE push rejected', { status: response.status, requestId });
      const error = response.status === 401 ? 'โทเค็น LINE ไม่ถูกต้องหรือหมดอายุ'
        : response.status === 429 ? 'LINE จำกัดการส่งข้อความหรือโควตาประจำเดือนเต็ม'
        : 'LINE ไม่รับข้อความ กรุณาตรวจผู้รับและรูปแบบข้อมูล';
      return jsonResponse({ success: false, isRealSent: false, error, requestId, acceptedRecipients }, { status: 502 });
    }
    acceptedRecipients += 1;
    }

    // Property sends also notify registered LINE OA followers (customers who added the official account).
    let customerRecipients = 0;
    let customerDelivered = 0;
    if (!publicInquiry && body.notifyCustomers !== false) {
      try {
        const followers = (await listFirestoreDocuments('line_followers', 200)) as Array<Record<string, unknown>>;
        const alreadySent = new Set(recipients.map((id) => id.toLowerCase()));
        const seen = new Set<string>();
        const customerIds: string[] = [];
        for (const follower of followers) {
          const id = String(follower.user_id || follower.id || '').trim();
          if (!validRecipient(id) || seen.has(id) || alreadySent.has(id.toLowerCase())) continue;
          if (follower.is_active === false) continue;
          seen.add(id);
          customerIds.push(id);
        }
        customerRecipients = customerIds.length;
        for (const customerId of customerIds) {
          try {
            const customerResponse = await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineAccessToken.trim()}` },
              body: JSON.stringify({
                to: customerId,
                messages: [{ type: 'text', text: messageText.slice(0, 5000) }, { ...flexMessagePayload, altText: flexMessagePayload.altText.slice(0, 400) }],
              }),
            });
            if (customerResponse.ok) {
              customerDelivered += 1;
            } else {
              console.error('LINE customer push rejected', { customerId: customerId.slice(0, 6), status: customerResponse.status, requestId: customerResponse.headers.get('x-line-request-id') });
            }
          } catch (customerError) {
            console.error('LINE customer push failed', { customerId: customerId.slice(0, 6), error: customerError });
          }
        }
      } catch (followerError) {
        console.warn('Could not load LINE followers for customer notification:', followerError);
      }
    }
    return jsonResponse({
      success: true, isRealSent: true, simulated: false, acceptedRecipients,
      customerRecipients, customerDelivered,
      deliveryStatus: 'accepted',
      message: customerRecipients > 0
        ? `LINE รับคำขอส่งข้อความแล้ว: ทีมงาน ${acceptedRecipients} คน · ลูกค้าที่ติดตาม OA ${customerDelivered}/${customerRecipients} คน`
        : 'LINE รับคำขอส่งข้อความถึงเจ้าของบัญชีแล้ว',
    });

  } catch (error: any) {
    console.error('Error in LINE notify API route:', error);
    return jsonResponse(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
