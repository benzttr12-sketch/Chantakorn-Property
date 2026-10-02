import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  resolveWorkingChannelAccessToken,
  invalidateChannelAccessToken,
  OFFICIAL_LINE_OA_URL,
  OFFICIAL_LINE_BASIC_ID,
  OFFICIAL_LINE_DISPLAY_NAME,
  DEFAULT_LINE_CHANNEL_ID,
  DEFAULT_LINE_CHANNEL_SECRET
} from '@/lib/line-auth';

const DEFAULT_PHONE = '081-604-0097';

interface LineSettings {
  channelId?: string;
  channelAccessToken?: string;
  channelSecret?: string;
  targetUserId?: string;
  lineNotifyToken?: string;
  autoNotifyNewProperty?: boolean;
  autoNotifyConsignment?: boolean;
}

// In-memory cache for serverless invocation reuse
let cachedSettings: LineSettings | null = null;
let lastCacheTime = 0;

async function getLineSettings(): Promise<LineSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastCacheTime < 30000) {
    return cachedSettings;
  }

  const settings: LineSettings = {
    channelId: process.env.LINE_CHANNEL_ID || DEFAULT_LINE_CHANNEL_ID,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || DEFAULT_LINE_CHANNEL_SECRET,
    targetUserId: process.env.LINE_TARGET_USER_ID || '',
    lineNotifyToken: process.env.LINE_NOTIFY_TOKEN || '',
    autoNotifyNewProperty: true,
    autoNotifyConsignment: true,
  };

  if (db) {
    try {
      const docRef = doc(db, 'settings', 'line_oa');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.channel_id) settings.channelId = data.channel_id;
        if (data.channel_access_token) settings.channelAccessToken = data.channel_access_token;
        if (data.channel_secret) settings.channelSecret = data.channel_secret;
        if (data.target_user_id) settings.targetUserId = data.target_user_id;
        if (data.line_notify_token) settings.lineNotifyToken = data.line_notify_token;
        if (typeof data.auto_notify_new_property === 'boolean') settings.autoNotifyNewProperty = data.auto_notify_new_property;
        if (typeof data.auto_notify_consignment === 'boolean') settings.autoNotifyConsignment = data.auto_notify_consignment;
      }
    } catch (err) {
      console.warn('Could not read line_oa settings from Firestore:', err);
    }
  }

  cachedSettings = settings;
  lastCacheTime = now;
  return settings;
}

export async function GET(req: NextRequest) {
  const settings = await getLineSettings();
  const hostOrigin = req.nextUrl.origin || 'https://ais-dev-4fthqw6uuad4ntgghqrlse-213200673887.asia-east1.run.app';
  const hasSecret = Boolean(settings.channelSecret?.trim());
  const hasTokenOrId = Boolean(settings.channelAccessToken?.trim() || settings.channelId?.trim());
  return NextResponse.json({
    officialLineUrl: OFFICIAL_LINE_OA_URL,
    lineId: OFFICIAL_LINE_BASIC_ID,
    displayName: OFFICIAL_LINE_DISPLAY_NAME,
    webhookUrl: `${hostOrigin}/api/line/webhook`,
    channelId: settings.channelId || '2011760874',
    maskedSecret: settings.channelSecret ? `${settings.channelSecret.slice(0, 4)}••••${settings.channelSecret.slice(-4)}` : null,
    isChannelTokenConfigured: hasTokenOrId && hasSecret,
    isChannelSecretConfigured: hasSecret,
    isLineNotifyConfigured: Boolean(settings.lineNotifyToken?.trim()),
    targetUserId: settings.targetUserId ? `${settings.targetUserId.slice(0, 4)}***` : null,
    autoNotifyNewProperty: settings.autoNotifyNewProperty,
    autoNotifyConsignment: settings.autoNotifyConsignment,
    status: 'online',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Special Action: Save Settings
    if (body.action === 'save_settings') {
      const { channelId, channelAccessToken, channelSecret, targetUserId, lineNotifyToken, autoNotifyNewProperty, autoNotifyConsignment } = body;
      if (db) {
        try {
          const docRef = doc(db, 'settings', 'line_oa');
          await setDoc(docRef, {
            channel_id: channelId?.trim() || '',
            channel_access_token: channelAccessToken?.trim() || '',
            channel_secret: channelSecret?.trim() || '',
            target_user_id: targetUserId?.trim() || '',
            line_notify_token: lineNotifyToken?.trim() || '',
            auto_notify_new_property: Boolean(autoNotifyNewProperty),
            auto_notify_consignment: Boolean(autoNotifyConsignment),
            updated_at: new Date().toISOString(),
          }, { merge: true });
        } catch (dbErr: any) {
          console.error('Error saving line_oa settings to Firestore:', dbErr);
        }
      }
      // invalidate cache
      cachedSettings = null;
      return NextResponse.json({
        success: true,
        message: 'บันทึกการตั้งค่า LINE Official Account เรียบร้อยแล้ว'
      });
    }

    const storedSettings = await getLineSettings();
    const lineAccessToken = body.overrideToken || storedSettings.channelAccessToken || '';
    const lineNotifyToken = body.overrideNotifyToken || storedSettings.lineNotifyToken || '';
    const lineTargetUserId = body.overrideTargetId || storedSettings.targetUserId || '';

    const rawOrigin = req.nextUrl.origin || '';
    const hostOrigin = (rawOrigin.startsWith('https://') 
      ? rawOrigin 
      : 'https://ais-dev-4fthqw6uuad4ntgghqrlse-213200673887.asia-east1.run.app');

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
      const { title, price, status, district, subdistrict, slug, cover_image, agent } = body;
      
      const safeSlug = slug ? encodeURIComponent(slug) : '';
      propertyUrl = safeSlug ? `${hostOrigin}/properties/${safeSlug}` : `${hostOrigin}/properties`;
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

      // LINE Flex image MUST be a valid HTTPS URL (no 302 redirects, direct image or proxy)
      let heroImg = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80";
      if (typeof cover_image === 'string' && /^https:\/\//i.test(cover_image)) {
        heroImg = cover_image;
      } else if (Array.isArray(body.images) && body.images[0] && /^https:\/\//i.test(body.images[0])) {
        heroImg = body.images[0];
      } else if (body.id) {
        heroImg = `${hostOrigin}/api/properties/${body.id}/image`;
      }

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
    }

    // Direct 1-Click LINE Share Link (Always available & works immediately on desktop and mobile)
    const directLineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(messageText)}`;

    // Prepare LINE Messaging API payload
    let isRealSent = false;
    let errors: string[] = [];

    // Mode A: LINE Messaging API
    let activeAccessToken = await resolveWorkingChannelAccessToken({
      explicitToken: lineAccessToken,
      channelId: storedSettings.channelId,
      channelSecret: storedSettings.channelSecret,
    });

    if (activeAccessToken.trim()) {
      let lineApiUrl = "https://api.line.me/v2/bot/message/broadcast";
      let payload: any = {
        messages: [
          {
            type: "text",
            text: messageText
          },
          flexMessagePayload
        ]
      };

      if (lineTargetUserId.trim()) {
        lineApiUrl = "https://api.line.me/v2/bot/message/push";
        payload = {
          to: lineTargetUserId.trim(),
          messages: [
            {
              type: "text",
              text: messageText
            },
            flexMessagePayload
          ]
        };
      }

      try {
        let response = await fetch(lineApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeAccessToken.trim()}`
          },
          body: JSON.stringify(payload)
        });

        // If token was invalid or expired, retry once with fresh OAuth token
        if (response.status === 401) {
          invalidateChannelAccessToken();
          const refreshedToken = await resolveWorkingChannelAccessToken({
            channelId: storedSettings.channelId,
            channelSecret: storedSettings.channelSecret,
          });

          if (refreshedToken && refreshedToken !== activeAccessToken) {
            activeAccessToken = refreshedToken;
            response = await fetch(lineApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeAccessToken.trim()}`
              },
              body: JSON.stringify(payload)
            });
          }
        }

        if (response.ok) {
          isRealSent = true;
        } else {
          const errText = await response.text();
          errors.push(`Messaging API status ${response.status}: ${errText}`);
        }
      } catch (err: any) {
        errors.push(`Messaging API error: ${err.message || String(err)}`);
      }
    }

    // Mode B: LINE Notify API (If token present)
    if (lineNotifyToken.trim()) {
      try {
        const formData = new URLSearchParams();
        formData.append('message', `\n${messageText}`);
        if (body.cover_image && /^https?:\/\//i.test(body.cover_image)) {
          formData.append('imageThumbnail', body.cover_image);
          formData.append('imageFullsize', body.cover_image);
        }

        const notifyRes = await fetch('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${lineNotifyToken.trim()}`
          },
          body: formData.toString()
        });

        if (notifyRes.ok) {
          isRealSent = true;
        } else {
          const notifyErr = await notifyRes.text();
          errors.push(`LINE Notify status ${notifyRes.status}: ${notifyErr}`);
        }
      } catch (notifyErr: any) {
        errors.push(`LINE Notify error: ${notifyErr.message || String(notifyErr)}`);
      }
    }

    if (!lineAccessToken.trim() && !lineNotifyToken.trim()) {
      errors.push('ยังไม่ได้ระบุ Channel Access Token หรือ LINE Notify Token (ระบบจัดเตรียมลิงก์ส่งด่วน 1-Click Share สู่ LINE OA ให้ทันที)');
    }

    return NextResponse.json({
      success: true,
      simulated: !isRealSent,
      isRealSent,
      lineOaUrl: OFFICIAL_LINE_OA_URL,
      shareUrl: directLineShareUrl,
      message: isRealSent 
        ? '🚀 ส่งข้อความแจ้งเตือนเด้งเข้า LINE Official Account สำเร็จ!' 
        : 'จำลองการส่งแจ้งเตือนสำเร็จ (คลิกเพื่อเด้งแชร์เข้า LINE ได้ทันที)',
      payload: {
        text: messageText,
        flex: flexMessagePayload,
        propertyUrl
      },
      error: errors.length > 0 ? errors.join('; ') : null
    });

  } catch (error: any) {
    console.error('Error in LINE notify API route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
