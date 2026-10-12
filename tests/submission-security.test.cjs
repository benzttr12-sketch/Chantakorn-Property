const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const loader = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const request = (body, path = 'inquiries', ip = '203.0.113.1', headers = {}) => new Request(`https://example.com/api/${path}`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip, ...headers },
});
const inquiry = (overrides = {}) => ({ id: randomUUID(), name: 'Customer', phone: '081-604-0097', message: 'Please contact me', inquiry_type: 'inquiry', ...overrides });
const consignment = (overrides = {}) => inquiry({ inquiry_type: 'consignment_sell', consignment_details: {
  property_type: 'house', province: 'Songkhla', district: 'Hat Yai', expected_price: 2000000, photos: [],
}, ...overrides });

// Transactions use isolated writes and commit atomically, including the one-MiB document ceiling.
// Serial execution lets concurrent requests exercise receipt/claim behavior without a live database.
function firestore(initial = {}, { failWrite = () => false } = {}) {
  let rows = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  let pending = Promise.resolve();
  const sizes = [];
  function snapshot(ref, data) {
    return { ref, id: ref.id, exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) };
  }
  const database = {
    collection(name) {
      const collection = {
        doc(id) {
          const ref = { id, path: `${name}/${id}` };
          ref.get = async () => snapshot(ref, rows.get(ref.path));
          for (const action of ['create', 'set', 'update', 'delete']) ref[action] = data => database.runTransaction(async tx => tx[action](ref, data));
          return ref;
        },
        where(field, operator, value) {
          assert.equal(operator, '<');
          return { limit: count => ({ get: async () => ({ docs: [...rows.entries()]
            .filter(([key, row]) => key.startsWith(`${name}/`) && row[field] < value).slice(0, count)
            .map(([key, row]) => snapshot(collection.doc(key.slice(name.length + 1)), row)) }) }) };
        },
      };
      return collection;
    },
    runTransaction(operation) {
      const run = pending.then(async () => {
        const writes = [];
        let written = false;
        const tx = {
          async get(ref) { assert.equal(written, false, 'Firestore requires all reads before writes'); return snapshot(ref, rows.get(ref.path)); },
          async getAll(...refs) { return Promise.all(refs.map(ref => tx.get(ref))); },
        };
        for (const action of ['create', 'set', 'update', 'delete']) tx[action] = (ref, data) => {
          written = true;
          writes.push({ action, ref, data: data === undefined ? undefined : structuredClone(data) });
        };
        const result = await operation(tx);
        const updated = new Map(rows);
        for (const { action, ref, data } of writes) {
          if (failWrite(ref.path, action, data)) throw new Error('Injected database failure');
          if (action === 'create' && updated.has(ref.path)) throw new Error('Document already exists');
          if (action === 'update' && !updated.has(ref.path)) throw new Error('Document does not exist');
          if (action === 'delete') { updated.delete(ref.path); continue; }
          const value = action === 'update' ? { ...updated.get(ref.path), ...data } : data;
          const size = Buffer.byteLength(JSON.stringify(value));
          if (size > 1048576) throw new Error('Document exceeds one MiB');
          sizes.push({ path: ref.path, bytes: size });
          updated.set(ref.path, value);
        }
        rows = updated;
        return result;
      });
      pending = run.catch(() => undefined);
      return run;
    },
    read: path => structuredClone(rows.get(path)),
    documents: name => [...rows.entries()].filter(([key]) => key.startsWith(`${name}/`)),
    sizes,
  };
  return database;
}

function submissionHarness({ db = firestore(), send = async () => Response.json({ isRealSent: true }), budget = async () => null, env = {}, globals = {} } = {}) {
  const sends = [];
  const server = { serverFirestore: () => db };
  const load = loader({
    '@/lib/server-firestore': server, './server-firestore': server,
    '@/lib/server-budget': { enforceRequestBudget: budget },
    './line-notify-service': { sendLineNotification: async (...args) => { sends.push(args); return send(...args); } },
  }, { ...globals, process: { env } });
  return { db, sends, load, api: load('app/api/inquiries/route.ts'), media: load('app/api/inquiries/media/route.ts') };
}

const raster = async (format = 'png', width = 4, height = 4) => {
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#e5bc42' } })[format]().toBuffer();
  return `data:image/${format};base64,${bytes.toString('base64')}`;
};
const session = (photo_ids = [], overrides = {}) => ({ token_hash: tokenHash('a'.repeat(64)), expires_at: Date.now() + 3600000, photo_ids, consumed: false, ...overrides });

test('the previous public LINE entrypoint denies anonymous payloads before reading or sending', async () => {
  let sends = 0;
  const api = loader({
    '@/lib/server-auth': { requireStaff: async () => Response.json({ error: 'Unauthorized' }, { status: 401 }) },
    '@/lib/line-notify-service': { sendLineNotification: async () => { sends++; return Response.json({}); } },
  })('app/api/line/notify/route.ts');
  for (const body of [inquiry(), consignment(), { inquiry_type: 'consignment', name: 'Spam' }, { action: 'save_settings' }]) {
    assert.equal((await api.POST(request(body, 'line/notify'))).status, 401);
  }
  assert.equal(sends, 0);
});

test('concurrent anonymous retries save one receipt and send one persisted, bounded notification', async () => {
  const owner = `U${'1'.repeat(32)}`;
  const h = submissionHarness({ env: { LINE_TARGET_USER_ID: owner, LINE_ADMIN_USER_IDS: `${owner},U${'2'.repeat(32)}` } });
  const body = inquiry({ status: 'closed', property_id: 'published', property_title: 'Caller-controlled title' });
  await h.db.collection('properties').doc('published').set({ published: true, title: 'Stored property title' });
  const responses = await Promise.all(Array.from({ length: 8 }, () => h.api.POST(request(body))));
  assert.ok(responses.every(response => response.status === 201));
  const receipts = await Promise.all(responses.map(response => response.json()));
  assert.equal(new Set(receipts.map(row => row.inquiry.created_at)).size, 1);
  assert.equal(h.db.documents('inquiries').length, 1);
  assert.equal(h.db.read(`inquiries/${body.id}`).status, 'new');
  assert.equal(h.db.read(`inquiries/${body.id}`).property_title, 'Stored property title');
  assert.equal(h.db.read(`inquiries/${body.id}`).line_notice_state, 'accepted');
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0][1].name, body.name);
  assert.equal(h.sends[0][1].property_title, undefined);
  for (const key of Object.values(h.sends[0][2])) assert.match(key, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('replaying an ID with different details returns conflict and cannot push another message', async () => {
  const h = submissionHarness();
  const body = inquiry();
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal((await h.api.POST(request({ ...body, message: 'Changed payload' }))).status, 409);
  assert.equal(h.sends.length, 1);
  assert.equal(h.db.read(`inquiries/${body.id}`).message, body.message);
});

test('notifications require a receipt and failure cannot undo saving or enable duplicate pushes', async () => {
  const h = submissionHarness({ send: async () => { throw new Error('LINE is unavailable'); } });
  const notify = h.load('lib/inquiry-notification.ts').notifySavedInquiry;
  await notify(randomUUID(), 'https://example.com/api/inquiries');
  assert.equal(h.sends.length, 0);
  const body = inquiry();
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(h.sends.length, 1);
  assert.equal(h.db.read(`inquiries/${body.id}`).line_notice_state, 'claimed');
});

test('a crashed notification lease can retry with the same LINE retry key and no second receipt', async () => {
  let now = Date.now(), attempts = 0;
  class Clock extends Date { static now() { return now; } }
  const h = submissionHarness({ globals: { Date: Clock }, env: { LINE_TARGET_USER_ID: `U${'1'.repeat(32)}` },
    send: async () => { if (++attempts === 1) throw new Error('Connection lost after request'); return Response.json({ isRealSent: true }); },
  });
  const body = inquiry();
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(attempts, 1);
  now += 90001;
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(attempts, 2);
  assert.deepEqual(plain(h.sends[1][2]), plain(h.sends[0][2]));
  assert.equal(h.db.documents('inquiries').length, 1);
  assert.equal(h.db.read(`inquiries/${body.id}`).line_notice_state, 'accepted');
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(attempts, 2);
});

test('LINE accepts a saved inquiry retry already acknowledged by the provider without pushing to followers', async () => {
  const owner = `U${'1'.repeat(32)}`, retryKey = randomUUID();
  let pushes = 0, followerReads = 0;
  const { sendLineNotification } = loader({
    '@/lib/server-auth': { requireStaff: async () => Response.json({}, { status: 401 }) },
    '@/lib/firestore-rest': {
      getFirestoreDocument: async () => Response.json({}, { status: 404 }),
      listFirestoreDocuments: async () => { followerReads++; return []; },
    },
  }, { process: { env: { LINE_CHANNEL_ACCESS_TOKEN: 'test-token', LINE_TARGET_USER_ID: owner } }, fetch: async (url, init) => {
    assert.equal(url, 'https://api.line.me/v2/bot/message/push');
    assert.equal(init.headers['X-Line-Retry-Key'], retryKey);
    assert.equal(JSON.parse(init.body).to, owner);
    pushes++;
    return new Response(null, { status: 409, headers: { 'x-line-accepted-request-id': 'already-accepted' } });
  } })('lib/line-notify-service.ts');
  const response = await sendLineNotification(request({}), inquiry(), { [owner]: retryKey });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).isRealSent, true);
  assert.equal(pushes, 1);
  assert.equal(followerReads, 0);
});

test('a failed receipt transaction never invokes LINE or partially consumes a photo session', async () => {
  const id = randomUUID(), photo = randomUUID();
  const db = firestore({ [`inquiry_media_sessions/${id}`]: session([photo]) }, { failWrite: path => path.startsWith('inquiries/') });
  const h = submissionHarness({ db });
  const body = consignment({ id, media_token: 'a'.repeat(64) });
  body.consignment_details.photos = [photo];
  assert.equal((await h.api.POST(request(body))).status, 503);
  assert.equal(h.sends.length, 0);
  assert.equal(db.read(`inquiry_media_sessions/${id}`).consumed, false);
  assert.equal(db.documents('inquiries').length, 0);
});

test('strict inquiry fields, type, text, contact and numeric limits reject before saving or notifying', async () => {
  const h = submissionHarness();
  for (const body of [null, [], inquiry({ id: '../other' }), inquiry({ extra: 'secret' }), inquiry({ name: 'x'.repeat(121) }),
    inquiry({ message: 'x'.repeat(4001) }), inquiry({ name: 'bad\u0000text' }), inquiry({ phone: 'letters' }),
    inquiry({ inquiry_type: 'consignment' }), inquiry({ consignment_details: {} }),
    consignment({ consignment_details: { property_type: 'house', district: 'Hat Yai', province: 'Songkhla', expected_price: -1 } }),
    consignment({ consignment_details: { property_type: 'house', district: 'Hat Yai', province: 'Songkhla', expected_price: 1, extra: 'private' } }),
    consignment({ consignment_details: { property_type: 'house', district: 'Hat Yai', province: 'Songkhla', expected_price: 1, photos: [await raster()] } }),
  ]) assert.equal((await h.api.POST(request(body))).status, 400);
  assert.equal(h.db.documents('inquiries').length, 0);
  assert.equal(h.sends.length, 0);
});

test('streamed inquiry byte limits and the shared budget reject without database writes or LINE', async () => {
  const h = submissionHarness({ budget: async () => Response.json({ error: 'limited' }, { status: 429 }) });
  assert.equal((await h.api.POST(request(inquiry({ message: 'x'.repeat(25000) }), 'inquiries', '203.0.113.1', { 'Content-Length': '1' }))).status, 413);
  assert.equal((await h.api.POST(request(inquiry()))).status, 429);
  assert.equal(h.db.documents('inquiries').length, 0);
  assert.equal(h.sends.length, 0);
});

test('property inquiry receipts require a currently published listing', async () => {
  const db = firestore({ 'properties/draft': { published: false, title: 'Draft' } });
  const h = submissionHarness({ db });
  for (const property_id of ['draft', 'missing']) assert.equal((await h.api.POST(request(inquiry({ property_id })))).status, 400);
  assert.equal(h.db.documents('inquiries').length, 0);
  assert.equal(h.sends.length, 0);
});

test('forged, expired, consumed and mismatched photo sessions cannot create receipts', async () => {
  const photo = randomUUID();
  for (const [stored, token, photos] of [
    [undefined, 'a'.repeat(64), [photo]], [session([photo]), 'b'.repeat(64), [photo]],
    [session([photo]), undefined, [photo]], [session([photo], { expires_at: Date.now() - 1 }), 'a'.repeat(64), [photo]],
    [session([photo], { consumed: true }), 'a'.repeat(64), [photo]], [session([photo]), 'a'.repeat(64), [randomUUID()]],
    [session([photo, randomUUID()]), 'a'.repeat(64), [photo]],
  ]) {
    const id = randomUUID(), db = firestore(stored ? { [`inquiry_media_sessions/${id}`]: stored } : {});
    const h = submissionHarness({ db }), body = consignment({ id, media_token: token });
    body.consignment_details.photos = photos;
    assert.equal((await h.api.POST(request(body))).status, 400);
    assert.equal(h.sends.length, 0);
    assert.equal(db.documents('inquiries').length, 0);
  }
});

test('real raster session uploads are idempotent and only their token can attach the saved photo IDs', async () => {
  const h = submissionHarness(), id = randomUUID(), photo = await raster();
  const started = await h.media.POST(request({ id, action: 'start' }, 'inquiries/media'));
  assert.equal(started.status, 200);
  const { token } = await started.json();
  const savedSession = h.db.read(`inquiry_media_sessions/${id}`);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(savedSession.token_hash, tokenHash(token));
  assert.equal(JSON.stringify(savedSession).includes(token), false);
  const upload = { id, action: 'upload', index: 0, token, photo };
  const first = await h.media.POST(request(upload, 'inquiries/media'));
  assert.equal(first.status, 200);
  const { mediaId } = await first.json();
  const retry = await (await h.media.POST(request(upload, 'inquiries/media'))).json();
  assert.equal(retry.mediaId, mediaId);
  assert.equal(h.db.documents('inquiry_media').length, 1);
  const body = consignment({ id, media_token: token });
  body.consignment_details.photos = [mediaId];
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(h.db.read(`inquiry_media_sessions/${id}`).consumed, true);
  assert.equal((await h.media.POST(request(upload, 'inquiries/media'))).status, 400);
  assert.equal((await h.api.POST(request(body))).status, 201);
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0][1].consignment_details.photos, undefined);
  assert.equal(JSON.stringify(h.db.read(`inquiries/${id}`)).includes('data:image'), false);
  assert.equal(JSON.stringify(h.db.read(`inquiries/${id}`)).includes(token), false);
});

test('media decoding rejects MIME forgery, SVG, truncated raster and excessive dimensions before storing', async () => {
  const png = await raster(), jpeg = await raster('jpeg');
  const truncated = `data:image/png;base64,${Buffer.from(png.split(',')[1], 'base64').subarray(0, 40).toString('base64')}`;
  const h = submissionHarness(), id = randomUUID();
  const { token } = await (await h.media.POST(request({ id, action: 'start' }, 'inquiries/media'))).json();
  for (const photo of [png.replace('image/png', 'image/jpeg'), jpeg.replace('image/jpeg', 'image/webp'),
    `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`, truncated,
    'data:image/jpeg;base64,/9j/4AAAAA==', await raster('png', 4097, 1),
  ]) assert.equal((await h.media.POST(request({ id, action: 'upload', token, index: 0, photo }, 'inquiries/media'))).status, 400);
  assert.equal(h.db.documents('inquiry_media').length, 0);
  assert.deepEqual(h.db.read(`inquiry_media_sessions/${id}`).photo_ids, []);
});

test('media schema, slot and byte ceilings reject oversized or unowned uploads', async () => {
  const h = submissionHarness(), id = randomUUID(), photo = await raster();
  for (const body of [{ id, action: 'upload', index: -1, photo }, { id, action: 'upload', index: 15, photo },
    { id, action: 'upload', index: 0.5, photo }, { id, action: 'upload', index: 0, photo, extra: true },
    { id: '../forged', action: 'start' }, { id, action: 'upload', index: 0, photo, token: 'b'.repeat(64) },
  ]) assert.equal((await h.media.POST(request(body, 'inquiries/media'))).status, 400);
  assert.equal((await h.media.POST(request({ id, action: 'upload', index: 0, photo: `data:image/png;base64,${Buffer.alloc(450001).toString('base64')}` }, 'inquiries/media'))).status, 413);
  assert.equal((await h.media.POST(request({ id, action: 'upload', index: 0, photo: 'x'.repeat(610 * 1024) }, 'inquiries/media', '203.0.113.1', { 'Content-Length': '1' }))).status, 413);
  assert.equal(h.db.documents('inquiry_media').length, 0);
});

test('media sessions reject stolen tokens and gaps while supporting all 15 legitimate photo slots', async () => {
  const id = randomUUID(), db = firestore({ [`inquiry_media_sessions/${id}`]: session() }), h = submissionHarness({ db }), photo = await raster('webp');
  for (const body of [{ id, action: 'upload', token: 'b'.repeat(64), index: 0, photo },
    { id, action: 'upload', token: 'a'.repeat(64), index: 1, photo },
  ]) assert.equal((await h.media.POST(request(body, 'inquiries/media'))).status, 400);
  for (let index = 0; index < 15; index++) assert.equal((await h.media.POST(request({ id, action: 'upload', token: 'a'.repeat(64), index, photo }, 'inquiries/media'))).status, 200);
  assert.equal(db.read(`inquiry_media_sessions/${id}`).photo_ids.length, 15);
  assert.equal(db.documents('inquiry_media').length, 15);
});

test('starting a session cleans abandoned expired media and preserves attached or live media', async () => {
  const old = randomUUID(), used = randomUUID(), live = randomUUID(), oldPhoto = randomUUID(), usedPhoto = randomUUID(), livePhoto = randomUUID();
  const db = firestore({
    [`inquiry_media_sessions/${old}`]: session([oldPhoto], { expires_at: Date.now() - 1 }),
    [`inquiry_media_sessions/${used}`]: session([usedPhoto], { expires_at: Date.now() - 1, consumed: true }),
    [`inquiry_media_sessions/${live}`]: session([livePhoto]),
    [`inquiry_media/${oldPhoto}`]: { inquiry_id: old }, [`inquiry_media/${usedPhoto}`]: { inquiry_id: used }, [`inquiry_media/${livePhoto}`]: { inquiry_id: live },
  });
  const h = submissionHarness({ db });
  assert.equal((await h.media.POST(request({ id: randomUUID(), action: 'start' }, 'inquiries/media'))).status, 200);
  assert.equal(db.read(`inquiry_media_sessions/${old}`), undefined);
  assert.equal(db.read(`inquiry_media/${oldPhoto}`), undefined);
  assert.equal(db.read(`inquiry_media_sessions/${used}`), undefined);
  assert.ok(db.read(`inquiry_media/${usedPhoto}`));
  assert.ok(db.read(`inquiry_media/${livePhoto}`));
});

test('the shared atomic global minute ceiling survives concurrent callers with rotating IPs', async () => {
  const db = firestore(), server = { serverFirestore: () => db };
  const { enforceRequestBudget } = loader({ './server-firestore': server })('lib/server-budget.ts');
  const responses = await Promise.all(Array.from({ length: 60 }, (_, index) => enforceRequestBudget(request({}, 'inquiries', `203.0.113.${index}`), 'test', { perMinute: 1, perDay: 50 })));
  assert.equal(responses.filter(response => response === null).length, 10);
  assert.ok(responses.filter(Boolean).every(response => response.status === 429 && response.headers.get('Retry-After') === '60'));
  assert.equal(db.read('request_budgets/test-global').minute_count, 10);
  assert.equal(db.read('request_budgets/test-global').day_count, 10);
});

test('global daily and individual limits survive minute rollover, while database errors fail closed', async () => {
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const db = firestore(), server = { serverFirestore: () => db };
  const { enforceRequestBudget } = loader({ './server-firestore': server }, { Date: Clock })('lib/server-budget.ts');
  const limited = (ip, options = { perMinute: 2, perDay: 5 }) => enforceRequestBudget(request({}, 'inquiries', ip), 'daily', options);
  assert.equal(await limited('same'), null);
  assert.equal(await limited('same'), null);
  assert.equal((await limited('same')).status, 429);
  now += 60000;
  for (let index = 0; index < 3; index++) assert.equal(await limited(`new-${index}`), null);
  now += 60000;
  assert.equal((await limited('another-new')).status, 429);
  const unavailable = loader({ './server-firestore': { serverFirestore: () => { throw new Error('Unavailable'); } } })('lib/server-budget.ts');
  assert.equal((await unavailable.enforceRequestBudget(request({}), 'unavailable')).status, 503);
});

test('published property projection excludes private and unknown nested data and hides inline image payloads', () => {
  const { publicProperty } = loader()('lib/public-property.ts');
  const row = { id: 'property/1', title: 'Public listing', published: true, internal_notes: 'Private', owner_phone: 'Private',
    arbitrary_future_field: 'Private', images: ['data:image/png;base64,AAAA', 'https://photos.example/image.webp'], cover_image: 'data:image/jpeg;base64,AAAA',
    agent: { id: 'a1', name: 'Agent', phone: '0816040097', internal_notes: 'Private', service_credentials: { secret: 'Private' } },
    feng_shui: { score: 80, summary: 'Public summary', internal_notes: 'Private', algorithm_context: { secret: 'Private' } },
  };
  assert.equal(publicProperty({ ...row, published: false }, 'https://example.com'), null);
  assert.equal(publicProperty({ ...row, published: undefined }, 'https://example.com'), null);
  const visible = plain(publicProperty(row, 'https://example.com'));
  assert.equal(JSON.stringify(visible).includes('Private'), false);
  assert.deepEqual(visible.agent, { id: 'a1', name: 'Agent', phone: '0816040097' });
  assert.deepEqual(visible.feng_shui, { score: 80, summary: 'Public summary' });
  assert.deepEqual(visible.images, ['https://example.com/api/properties/property%2F1/image?index=0', 'https://photos.example/image.webp']);
  assert.equal(visible.cover_image, 'https://example.com/api/properties/property%2F1/image');
  assert.equal(JSON.stringify(visible).includes('base64'), false);
});

test('public photo delivery requires published parent, attached membership and matching media parent', async () => {
  const mediaId = randomUUID(), dataUrl = await raster(), reads = [];
  const mediaUrl = `https://example.com/api/properties/published/image?media=${mediaId}`;
  let published = true, attached = true, parent = 'published';
  const api = loader({ '@/lib/firestore-rest': { getFirestoreDocument: async (collection, id) => {
    reads.push([collection, id]);
    if (collection === 'properties') return Response.json({ fields: {
      published: { booleanValue: published }, cover_image: { stringValue: attached ? mediaUrl : 'https://photos.example/unrelated.jpg' },
      images: { arrayValue: { values: [] } },
    } });
    return Response.json({ fields: { property_id: { stringValue: parent }, data_url: { stringValue: dataUrl } } });
  } } })('app/api/properties/[id]/image/route.ts');
  const get = () => api.GET(new Request(`${mediaUrl}&id=forged`), { params: Promise.resolve({ id: 'published' }) });
  published = false;
  assert.equal((await get()).status, 404);
  assert.deepEqual(reads, [['properties', 'published']]);
  published = true; attached = false; reads.length = 0;
  assert.equal((await get()).status, 404);
  assert.deepEqual(reads, [['properties', 'published']]);
  attached = true; parent = 'draft'; reads.length = 0;
  assert.equal((await get()).status, 404);
  assert.deepEqual(reads, [['properties', 'published'], ['property_media', mediaId]]);
  parent = 'published';
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'jpeg');
});

function propertyMediaHarness({ failAt = Infinity } = {}) {
  const stored = new Map(), deleted = [], sizes = [];
  let writes = 0;
  const api = loader({
    '@/lib/firebase/client': { db: {} },
    'firebase/firestore': {
      doc: (_db, collection, id) => ({ path: `${collection}/${id}` }),
      setDoc: async (ref, row) => {
        if (++writes === failAt) throw new Error('Save failed');
        const size = Buffer.byteLength(JSON.stringify(row));
        assert.ok(size < 1048576, 'each photo must fit an individual Firestore document');
        sizes.push(size); stored.set(ref.path, plain(row));
      },
      deleteDoc: async ref => { deleted.push(ref.path); stored.delete(ref.path); },
      getDocFromServer: async ref => ({ data: () => stored.get(ref.path) }),
    },
  }, { window: { location: { origin: 'https://example.com' } } })('lib/property-media.ts');
  return { api, stored, deleted, sizes };
}

test('multi-photo property persistence stores separate documents and keeps listing size below one MiB', async () => {
  const h = propertyMediaHarness();
  const images = Array.from({ length: 4 }, (_, index) => `data:image/jpeg;base64,${Buffer.alloc(450000, index).toString('base64')}`);
  const result = await h.api.preparePropertyMedia({}, 'listing', images, images[0]);
  assert.equal(h.stored.size, 4);
  assert.ok(h.sizes.reduce((sum, size) => sum + size, 0) > 1048576);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 10000);
  assert.ok(result.images.every(url => /^https:\/\/example\.com\/api\/properties\/listing\/image\?media=/.test(url)));
  assert.equal(result.cover_image, result.images[0]);
  await result.cleanup();
  assert.equal(h.stored.size, 0);
});

test('property media failure removes newly written photos and unsupported/oversized input never persists', async () => {
  const h = propertyMediaHarness({ failAt: 2 });
  const first = await raster(), second = await raster('jpeg');
  await assert.rejects(h.api.preparePropertyMedia({}, 'listing', [first, second], first), /Save failed/);
  assert.equal(h.stored.size, 0);
  assert.equal(h.deleted.length, 1);
  for (const images of [Array(61).fill(first), ['data:image/svg+xml;base64,AAAA'],
    [`data:image/jpeg;base64,${Buffer.alloc(450001).toString('base64')}`],
  ]) await assert.rejects(h.api.preparePropertyMedia({}, 'listing', images, images[0]));
  assert.equal(h.stored.size, 0);
});

test('staff photo hydration preserves saved media references on editing and rejects another property owner', async () => {
  const h = propertyMediaHarness(), photo = await raster();
  const prepared = await h.api.preparePropertyMedia({}, 'listing', [photo], photo);
  const hydrated = await h.api.loadStaffPropertyPhotos({ id: 'listing', ...prepared });
  assert.deepEqual(plain(hydrated.images), [photo]);
  const retained = await h.api.preparePropertyMedia({}, 'listing', hydrated.images, hydrated.cover_image);
  assert.deepEqual(plain(retained.images), plain(prepared.images));
  assert.equal(h.stored.size, 1);
  const other = await h.api.loadStaffPropertyPhotos({ id: 'another', ...prepared });
  assert.deepEqual(plain(other.images), plain(prepared.images));
  assert.equal(h.stored.size, 1);
});
test('exact persisted legacy photos can migrate without rejecting unrelated edits; new oversize photos cannot use the exception', async () => {
  const h=propertyMediaHarness();
  const photo=`data:image/jpeg;base64,${Buffer.alloc(750000,12).toString('base64')}`;
  await assert.rejects(h.api.preparePropertyMedia({},'listing',[photo],photo));
  const migrated=await h.api.preparePropertyMedia({},'listing',[photo],photo,[photo]);
  assert.equal(h.stored.size,1);
  assert.ok(h.sizes[0]<1048576);
  assert.ok(migrated.cover_image.startsWith('https://'));
});
