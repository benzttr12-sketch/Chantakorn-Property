const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

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
      if (name === '@/lib/firestore-rest') return { listFirestoreDocuments: listProperties };
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
  assert.deepEqual(query.slice(0, 2), ['properties', 20]);
  assert.equal(query[2].publishedOnly, true);
  assert.match(check(result, 'รายการทรัพย์ที่เผยแพร่').message, /1 รายการ/);
  assert.equal(requests.length, 2);
  for (const value of ['private-token', 'private-secret', 'private-bot-id', 'Private display name', 'private-to-diagnostics-title']) {
    assert.equal(JSON.stringify(result).includes(value), false);
  }
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
