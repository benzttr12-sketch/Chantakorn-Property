const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');

function loadPropertyImageHelper() {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/line-property-image.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require, URL });
  return module.exports;
}

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
      if (name === '@/lib/line-property-image') return loadPropertyImageHelper();
      if (name === '@/lib/format-code') return { formatPropertyCode: (id) => id ? 'CK-' + String(id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() : '-' };
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

async function propertyPush(property, env = {}) {
  let payload;
  const api = load({ staff: true,
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'runtime-token', LINE_TARGET_USER_ID: owner, ...env },
    fetch: async (url, init) => {
      assert.equal(url, 'https://api.line.me/v2/bot/message/push');
      payload = JSON.parse(init.body);
      return Response.json({});
    },
  });
  const response = await api.POST(request({ manualSend: true, ...property }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).isRealSent, true);
  assert.equal(payload.to, owner);
  return payload;
}

const uploadedImageUrl = (id, photo) => `https://example.com/api/line/property-image?id=${encodeURIComponent(id)}&v=${createHash('sha256').update(photo).digest('hex').slice(0, 16)}`;

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

test('staff manual sends and tests still reach LINE when automatic notifications are disabled', async () => {
  const sends = [];
  const api = load({ staff: true,
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'runtime-token', LINE_TARGET_USER_ID: owner },
    firestore: { getFirestoreDocument: async () => Response.json({ fields: { auto_notify_new_property: { booleanValue: false } } }) },
    fetch: async (_url, init) => { sends.push(JSON.parse(init.body)); return Response.json({}); },
  });
  for (const intent of [{ manualSend: true }, { isTest: true }]) {
    const result = await (await api.POST(request({ title: 'Home', ...intent }))).json();
    assert.equal(result.isRealSent, true);
    assert.equal(result.simulated, false);
  }
  assert.equal(sends.length, 2);
  assert.equal(sends.every(item => item.to === owner), true);
});

test('public callers cannot use manual or test flags to bypass disabled inquiry notifications', async () => {
  const api = load({ firestore: { getFirestoreDocument: async () => Response.json({ fields: { auto_notify_consignment: { booleanValue: false } } }) } });
  for (const intent of [{ manualSend: true }, { isTest: true }]) {
    const result = await (await api.POST(request({ inquiry_type: 'inquiry', ...intent }))).json();
    assert.equal(result.isRealSent, false);
    assert.equal(result.simulated, true);
  }
  assert.equal((await api.POST(request({ title: 'Home', manualSend: true }))).status, 401);
});

test('missing token, missing recipient and invalid recipient have distinct safe errors', async () => {
  const configurations = [
    [{ LINE_TARGET_USER_ID: owner }, 'LINE_TOKEN_MISSING'],
    [{ LINE_CHANNEL_ACCESS_TOKEN: 'private-token' }, 'LINE_RECIPIENT_MISSING'],
    [{ LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_TARGET_USER_ID: '@not-a-user-id' }, 'LINE_RECIPIENT_INVALID'],
  ];
  for (const [env, code] of configurations) {
    const api = load({ staff: true, env });
    const response = await api.POST(request({ title: 'Home', manualSend: true }));
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.code, code);
    assert.equal(result.isRealSent, false);
    assert.equal(JSON.stringify(result).includes('private-token'), false);
    assert.equal(JSON.stringify(result).includes('@not-a-user-id'), false);
  }
});

test('staff readiness reflects all recipients without exposing their IDs', async () => {
  for (const [recipients, configured, count] of [[`${owner}, ${owner}, ${second}`, true, 2], ['', false, 0], [`${owner}, invalid`, false, 1]]) {
    const api = load({ staff: true, env: { LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_ADMIN_USER_IDS: recipients } });
    const result = await (await api.GET(new Request('https://example.com/api/line/notify'))).json();
    assert.equal(result.isRecipientConfigured, configured);
    assert.equal(result.recipientCount, count);
    assert.equal(JSON.stringify(result).includes(owner), false);
    assert.equal(JSON.stringify(result).includes(second), false);
  }
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
  const photo = 'data:image/png;base64,' + 'a'.repeat(20000);
  const payload = await propertyPush({ id: 'uploaded home', title: 'Home', images: [photo] });
  assert.equal(payload.messages[1].contents.hero.url, uploadedImageUrl('uploaded home', photo));
  assert.equal(JSON.stringify(payload).includes('data:image/'), false);
});

test('notification uses the selected property cover ahead of gallery photos and video thumbnails', async () => {
  const payload = await propertyPush({
    id: 'selected-home', title: 'ขายที่ดิน สิงหนคร',
    cover_image: ' https://photos.example.test/selected-cover.jpg ',
    images: ['https://photos.example.test/other-photo.jpg'],
    video_url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  });
  assert.equal(payload.messages[1].contents.hero.url, 'https://photos.example.test/selected-cover.jpg');
});

test('uploaded notification cover uses the API origin while detail links use the configured website', async () => {
  const photo = 'data:image/webp;base64,UklGRg==';
  const payload = await propertyPush({
    id: 'home one', title: 'Uploaded home', slug: 'home one', cover_image: photo,
    images: ['https://photos.example.test/gallery.jpg'],
    video_url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  }, { NEXT_PUBLIC_SITE_URL: 'https://static.example.test/property-site/' });
  const hero = payload.messages[1].contents.hero;
  assert.equal(hero.url, uploadedImageUrl('home one', photo));
  assert.equal(hero.action.uri, 'https://static.example.test/property-site/properties/CK-HOMEON');
  assert.equal(JSON.stringify(payload).includes('data:image/'), false);
});

test('notification skips invalid covers and selects the first usable actual gallery photo', async () => {
  const payload = await propertyPush({
    id: 'gallery-home', title: 'Gallery home', cover_image: 'blob:local-preview',
    images: ['javascript:alert(1)', ' https://photos.example.test/บ้าน.jpg ', 'https://photos.example.test/later.jpg'],
    video_url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  });
  assert.equal(payload.messages[1].contents.hero.url, 'https://photos.example.test/%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99.jpg');
});

test('changing an uploaded notification cover changes its URL so LINE can fetch the replacement', async () => {
  const firstPhoto = 'data:image/png;base64,YQ==';
  const replacementPhoto = 'data:image/png;base64,Yg==';
  const urls = [];
  for (const photo of [firstPhoto, replacementPhoto, firstPhoto]) {
    const payload = await propertyPush({ id: 'same-home', title: 'Home', cover_image: photo });
    urls.push(payload.messages[1].contents.hero.url);
  }
  assert.equal(urls[0], uploadedImageUrl('same-home', firstPhoto));
  assert.equal(urls[1], uploadedImageUrl('same-home', replacementPhoto));
  assert.notEqual(urls[0], urls[1]);
  assert.equal(urls[0], urls[2]);
});

test('notification without a property photo omits the hero instead of showing a sample, stock, or video image', async () => {
  for (const property of [
    { id: 'photo-less-land', title: 'ขายที่ดิน สิงหนคร', property_type: 'land', cover_image: 'http://photos.example.test/insecure.jpg', images: [] },
    { id: 'photo-less-home', title: 'Home', property_type: 'house', images: ['blob:local-preview'], video_url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4' },
  ]) {
    const payload = await propertyPush(property);
    assert.equal(Object.hasOwn(payload.messages[1].contents, 'hero'), false);
  }
});
