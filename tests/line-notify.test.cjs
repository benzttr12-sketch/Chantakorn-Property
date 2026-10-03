const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ staff = false, env = {}, firestore = {}, fetch = async () => { throw Error('Unexpected LINE request'); } } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/line/notify/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Request, Response, URL, Headers, fetch,
    process: { env }, console: { warn() {}, error() {} },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff: async () => staff ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) };
      if (name === '@/lib/property-image-cache') return {
        resolvePropertyHeroImageUrl: property => property.cover_image?.startsWith('https://')
          ? property.cover_image : 'https://images.example.test/resolved-home.jpg',
      };
      if (name === '@/lib/firestore-rest') return {
        getFirestoreDocument: firestore.getFirestoreDocument || (async () => Response.json({}, { status: 404 })),
        patchFirestoreDocument: firestore.patchFirestoreDocument || (async () => { throw Error('Unexpected settings write'); }),
      };
      throw Error(name);
    },
  });
  return module.exports;
}

const owner = 'U' + '1'.repeat(32);
const second = 'U' + '2'.repeat(32);
const customer = 'U' + '3'.repeat(32);
const request = body => new Request('https://example.com/api/line/notify', { method: 'POST', body: JSON.stringify(body) });

test('anonymous callers cannot read LINE settings or send staff listing notifications', async () => {
  const api = load();
  assert.equal((await api.GET(new Request('https://example.com/api/line/notify'))).status, 401);
  assert.equal((await api.POST(request({ title: 'Home' }))).status, 401);
});

test('staff settings response never exposes server token or secret', async () => {
  const api = load({ staff: true, env: { LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_CHANNEL_SECRET: 'private-secret' } });
  const body = await (await api.GET(new Request('https://example.com/api/line/notify'))).text();
  assert.equal(body.includes('private-token'), false);
  assert.equal(body.includes('private-secret'), false);
});

test('notifications use only unique configured staff recipients and ignore customer user IDs', async () => {
  const sends = [];
  const api = load({
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'test-token', LINE_TARGET_USER_ID: owner, LINE_ADMIN_USER_IDS: `${owner}, ${second}` },
    fetch: async (_url, init) => { sends.push(JSON.parse(init.body)); return Response.json({}); },
  });
  const result = await (await api.POST(request({ inquiry_type: 'inquiry', name: 'Test', userId: customer }))).json();
  assert.equal(result.deliveryStatus, 'accepted');
  assert.equal(result.acceptedRecipients, 2);
  assert.deepEqual(sends.map(item => item.to), [owner, second]);
  assert.equal(sends.some(item => item.to === customer), false);
});

test('public inquiries cannot override credentials or save settings', async () => {
  const api = load();
  assert.equal((await api.POST(request({ inquiry_type: 'inquiry', overrideToken: 'attacker' }))).status, 400);
  assert.equal((await api.POST(request({ inquiry_type: 'inquiry', action: 'save_settings' }))).status, 400);
});

test('a rejected LINE push is never reported as successful delivery', async () => {
  const api = load({
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'expired-token', LINE_TARGET_USER_ID: owner },
    fetch: async () => Response.json({ message: 'Invalid token' }, { status: 401 }),
  });
  const response = await api.POST(request({ inquiry_type: 'inquiry' }));
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.success, false);
  assert.equal(result.isRealSent, false);
  assert.equal(result.acceptedRecipients, 0);
});

test('legacy database credentials cannot override the rotated runtime credential', async () => {
  let authorization;
  const api = load({
    staff: true,
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'replacement-runtime-token', LINE_TARGET_USER_ID: owner },
    firestore: { getFirestoreDocument: async () => Response.json({ fields: {
      channel_access_token: { stringValue: 'legacy-database-token' },
      channel_secret: { stringValue: 'legacy-database-secret' },
    } }) },
    fetch: async (_url, init) => { authorization = init.headers.Authorization; return Response.json({}); },
  });
  const response = await api.POST(new Request('https://example.com/api/line/notify', {
    method: 'POST', headers: { Authorization: 'Bearer staff-session' }, body: JSON.stringify({ title: 'Home' }),
  }));
  assert.equal(response.status, 200);
  assert.equal(authorization, 'Bearer replacement-runtime-token');
});

test('saving preferences never persists submitted LINE credentials', async () => {
  let fields;
  const api = load({ staff: true, firestore: {
    patchFirestoreDocument: async (_collection, _id, value) => { fields = value; return Response.json({}); },
  } });
  const response = await api.POST(new Request('https://example.com/api/line/notify', {
    method: 'POST', headers: { Authorization: 'Bearer staff-session' },
    body: JSON.stringify({ action: 'save_settings', channelSecret: 'must-not-persist',
      channelAccessToken: 'must-not-persist', autoNotifyNewProperty: false, autoNotifyConsignment: true }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(fields).sort(), ['auto_notify_consignment', 'auto_notify_new_property', 'updated_at']);
  assert.equal(JSON.stringify(fields).includes('must-not-persist'), false);
});

test('disabled listing notifications remain disabled without calling LINE', async () => {
  const api = load({ staff: true, firestore: {
    getFirestoreDocument: async () => Response.json({ fields: { auto_notify_new_property: { booleanValue: false } } }),
  } });
  const response = await api.POST(new Request('https://example.com/api/line/notify', {
    method: 'POST', headers: { Authorization: 'Bearer staff-session' }, body: JSON.stringify({ title: 'Home' }),
  }));
  const result = await response.json();
  assert.equal(result.simulated, true);
  assert.equal(result.isRealSent, false);
});

test('anonymous inquiries preserve readable consignment preferences and do not poison staff settings', async () => {
  let reads = 0;
  const api = load({ staff: true, firestore: {
    getFirestoreDocument: async () => {
      reads += 1;
      return Response.json({ fields: {
        auto_notify_consignment: { booleanValue: false }, auto_notify_new_property: { booleanValue: false },
      } });
    },
  } });
  const response = await api.POST(request({ inquiry_type: 'inquiry' }));
  assert.equal((await response.json()).isRealSent, false);
  const config = await (await api.GET(new Request('https://example.com/api/line/notify', {
    headers: { Authorization: 'Bearer staff-session' },
  }))).json();
  assert.equal(config.autoNotifyConsignment, false);
  assert.equal(config.autoNotifyNewProperty, false);
  assert.equal(reads, 1);
});

test('a denied anonymous preference read does not cache defaults for a later staff request', async () => {
  const api = load({ staff: true, firestore: {
    getFirestoreDocument: async (_collection, _id, token) => token
      ? Response.json({ fields: { auto_notify_consignment: { booleanValue: false } } })
      : Response.json({}, { status: 403 }),
  } });
  await api.POST(request({ inquiry_type: 'inquiry' }));
  const config = await (await api.GET(new Request('https://example.com/api/line/notify', {
    headers: { Authorization: 'Bearer staff-session' },
  }))).json();
  assert.equal(config.autoNotifyConsignment, false);
});

test('staff can send an existing large property payload with a resolved public image', async () => {
  let payload;
  const api = load({ staff: true, env: { LINE_CHANNEL_ACCESS_TOKEN: 'runtime-token', LINE_TARGET_USER_ID: owner },
    fetch: async (_url, init) => { payload = JSON.parse(init.body); return Response.json({}); },
  });
  const response = await api.POST(request({ title: 'Home', images: ['data:image/png;base64,' + 'a'.repeat(20000)] }));
  assert.equal(response.status, 200);
  assert.equal(payload.messages[1].contents.hero.url, 'https://images.example.test/resolved-home.jpg');
  assert.equal(JSON.stringify(payload).includes('data:image/'), false);
});
