import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '@/lib/server-auth';
import { serverFirestore } from '@/lib/server-firestore';
import { restore } from '@/lib/line-recovery/restore';
import appletConfig from '../../../../../firebase-applet-config.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store, private' };
const result = (code: string, status: number) => Response.json({ success: code === 'RESTORED', code }, { status, headers });

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return new Response(denied.body, { status: denied.status, headers: { ...Object.fromEntries(denied.headers), ...headers } });
  if (process.env.VERCEL_ENV !== 'production' || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId) !== appletConfig.projectId) return result('CONFIGURATION_ERROR', 503);
  if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers.get('content-type') || '') || (req.headers.get('content-length') && req.headers.get('content-length') !== '28')) return result('INVALID_CONFIRMATION', 400);
  // Bounded exact body; never accept arbitrary menu data, token, or URLs.
  let body: unknown;
  try {
    if (!req.body) throw Error();
    const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let count = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; count += value.length; if (count > 28) throw Error(); chunks.push(value); }
    if (count !== 28) throw Error();
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return result('INVALID_CONFIRMATION', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || (body as { confirmation?: unknown }).confirmation !== '@930xzcyi') return result('INVALID_CONFIRMATION', 400);
  let image: Buffer;
  try { image = await readFile(path.join(process.cwd(), 'src/lib/line-recovery/original-rich-menu.jpg')); } catch { return result('CONFIGURATION_ERROR', 503); }
  const code = await restore({ token: (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(), image, fetcher: fetch,
    acquire: async () => {
      const marker = serverFirestore().collection('server_line_recovery_once').doc('restore_930xzcyi_v1');
      // Create is atomic and never expires. A crash or any ambiguous outcome requires human investigation.
      await marker.create({ stage: 'claimed', createdAt: new Date().toISOString() });
      return { stage: async (stage) => { await marker.update({ stage, updatedAt: new Date().toISOString() }); } };
    },
  });
  return result(code, code === 'RESTORED' ? 200 : 409);
}
