const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const loadTs = require('./load-ts.cjs');

const expectedEndpoint = 'https://site.example/api/line/webhook';
const configuredEnv = { LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_CHANNEL_SECRET: 'private-secret', NEXT_PUBLIC_SITE_URL: 'https://site.example/some-path/' };

function load({ staff = true, env = configuredEnv, fetch = async () => { throw Error('Unexpected LINE request'); }, listProperties = async () => [{ published: true }] } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/line/diagnostics/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Request, Response, URL, Headers, AbortSignal, fetch, process: { env },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff: async () => staff ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) };
      if (name === '@/lib/line-auth') return { OFFICIAL_LINE_BASIC_ID: '@930xzcyi' };
      if (name === '@/lib/server-property-catalog') return { listPublishedProperties: listProperties };
      throw Error(name);
    },
  });
  return module.exports;
}

const request = () => new Request('https://deployment.example/api/line/diagnostics');
const check = (result, name) => result.checks.find(item => item.name === name);
const hasCode = (result, code) => result.checks.some(item => item.code === code);
function validLine(url, init) {
  assert.equal(init.method, 'GET');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.headers.Authorization, 'Bearer private-token');
  if (url === 'https://api.line.me/v2/bot/info') return Response.json({ basicId: '@930xzcyi', userId: 'private-bot-id', displayName: 'Private display name' });
  if (url === 'https://api.line.me/v2/bot/user/all/richmenu') return Response.json({}, { status: 404 });
  if (url === 'https://api.line.me/v2/bot/richmenu/list') return Response.json({ richmenus: [] });
  assert.equal(url, 'https://api.line.me/v2/bot/channel/webhook/endpoint');
  return Response.json({ active: true, endpoint: expectedEndpoint });
}

test('diagnostics deny anonymous requests before any LINE or database requests', async () => {
  let requests = 0;
  const api = load({ staff: false, fetch: async () => { requests += 1; }, listProperties: async () => { requests += 1; } });
  const response = await api.GET(request());
  assert.equal(response.status, 401);
  assert.equal(requests, 0);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
});

test('missing token and secret report configuration failures without calling LINE', async () => {
  let lineRequests = 0;
  const api = load({ env: {}, fetch: async () => { lineRequests += 1; throw Error('Unexpected request'); } });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, false);
  assert.equal(lineRequests, 0);
  assert.ok(hasCode(result, 'LINE_TOKEN_MISSING'));
  assert.ok(hasCode(result, 'LINE_SECRET_MISSING'));
});

test('rejected token reports a stable code without reading or returning LINE error bodies', async () => {
  let bodyReads = 0;
  let lineRequests = 0;
  const api = load({ fetch: async () => {
    lineRequests += 1;
    return { ok: false, status: 401, json: async () => { bodyReads += 1; return { message: 'private-token private-bot-id' }; } };
  } });
  const response = await api.GET(request());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ready, false);
  assert.ok(hasCode(result, 'LINE_TOKEN_INVALID'));
  assert.equal(lineRequests, 1);
  assert.equal(bodyReads, 0);
  assert.equal(JSON.stringify(result).includes('private-token'), false);
});

test('valid token for a different OA reports mismatch and skips its webhook settings', async () => {
  let lineRequests = 0;
  const api = load({ fetch: async () => { lineRequests += 1; return Response.json({ basicId: '@other-account', userId: 'private-other-id' }); } });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, false);
  assert.ok(hasCode(result, 'LINE_ACCOUNT_MISMATCH'));
  assert.equal(lineRequests, 1);
  assert.equal(JSON.stringify(result).includes('@other-account'), false);
  assert.equal(JSON.stringify(result).includes('private-other-id'), false);
  assert.equal(result.richMenu.status, 'not_checked');
});

test('disabled and wrong webhook configurations are separately identified', async () => {
  for (const [configuration, code] of [
    [{ active: false, endpoint: expectedEndpoint }, 'WEBHOOK_DISABLED'],
    [{ active: true, endpoint: 'https://wrong.example/api/line/webhook?private=value' }, 'WEBHOOK_URL_MISMATCH'],
  ]) {
    const api = load({ fetch: async (url, init) => url.endsWith('/info') ? validLine(url, init) : Response.json(configuration) });
    const result = await (await api.GET(request())).json();
    assert.equal(result.ready, false);
    assert.ok(hasCode(result, code));
    assert.equal(JSON.stringify(result).includes('private=value'), false);
  }
});

test('unset webhook configuration is reported without raw LINE errors', async () => {
  const api = load({ fetch: async (url, init) => url.endsWith('/info') ? validLine(url, init) : Response.json({ message: 'private settings' }, { status: 404 }) });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, false);
  assert.ok(hasCode(result, 'WEBHOOK_UNSET'));
  assert.equal(JSON.stringify(result).includes('private settings'), false);
});

test('valid account, canonical webhook origin and published properties return readiness without secrets', async () => {
  const requests = [];
  let query;
  const api = load({
    fetch: async (url, init) => { requests.push(url); return validLine(url, init); },
    listProperties: async (...args) => { query = args; return [{ published: true, title: 'private-to-diagnostics-title' }, { published: false }]; },
  });
  const response = await api.GET(request());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(api.dynamic, 'force-dynamic');
  assert.equal(result.ready, true);
  assert.equal(result.expectedWebhookEndpoint, expectedEndpoint);
  assert.equal(result.checks.every(item => item.ok && item.code && item.message && item.name), true);
  assert.deepEqual(query, [20]);
  assert.match(check(result, 'รายการทรัพย์ที่เผยแพร่').message, /1 รายการ/);
  assert.equal(requests.length, 4);
  assert.equal(result.richMenu.status, 'checked');
  assert.equal(result.richMenu.defaultStatus, 'none');
  assert.equal(result.richMenu.defaultId, null);
  assert.equal(result.richMenu.totalMenus, 0);
  assert.match(result.richMenu.message, /ไม่รวมเมนูที่สร้างใน LINE OA Manager/);
  for (const value of ['private-token', 'private-secret', 'private-bot-id', 'Private display name', 'private-to-diagnostics-title']) {
    assert.equal(JSON.stringify(result).includes(value), false);
  }
});

test('diagnostics read Cloudflare catalog readiness without reading legacy Firestore listings', async () => {
  const apiOrigin = 'https://catalog.example';
  let catalogRequests = 0;
  const fetch = async (url, init) => {
    if (url.startsWith('https://api.line.me/')) return validLine(url, init);
    catalogRequests += 1;
    assert.equal(url, `${apiOrigin}/v1/properties?limit=20`);
    assert.equal(init.headers, undefined);
    assert.equal(init.credentials, 'omit');
    return Response.json({ data: [{ id: 'cloudflare-home', title: 'Current catalog', published: true }], next_cursor: null });
  };
  const catalog = loadTs({ '@/lib/firestore-rest': {
    listFirestoreDocuments: async () => { throw Error('Must not read legacy Firestore listings'); },
  } }, { fetch, process: { env: { NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: apiOrigin } } })('lib/server-property-catalog.ts');
  const api = load({ fetch, listProperties: catalog.listPublishedProperties });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, true);
  assert.equal(catalogRequests, 1);
  assert.ok(hasCode(result, 'PROPERTIES_AVAILABLE'));
  assert.equal(JSON.stringify(result).includes('Current catalog'), false);
});

test('request origin supplies canonical webhook when no site URL is configured', async () => {
  const api = load({ env: { LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_CHANNEL_SECRET: 'private-secret' },
    fetch: async (url, init) => url.endsWith('/info') ? validLine(url, init) : Response.json({ active: true, endpoint: 'https://deployment.example/api/line/webhook' }),
  });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, true);
  assert.equal(result.expectedWebhookEndpoint, 'https://deployment.example/api/line/webhook');
});

test('database failures and empty published data prevent listing readiness without exposing errors', async () => {
  for (const [listProperties, code] of [
    [async () => { throw Error('private-token private-database-url'); }, 'PROPERTIES_UNAVAILABLE'],
    [async () => [], 'PROPERTIES_EMPTY'],
  ]) {
    const api = load({ fetch: validLine, listProperties });
    const result = await (await api.GET(request())).json();
    assert.equal(result.ready, false);
    assert.ok(hasCode(result, code));
    assert.equal(JSON.stringify(result).includes('private-database-url'), false);
    assert.equal(JSON.stringify(result).includes('private-token'), false);
  }
});

test('network errors and timeouts are sanitized and do not call any message API', async () => {
  for (const error of [Error('private-token private-secret'), Object.assign(Error('private error'), { name: 'TimeoutError' })]) {
    const requests = [];
    const api = load({ fetch: async (url) => { requests.push(url); throw error; } });
    const result = await (await api.GET(request())).json();
    assert.equal(result.ready, false);
    assert.ok(hasCode(result, error.name === 'TimeoutError' ? 'LINE_REQUEST_TIMEOUT' : 'LINE_API_UNAVAILABLE'));
    assert.deepEqual(requests, ['https://api.line.me/v2/bot/info']);
    assert.equal(JSON.stringify(result).includes('private-token'), false);
    assert.equal(JSON.stringify(result).includes('private-secret'), false);
  }
});

test('invalid canonical site URL is not echoed and prevents webhook readiness', async () => {
  const api = load({ env: { ...configuredEnv, NEXT_PUBLIC_SITE_URL: 'https://private-token:private-secret@site.example' }, fetch: validLine });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, false);
  assert.ok(hasCode(result, 'SITE_URL_INVALID'));
  assert.equal(result.expectedWebhookEndpoint, undefined);
  assert.equal(JSON.stringify(result).includes('private-token'), false);
  assert.equal(JSON.stringify(result).includes('private-secret'), false);
});

const menuId = suffix => `richmenu-${suffix.repeat(32)}`;
const storedMenu = (id, name = 'Main menu') => ({
  richMenuId: id, name, selected: true, size: { width: 2500, height: 1686 },
  areas: Array.from({ length: 6 }, () => ({ action: { type: 'message', text: 'private-customer-message' } })),
  privateField: 'private-user-data',
});

test('rich-menu inspection reads only fixed endpoints and returns bounded safe metadata', async () => {
  const requests = [];
  const api = load({ fetch: async (url, init) => {
    requests.push({ url, method: init.method });
    if (url.endsWith('/user/all/richmenu')) {
      assert.equal(init.headers.Authorization, 'Bearer private-token');
      assert.equal(init.redirect, 'error');
      return Response.json({ richMenuId: menuId('a'), privateField: 'private-user-data' });
    }
    if (url.endsWith('/richmenu/list')) return Response.json({ richmenus: [storedMenu(menuId('a'), 'Main private-token private-secret')] });
    return validLine(url, init);
  } });
  const result = await (await api.GET(request())).json();
  assert.equal(result.ready, true);
  assert.equal(result.richMenu.status, 'checked');
  assert.equal(result.richMenu.defaultStatus, 'set');
  assert.equal(result.richMenu.defaultId, menuId('a'));
  assert.equal(result.richMenu.totalMenus, 1);
  assert.deepEqual(result.richMenu.menus, [{ id: menuId('a'), name: 'Main [REDACTED] [REDACTED]', selected: true, width: 2500, height: 1686, areaCount: 6 }]);
  assert.deepEqual(requests.map(item => item.method), ['GET', 'GET', 'GET', 'GET']);
  assert.deepEqual(new Set(requests.map(item => item.url)), new Set([
    'https://api.line.me/v2/bot/info', 'https://api.line.me/v2/bot/channel/webhook/endpoint',
    'https://api.line.me/v2/bot/user/all/richmenu', 'https://api.line.me/v2/bot/richmenu/list',
  ]));
  for (const value of ['private-token', 'private-secret', 'private-user-data', 'private-customer-message']) assert.equal(JSON.stringify(result).includes(value), false);
});

test('rich-menu 404 means no API default and does not imply Manager menu absence', async () => {
  const api = load({ fetch: async (url, init) => url.endsWith('/richmenu/list')
    ? Response.json({ richmenus: [storedMenu(menuId('b'))] }) : validLine(url, init) });
  const result = await (await api.GET(request())).json();
  assert.equal(result.richMenu.status, 'checked');
  assert.equal(result.richMenu.defaultStatus, 'none');
  assert.equal(result.richMenu.totalMenus, 1);
  assert.match(result.richMenu.message, /ไม่รวมเมนูที่สร้างใน LINE OA Manager/);
});

test('menu failures and malformed menu data do not expose provider bodies or alter other readiness', async () => {
  for (const menuResponse of [
    () => ({ ok: false, status: 403, json: async () => { throw Error('Must not read private-token provider body'); } }),
    () => Response.json({ richmenus: [storedMenu('private-token')] }),
    () => Response.json({ richmenus: [{ ...storedMenu(menuId('a')), size: { width: 'private-token', height: 1686 } }] }),
  ]) {
    const api = load({ fetch: async (url, init) => url.endsWith('/richmenu/list') ? menuResponse() : validLine(url, init) });
    const result = await (await api.GET(request())).json();
    assert.equal(result.ready, true);
    assert.equal(result.richMenu.status, 'unavailable');
    assert.equal(result.richMenu.listStatus, 'unavailable');
    assert.equal(result.richMenu.totalMenus, null);
    assert.deepEqual(result.richMenu.menus, []);
    assert.equal(JSON.stringify(result).includes('private-token'), false);
  }
});

test('invalid or unavailable default ID is distinguished from an absent API default', async () => {
  for (const defaultResponse of [
    () => Response.json({ richMenuId: 'private-token' }),
    () => Response.json({}, { status: 503 }),
    () => { throw Object.assign(Error('private-token'), { name: 'TimeoutError' }); },
  ]) {
    const api = load({ fetch: async (url, init) => url.endsWith('/user/all/richmenu') ? defaultResponse() : validLine(url, init) });
    const result = await (await api.GET(request())).json();
    assert.equal(result.richMenu.defaultStatus, 'unavailable');
    assert.equal(result.richMenu.defaultId, null);
    assert.equal(result.richMenu.status, 'unavailable');
    assert.equal(JSON.stringify(result).includes('private-token'), false);
  }
});

test('many stored menus keep the API default visible without returning every menu', async () => {
  const menus = Array.from({ length: 25 }, (_, index) => storedMenu(`richmenu-${index.toString(16).padStart(32, '0')}`, `Menu ${index}`));
  const defaultId = menus[24].richMenuId;
  const api = load({ fetch: async (url, init) => {
    if (url.endsWith('/user/all/richmenu')) return Response.json({ richMenuId: defaultId });
    if (url.endsWith('/richmenu/list')) return Response.json({ richmenus: menus });
    return validLine(url, init);
  } });
  const result = await (await api.GET(request())).json();
  assert.equal(result.richMenu.totalMenus, 25);
  assert.equal(result.richMenu.menus.length, 20);
  assert.equal(result.richMenu.menus[0].id, defaultId);
});
