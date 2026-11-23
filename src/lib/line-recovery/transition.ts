import { createHash } from 'node:crypto';
import originalMenu from './menu.json';

const menu = { ...originalMenu, areas: originalMenu.areas.map((area, index) => index === 1 ? { ...area, action: { type: 'message', label: 'ฝากขายทรัพย์', text: 'บริการฝากขาย' } } : area) };

const EXPECTED_HASH = 'bb23eaa5f61efae55bc5fda683fe3bad0e0847e7527383acef4d05642044086d';
const ID = /^richmenu-[0-9a-f]{32}$/;
const LIMIT = 2_000_000;
type Journal = { stage: (value: string) => Promise<void> };
type Dependencies = { token: string; image: Buffer; fetcher: typeof fetch; acquire: () => Promise<Journal> };

function digest(value: Uint8Array) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}
async function bytes(response: Response): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMIT)) throw Error('invalid response');
  if (!response.body) throw Error('missing response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > LIMIT) throw Error('response too large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function json(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(Buffer.from(await bytes(response)).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid response');
  return value as Record<string, unknown>;
}

/** One permanent attempt. No write is retried, including after a timeout. */
export async function transition({ token, image, fetcher, acquire }: Dependencies): Promise<string> {
  if (!token || image.length !== 519186 || digest(image) !== EXPECTED_HASH) return 'CONFIGURATION_ERROR';
  let journal: Journal;
  try { journal = await acquire(); } catch { return 'ATTEMPT_UNAVAILABLE'; }
  let mutationStarted = false;
  try {
    const request = (host: 'api.line.me' | 'api-data.line.me', path: string, method = 'GET', body?: BodyInit, contentType?: string) => fetcher(`https://${host}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(contentType ? { 'Content-Type': contentType } : {}) },
      ...(body ? { body } : {}), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const get = (path: string) => request('api.line.me', path);
    const bot = await get('/v2/bot/info');
    if (!bot.ok || (await json(bot)).basicId !== '@930xzcyi') return 'ACCOUNT_MISMATCH_OR_UNAVAILABLE';
    const current = await get('/v2/bot/user/all/richmenu');
    if (!current.ok) return 'STATE_CHANGED_OR_UNAVAILABLE';
    const oldId = (await json(current)).richMenuId;
    if (typeof oldId !== 'string' || !ID.test(oldId)) return 'STATE_CHANGED_OR_UNAVAILABLE';
    const list = await get('/v2/bot/richmenu/list');
    if (!list.ok) return 'STATE_CHANGED_OR_UNAVAILABLE';
    const menus = (await json(list)).richmenus;
    if (!Array.isArray(menus) || menus.length !== 1 || menus[0]?.richMenuId !== oldId) return 'STATE_CHANGED_OR_UNAVAILABLE';
    const verify = async (id: string, expected: unknown) => {
      const imageResponse = await request('api-data.line.me', `/v2/bot/richmenu/${id}/content`);
      if (!imageResponse.ok || digest(await bytes(imageResponse)) !== EXPECTED_HASH) throw Error('image mismatch');
      const menuResponse = await get(`/v2/bot/richmenu/${id}`);
      if (!menuResponse.ok) throw Error('menu unavailable');
      const stored = await json(menuResponse);
      if (stored.richMenuId !== id) throw Error('menu id mismatch');
      delete stored.richMenuId;
      if (canonical(stored) !== canonical(expected)) throw Error('menu mismatch');
    };
    await verify(oldId, originalMenu);
    await journal.stage('creating');
    mutationStarted = true;
    const created = await request('api.line.me', '/v2/bot/richmenu', 'POST', JSON.stringify(menu), 'application/json');
    if (!created.ok) throw Error('create failed');
    const id = (await json(created)).richMenuId;
    if (typeof id !== 'string' || !ID.test(id) || id === oldId) throw Error('invalid id');
    await journal.stage('uploading');
    const uploaded = await request('api-data.line.me', `/v2/bot/richmenu/${id}/content`, 'POST', image as unknown as BodyInit, 'image/jpeg');
    if (!uploaded.ok) throw Error('upload failed');
    await verify(id, menu);
    await journal.stage('setting_default');
    const beforeList = await get('/v2/bot/richmenu/list');
    if (!beforeList.ok) throw Error('list unavailable');
    const beforeMenus = (await json(beforeList)).richmenus;
    if (!Array.isArray(beforeMenus) || beforeMenus.length !== 2 || new Set(beforeMenus.map(item => item?.richMenuId)).size !== 2 || !beforeMenus.some(item => item?.richMenuId === oldId) || !beforeMenus.some(item => item?.richMenuId === id)) throw Error('list changed');
    await verify(oldId, originalMenu);
    // LINE has no compare-and-set: another actor may still race the following check.
    const before = await get('/v2/bot/user/all/richmenu');
    if (!before.ok || (await json(before)).richMenuId !== oldId) throw Error('default changed');
    const assigned = await request('api.line.me', `/v2/bot/user/all/richmenu/${id}`, 'POST');
    if (!assigned.ok) throw Error('assignment failed');
    const finalDefault = await get('/v2/bot/user/all/richmenu');
    if (!finalDefault.ok || (await json(finalDefault)).richMenuId !== id) throw Error('verification failed');
    await verify(id, menu);
    await journal.stage('completed');
    return 'TRANSITIONED';
  } catch {
    return mutationStarted ? 'PARTIAL_OR_UNCERTAIN' : 'STATE_CHANGED_OR_UNAVAILABLE';
  }
}
