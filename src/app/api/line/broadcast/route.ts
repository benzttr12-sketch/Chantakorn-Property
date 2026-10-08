import { jsonResponse } from '@/lib/api-response';
import { getFirestoreDocument } from '@/lib/firestore-rest';
import { OFFICIAL_LINE_BASIC_ID } from '@/lib/line-auth';
import { buildPropertyBroadcast } from '@/lib/line-property-broadcast';
import { requireStaff } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, private' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(code: string, message: string, status = 400, uncertain = false): Response {
  return jsonResponse({ success: false, code, message, deliveryStatus: uncertain ? 'unknown' : 'rejected', retryable: uncertain }, { status, headers: NO_STORE });
}

async function authorize(req: Request): Promise<Response | null> {
  const denied = await requireStaff(req);
  if (!denied) return null;
  const headers = new Headers(denied.headers);
  headers.set('Cache-Control', NO_STORE['Cache-Control']);
  return new Response(denied.body, { status: denied.status, headers });
}

function validPropertyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value
    && value !== '.' && value !== '..' && !/[/\\\u0000-\u001f\u007f]/.test(value);
}

async function prepare(req: Request, id: string) {
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(req.url).origin);
    const imageOrigin = new URL(req.url).origin;
    if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || !imageOrigin.startsWith('https://')) {
      return { error: failure('SITE_URL_INVALID', 'URL เว็บไซต์ยังไม่พร้อมสำหรับการ์ด LINE กรุณาตรวจสอบการตั้งค่าเว็บไซต์', 503) };
    }
    const siteBase = `${site.origin}${site.pathname.replace(/\/+$/, '')}`;
    const staffToken = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    // Staff may read drafts, but a draft can never be previewed or broadcast.
    const response = await getFirestoreDocument('properties', id, staffToken);
    if (response.status === 404) return { error: failure('PROPERTY_NOT_FOUND', 'ไม่พบทรัพย์ที่เลือก กรุณาเลือกทรัพย์ใหม่', 404) };
    if (!response.ok) return { error: failure('PROPERTY_UNAVAILABLE', 'อ่านข้อมูลทรัพย์ไม่ได้ กรุณาลองอีกครั้ง', 503) };
    const document = await response.json();
    if (document?.fields?.published?.booleanValue !== true) {
      return { error: failure('PROPERTY_NOT_PUBLISHED', 'ต้องเผยแพร่ทรัพย์ก่อนส่งให้ผู้ติดตาม LINE OA', 400) };
    }
    return { broadcast: buildPropertyBroadcast(id, document.fields, siteBase, imageOrigin) };
  } catch {
    return { error: failure('PROPERTY_UNAVAILABLE', 'อ่านข้อมูลทรัพย์ไม่ได้ กรุณาลองอีกครั้ง', 503) };
  }
}

async function validateAccount(token: string): Promise<Response | null> {
  if (!token) return failure('LINE_TOKEN_MISSING', 'ยังไม่ได้ตั้งค่า Token ของ LINE OA บนเซิร์ฟเวอร์', 503);
  try {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return failure('LINE_TOKEN_INVALID', 'LINE ไม่ยอมรับ Token ที่ตั้งไว้ กรุณาตรวจสอบ Token ของบัญชีนี้', 502);
    }
    if (response.status === 429) return failure('LINE_RATE_LIMITED', 'LINE จำกัดจำนวนคำขอชั่วคราว กรุณารอสักครู่ก่อนตรวจสอบอีกครั้ง', 429);
    if (!response.ok) return failure('LINE_ACCOUNT_UNAVAILABLE', 'ตรวจสอบบัญชี LINE ไม่สำเร็จ ยังไม่ได้ส่งข้อความ กรุณาลองอีกครั้ง', 503);
    const bot = await response.json();
    if (bot?.basicId !== OFFICIAL_LINE_BASIC_ID) {
      return failure('LINE_ACCOUNT_MISMATCH', `Token ไม่ใช่ของบัญชี ${OFFICIAL_LINE_BASIC_ID} จึงยังไม่ส่งข้อความ`, 503);
    }
    return null;
  } catch {
    return failure('LINE_ACCOUNT_UNAVAILABLE', 'ตรวจสอบบัญชี LINE ไม่สำเร็จ ยังไม่ได้ส่งข้อความ กรุณาลองอีกครั้ง', 503);
  }
}

function safeRequestId(response: Response, accepted = false): string | undefined {
  const value = response.headers.get(accepted ? 'x-line-accepted-request-id' : 'x-line-request-id');
  return value && REQUEST_ID.test(value) ? value : undefined;
}

export async function GET(req: Request): Promise<Response> {
  const denied = await authorize(req);
  if (denied) return denied;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!validPropertyId(propertyId)) return failure('PROPERTY_ID_INVALID', 'กรุณาเลือกทรัพย์ที่ต้องการส่ง');
  const prepared = await prepare(req, propertyId);
  if (prepared.error) return prepared.error;
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const accountError = await validateAccount(token);
  if (accountError) return accountError;
  return jsonResponse({
    success: true,
    property: prepared.broadcast.property,
    previewRevision: prepared.broadcast.previewRevision,
    audience: 'all_followers',
    oa: OFFICIAL_LINE_BASIC_ID,
  }, { headers: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const denied = await authorize(req);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 2000) return failure('BROADCAST_REQUEST_INVALID', 'ข้อมูลคำขอไม่ถูกต้อง กรุณาเปิดตัวอย่างใหม่');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failure('BROADCAST_REQUEST_INVALID', 'ข้อมูลคำขอไม่ถูกต้อง กรุณาเปิดตัวอย่างใหม่');
    body = parsed as Record<string, unknown>;
  } catch {
    return failure('BROADCAST_REQUEST_INVALID', 'ข้อมูลคำขอไม่ถูกต้อง กรุณาเปิดตัวอย่างใหม่');
  }
  if (Object.keys(body).some((key) => !['propertyId', 'retryKey', 'previewRevision'].includes(key))) {
    return failure('BROADCAST_REQUEST_INVALID', 'อนุญาตให้ส่งเฉพาะทรัพย์ที่เลือกจากระบบ กรุณาเปิดตัวอย่างใหม่');
  }
  if (!validPropertyId(body.propertyId)) return failure('PROPERTY_ID_INVALID', 'กรุณาเลือกทรัพย์ที่ต้องการส่ง');
  if (typeof body.retryKey !== 'string' || !UUID.test(body.retryKey)) return failure('RETRY_KEY_INVALID', 'รหัสคำขอส่งไม่ถูกต้อง กรุณาเปิดตัวอย่างใหม่');
  if (typeof body.previewRevision !== 'string' || !/^[0-9a-f]{64}$/.test(body.previewRevision)) {
    return failure('PREVIEW_REVISION_INVALID', 'กรุณาเปิดตัวอย่างก่อนยืนยันการส่ง');
  }

  const prepared = await prepare(req, body.propertyId);
  if (prepared.error) return prepared.error;
  if (prepared.broadcast.previewRevision !== body.previewRevision) {
    return failure('PROPERTY_CHANGED', 'ข้อมูลทรัพย์เปลี่ยนหลังเปิดตัวอย่าง กรุณาปิดแล้วเปิดตัวอย่างใหม่ก่อนส่ง', 409);
  }
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const accountError = await validateAccount(token);
  if (accountError) return accountError;

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Line-Retry-Key': body.retryKey },
      body: JSON.stringify(prepared.broadcast.payload),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    const alreadyAccepted = response.status === 409;
    const requestId = safeRequestId(response, alreadyAccepted);
    if (response.ok || (alreadyAccepted && requestId)) {
      return jsonResponse({
        success: true,
        deliveryStatus: 'accepted',
        ...(alreadyAccepted ? { alreadyAccepted: true } : {}),
        message: alreadyAccepted ? 'LINE รับคำขอนี้ไว้แล้ว จึงไม่ส่งซ้ำ' : 'LINE รับคำขอส่งทรัพย์ถึงผู้ติดตามทั้งหมดแล้ว การรับคำขอยังไม่ยืนยันว่าผู้ติดตามแต่ละคนได้รับข้อความ',
        ...(requestId ? { requestId } : {}),
      }, { headers: NO_STORE });
    }
    // Never read or expose LINE's error body, credentials, or message payload.
    if (response.status === 401 || response.status === 403) return failure('LINE_TOKEN_INVALID', 'LINE ไม่ยอมรับ Token จึงไม่รับคำขอส่ง กรุณาตรวจสอบการตั้งค่า', 502);
    if (response.status === 429) return failure('LINE_QUOTA_OR_RATE_LIMIT', 'LINE ไม่รับคำขอเนื่องจากโควตาหรือจำนวนคำขอถึงขีดจำกัด กรุณาตรวจสอบใน LINE OA Manager', 429);
    if (response.status === 400) return failure('LINE_INVALID_MESSAGE', 'LINE ไม่รับรูปแบบการ์ดทรัพย์ กรุณาติดต่อผู้ดูแลระบบ', 502);
    if (response.status >= 500 || alreadyAccepted) {
      return failure('LINE_DELIVERY_UNKNOWN', 'ยังยืนยันไม่ได้ว่า LINE รับคำขอหรือไม่ หากลองใหม่ต้องใช้รหัสคำขอเดิมภายใน 24 ชั่วโมงเพื่อป้องกันข้อความซ้ำ', 502, true);
    }
    return failure('LINE_REQUEST_REJECTED', 'LINE ไม่รับคำขอส่ง กรุณาตรวจสอบการตั้งค่าและติดต่อผู้ดูแลระบบ', 502);
  } catch {
    return failure('LINE_DELIVERY_UNKNOWN', 'การเชื่อมต่อขาดหาย ยังยืนยันผลการส่งไม่ได้ หากลองใหม่ต้องใช้รหัสคำขอเดิมภายใน 24 ชั่วโมงเพื่อป้องกันข้อความซ้ำ', 502, true);
  }
}
