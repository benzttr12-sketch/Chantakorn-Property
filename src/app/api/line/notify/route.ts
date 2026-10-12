import { requireStaff } from '@/lib/server-auth';
import { readJsonBody } from '@/lib/server-request';
import { sendLineNotification } from '@/lib/line-notify-service';
import { jsonResponse } from '@/lib/api-response';
export { GET } from '@/lib/line-notify-service';
export async function POST(req: Request) {
  const denied = await requireStaff(req);
  if (denied) return denied;
  const parsed = await readJsonBody(req, 2 * 1024 * 1024);
  if (parsed.error) return parsed.error;
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) return jsonResponse({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return sendLineNotification(req, parsed.data as Record<string, unknown>);
}
