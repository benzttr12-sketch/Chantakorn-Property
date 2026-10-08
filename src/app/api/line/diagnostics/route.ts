import { jsonResponse } from '@/lib/api-response';
import { listFirestoreDocuments } from '@/lib/firestore-rest';
import { OFFICIAL_LINE_BASIC_ID } from '@/lib/line-auth';
import { requireStaff } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type Check = { name: string; ok: boolean; code: string; message: string };
type LineResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string };

const NO_STORE = { 'Cache-Control': 'no-store, private' };
const LINE_TIMEOUT_MS = 5000;

// These endpoints read channel configuration; they never send messages or alter it.
async function readLine(path: string, token: string): Promise<LineResult> {
  try {
    const response = await fetch(`https://api.line.me${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Do not read or return LINE error bodies, which can contain private data.
      if (response.status === 401 || response.status === 403) return { ok: false, code: 'LINE_TOKEN_INVALID' };
      if (response.status === 404) return { ok: false, code: 'LINE_NOT_FOUND' };
      if (response.status === 429) return { ok: false, code: 'LINE_RATE_LIMITED' };
      return { ok: false, code: 'LINE_API_UNAVAILABLE' };
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, code: 'LINE_RESPONSE_INVALID' };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
    return {
      ok: false,
      code: name === 'TimeoutError' || name === 'AbortError' ? 'LINE_REQUEST_TIMEOUT' : 'LINE_API_UNAVAILABLE',
    };
  }
}

async function checkProperties(): Promise<Check> {
  try {
    // Match the query used for customer replies; the helper has a 10-second timeout.
    const properties = await listFirestoreDocuments('properties', 20, { publishedOnly: true });
    const count = properties.filter((property) => 'published' in property && property.published === true).length;
    return count > 0
      ? { name: 'รายการทรัพย์ที่เผยแพร่', ok: true, code: 'PROPERTIES_AVAILABLE', message: `อ่านรายการทรัพย์ที่เผยแพร่ได้ ${count} รายการ (สูงสุด 20 รายการ)` }
      : { name: 'รายการทรัพย์ที่เผยแพร่', ok: false, code: 'PROPERTIES_EMPTY', message: 'ยังไม่มีทรัพย์ที่เผยแพร่ให้ลูกค้าค้นหา กรุณาเผยแพร่รายการทรัพย์ก่อน' };
  } catch {
    return { name: 'รายการทรัพย์ที่เผยแพร่', ok: false, code: 'PROPERTIES_UNAVAILABLE', message: 'อ่านรายการทรัพย์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์อ่านฐานข้อมูล' };
  }
}

async function checkLine(token: string, expectedEndpoint: string | null): Promise<Check[]> {
  const tokenName = 'การเชื่อมต่อ LINE';
  const accountName = 'บัญชี LINE Official Account';
  const webhookName = 'การรับข้อความจากลูกค้า';
  if (!token) {
    return [
      { name: tokenName, ok: false, code: 'LINE_TOKEN_MISSING', message: 'ยังไม่ได้ตั้งค่า Channel Access Token บนเซิร์ฟเวอร์' },
      { name: accountName, ok: false, code: 'LINE_ACCOUNT_NOT_CHECKED', message: 'ตรวจสอบบัญชีไม่ได้จนกว่าจะตั้งค่า Token ให้ถูกต้อง' },
      { name: webhookName, ok: false, code: 'WEBHOOK_NOT_CHECKED', message: 'ตรวจสอบการรับข้อความไม่ได้จนกว่าจะตั้งค่า Token ให้ถูกต้อง' },
    ];
  }

  const bot = await readLine('/v2/bot/info', token);
  if (!bot.ok) {
    return [
      { name: tokenName, ok: false, code: bot.code, message: bot.code === 'LINE_TOKEN_INVALID' ? 'LINE ไม่ยอมรับ Token ที่ตั้งไว้ กรุณาตั้งค่า Token ของบัญชีที่ถูกต้อง' : 'ติดต่อ LINE เพื่อตรวจสอบ Token ไม่สำเร็จ กรุณาลองอีกครั้ง' },
      { name: accountName, ok: false, code: 'LINE_ACCOUNT_NOT_CHECKED', message: 'ยังยืนยันบัญชี LINE ไม่ได้' },
      { name: webhookName, ok: false, code: 'WEBHOOK_NOT_CHECKED', message: 'ยังตรวจสอบการรับข้อความจาก LINE ไม่ได้' },
    ];
  }

  const accountMatches = bot.data.basicId === OFFICIAL_LINE_BASIC_ID;
  const checks: Check[] = [
    { name: tokenName, ok: true, code: 'LINE_TOKEN_VALID', message: 'LINE ยอมรับ Token ที่ตั้งไว้' },
    accountMatches
      ? { name: accountName, ok: true, code: 'LINE_ACCOUNT_MATCH', message: `Token เชื่อมต่อกับบัญชี ${OFFICIAL_LINE_BASIC_ID}` }
      : { name: accountName, ok: false, code: 'LINE_ACCOUNT_MISMATCH', message: `Token ไม่ได้เชื่อมต่อกับบัญชี ${OFFICIAL_LINE_BASIC_ID} กรุณาตั้งค่า Token ของบัญชีนี้` },
  ];
  if (!accountMatches) {
    checks.push({ name: webhookName, ok: false, code: 'WEBHOOK_NOT_CHECKED', message: 'ตรวจสอบการรับข้อความไม่ได้เพราะ Token เชื่อมต่อกับบัญชีอื่น' });
    return checks;
  }
  if (!expectedEndpoint) {
    checks.push({ name: webhookName, ok: false, code: 'SITE_URL_INVALID', message: 'URL เว็บไซต์ที่ตั้งไว้ไม่ถูกต้อง กรุณาตรวจสอบการตั้งค่าบนเซิร์ฟเวอร์' });
    return checks;
  }

  const webhook = await readLine('/v2/bot/channel/webhook/endpoint', token);
  if (!webhook.ok) {
    checks.push({ name: webhookName, ok: false, code: webhook.code === 'LINE_NOT_FOUND' ? 'WEBHOOK_UNSET' : webhook.code,
      message: webhook.code === 'LINE_NOT_FOUND' ? 'ยังไม่ได้ตั้งค่า Webhook URL ใน LINE Developers' : 'อ่านการตั้งค่า Webhook จาก LINE ไม่สำเร็จ กรุณาลองอีกครั้ง' });
  } else if (webhook.data.active !== true) {
    checks.push({ name: webhookName, ok: false, code: 'WEBHOOK_DISABLED', message: 'ยังไม่ได้เปิด Use webhook ใน LINE Developers กรุณาเปิดเพื่อรับข้อความจากลูกค้า' });
  } else if (webhook.data.endpoint !== expectedEndpoint) {
    checks.push({ name: webhookName, ok: false, code: 'WEBHOOK_URL_MISMATCH', message: 'Webhook URL ใน LINE Developers ไม่ตรงกับเว็บไซต์นี้ กรุณาใช้ URL ที่แสดงในหน้าตั้งค่า' });
  } else {
    checks.push({ name: webhookName, ok: true, code: 'WEBHOOK_READY', message: 'เปิด Use webhook แล้ว และ Webhook URL ตรงกับเว็บไซต์นี้' });
  }
  return checks;
}

export async function GET(req: Request) {
  const denied = await requireStaff(req);
  if (denied) {
    const headers = new Headers(denied.headers);
    headers.set('Cache-Control', NO_STORE['Cache-Control']);
    return new Response(denied.body, { status: denied.status, headers });
  }

  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const secretConfigured = Boolean(process.env.LINE_CHANNEL_SECRET?.trim());
  let expectedEndpoint: string | null = null;
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || req.url);
    if (site.protocol === 'https:' && !site.username && !site.password) {
      expectedEndpoint = `${site.origin}/api/line/webhook`;
    }
  } catch {
    // Return a stable configuration error without echoing the environment value.
  }

  const [lineChecks, propertiesCheck] = await Promise.all([
    checkLine(token, expectedEndpoint),
    checkProperties(),
  ]);
  const checks: Check[] = [
    ...lineChecks,
    { name: 'ลายเซ็นข้อความเข้า', ok: secretConfigured, code: secretConfigured ? 'LINE_SECRET_CONFIGURED' : 'LINE_SECRET_MISSING',
      message: secretConfigured ? 'ตั้งค่า Channel Secret แล้ว ต้องใช้ค่าเดียวกับช่องทางใน LINE Developers' : 'ยังไม่ได้ตั้งค่า Channel Secret บนเซิร์ฟเวอร์' },
    propertiesCheck,
  ];
  const ready = checks.every((check) => check.ok);
  return jsonResponse({
    ready,
    message: ready ? 'ตรวจสอบการเชื่อมต่อ LINE การรับข้อความ และรายการทรัพย์ผ่านแล้ว' : 'พบการตั้งค่าที่ต้องแก้ไข กรุณาดูผลตรวจสอบด้านล่าง',
    checks,
    ...(expectedEndpoint ? { expectedWebhookEndpoint: expectedEndpoint } : {}),
  }, { headers: NO_STORE });
}
