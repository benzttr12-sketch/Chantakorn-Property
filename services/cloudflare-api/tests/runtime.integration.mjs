import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

// Fully local workerd + actual D1/R2 bindings. All external requests are intercepted;
// these synthetic Firebase identities can never authenticate against a real project.
test('local Worker HTTP / D1 / R2 / Firebase authorization contract', async t => {
  const project = 'chantakorn-runtime-test';
  const origin = 'https://admin.example.test';
  const uid = 'synthetic-admin';
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'local-test', alg: 'RS256', use: 'sig' };
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email_verified: true, auth_time: now - 60 })
    .setProtectedHeader({ alg: 'RS256', kid: 'local-test' })
    .setIssuer(`https://securetoken.google.com/${project}`).setAudience(project)
    .setSubject(uid).setIssuedAt(now - 30).setExpirationTime(now + 600).sign(privateKey);
  let account = { localId: uid, disabled: false, emailVerified: true, validSince: '0' };
  let lookupFailure = false;
  const bundled = await build({ entryPoints: ['src/index.ts'], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022' });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-10-01',
    d1Databases: ['DB'], r2Buckets: ['PROPERTY_MEDIA', 'PRIVATE_MEDIA'],
    bindings: { ALLOWED_ORIGIN: origin, FIREBASE_PROJECT_ID: project,
      FIREBASE_WEB_API_KEY: 'synthetic-key-for-local-tests-only',
      PROPERTY_WRITES_ENABLED: 'true', PROPERTY_PUBLICATION_ENABLED: 'false', MEDIA_WRITES_ENABLED: 'true' },
    outboundService: async request => {
      const url = new URL(request.url);
      if (url.origin === 'https://www.googleapis.com' &&
          url.pathname === '/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
        return Response.json({ keys: [jwk] });
      if (url.origin === 'https://identitytoolkit.googleapis.com' && url.pathname === '/v1/accounts:lookup') {
        assert.equal(request.method, 'POST');
        assert.equal((await request.json()).idToken, token);
        return lookupFailure ? new Response('', { status: 503 }) : Response.json({ users: [account] });
      }
      throw new Error('Unexpected external request: ' + url.origin);
    },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('migrations')).filter(x => x.endsWith('.sql')).sort()) {
    const sql = (await readFile('migrations/' + file, 'utf8')).replace(/^\s*--.*$/gm, '');
    for (const statement of sql.split(';').map(x => x.trim()).filter(Boolean))
      await db.prepare(statement).run();
  }
  const headers = { Authorization: 'Bearer ' + token, Origin: origin, 'Content-Type': 'application/json' };
  const fetchApi = (path, options) => mf.dispatchFetch('https://worker.example.test' + path, options);
  const insertProperty = async (id, slug, published, deleted = null) => db.prepare(
    'INSERT INTO properties (id,code,slug,title,property_type,status,price,province,district,published,deleted_at,internal_notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, 'CK-' + slug, slug, 'Synthetic listing ' + slug, 'house', 'sale', 500000,
    'กรุงเทพมหานคร', 'บางรัก', published, deleted, 'PRIVATE-SYNTHETIC-NOTE',
    '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z').run();
  const publicId = '00000000-0000-4000-8000-000000000001';
  const draftId = '00000000-0000-4000-8000-000000000002';
  const deletedId = '00000000-0000-4000-8000-000000000003';
  const mediaId = '00000000-0000-4000-8000-000000000010';
  const privateId = '00000000-0000-4000-8000-000000000011';
  const inquiryId = '00000000-0000-4000-8000-000000000020';

  await t.test('fresh migrations contain zero old listings', async () => {
    const response = await fetchApi('/v1/properties');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [], next_cursor: null });
  });
  await insertProperty(publicId, 'published', 1);
  await insertProperty(draftId, 'draft', 0);
  await insertProperty(deletedId, 'deleted', 1, '2026-10-20T00:00:00.000Z');
  await insertProperty('00000000-0000-4000-8000-000000000004', 'published-two', 1);
  await db.prepare('INSERT INTO profiles(uid,full_name,role,created_at,updated_at) VALUES (?,?,?,?,?)')
    .bind(uid, 'Synthetic staff', 'ADMIN', '2026-10-20', '2026-10-20').run();
  await db.prepare('INSERT INTO inquiries(id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .bind(inquiryId, 'SYNTHETIC CUSTOMER', '2026-10-20', '2026-10-20').run();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lE8AAAAASUVORK5CYII=', 'base64');
  const publicBucket = await mf.getR2Bucket('PROPERTY_MEDIA');
  const privateBucket = await mf.getR2Bucket('PRIVATE_MEDIA');
  await publicBucket.put('properties/published/test.png', png);
  await privateBucket.put('inquiries/private/test.png', png);
  await db.prepare('INSERT INTO property_media(id,property_id,object_key,public_url,content_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(mediaId, publicId, 'properties/published/test.png', '/v1/media/properties/' + mediaId, 'image/png', png.length, '2026-10-20').run();
  await db.prepare('INSERT INTO inquiry_media(id,inquiry_id,object_key,content_type,byte_size,created_at) VALUES (?,?,?,?,?,?)')
    .bind(privateId, inquiryId, 'inquiries/private/test.png', 'image/png', png.length, '2026-10-20').run();

  await t.test('public SQL filters and cursor pagination exclude private fields', async () => {
    const first = await fetchApi('/v1/properties?limit=1');
    assert.match(first.headers.get('Cache-Control'), /s-maxage=60/);
    const a = await first.json();
    const b = await (await fetchApi('/v1/properties?limit=1&cursor=' + encodeURIComponent(a.next_cursor))).json();
    assert.equal(a.data.length, 1); assert.equal(b.data.length, 1);
    assert.notEqual(a.data[0].id, b.data[0].id); assert.equal(b.next_cursor, null);
    assert.deepEqual([a.data[0].id, b.data[0].id].sort(), [publicId, '00000000-0000-4000-8000-000000000004']);
    assert.equal(JSON.stringify([a, b]).includes('PRIVATE-SYNTHETIC-NOTE'), false);
    assert.equal((await fetchApi('/v1/properties/draft')).status, 404);
    assert.equal((await fetchApi('/v1/properties/deleted')).status, 404);
    assert.equal((await fetchApi('/v1/properties?limit=999')).status, 400);
  });
  await t.test('private R2 read requires active signed Firebase staff identity', async () => {
    const anonymous = await fetchApi('/v1/media/inquiries/' + privateId);
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers.get('Cache-Control'), 'private, no-store');
    const staff = await fetchApi('/v1/staff/me', { headers });
    assert.equal(staff.status, 200); assert.equal(staff.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await staff.json(), { uid, full_name: 'Synthetic staff', role: 'ADMIN' });
    const good = await fetchApi('/v1/media/inquiries/' + privateId, { headers });
    assert.equal(good.status, 200); assert.equal(good.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await good.arrayBuffer()), png);
    account.disabled = true;
    const disabled = await fetchApi('/v1/media/inquiries/' + privateId, { headers });
    assert.equal(disabled.status, 403); assert.equal(disabled.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await fetchApi('/v1/staff/me', { headers })).status, 403);
    account.disabled = false; account.validSince = String(now);
    assert.equal((await fetchApi('/v1/media/inquiries/' + privateId, { headers })).status, 403);
    account.validSince = '0'; lookupFailure = true;
    const failed = await fetchApi('/v1/media/inquiries/' + privateId, { headers });
    assert.equal(failed.status, 401); assert.equal(failed.headers.get('Cache-Control'), 'private, no-store');
    lookupFailure = false;
    await db.prepare('UPDATE profiles SET role=? WHERE uid=?').bind('USER', uid).run();
    assert.equal((await fetchApi('/v1/media/inquiries/' + privateId, { headers })).status, 403);
    await db.prepare('DELETE FROM profiles WHERE uid=?').bind(uid).run();
    assert.equal((await fetchApi('/v1/media/inquiries/' + privateId, { headers })).status, 403);
    await db.prepare('INSERT INTO profiles(uid,full_name,role,created_at,updated_at) VALUES (?,?,?,?,?)')
      .bind(uid, 'Synthetic staff', 'ADMIN', '2026-10-20', '2026-10-20').run();
  });
  await t.test('R2 public delivery stops after unpublishing', async () => {
    const response = await fetchApi('/v1/media/properties/' + mediaId);
    assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control'), /max-age=30/);
    await db.prepare('UPDATE properties SET published=0 WHERE id=?').bind(publicId).run();
    assert.equal((await fetchApi('/v1/media/properties/' + mediaId)).status, 404);
  });
  let created;
  await t.test('admin creates draft, refuses publication and stale revision', async () => {
    const response = await fetchApi('/v1/admin/properties', { method: 'POST', headers, body: JSON.stringify({
      title: 'ทรัพย์ทดสอบใหม่', slug: 'new-local', property_type: 'house', status: 'sale',
      price: 100000, province: 'กรุงเทพมหานคร', district: 'บางรัก', published: true,
    }) });
    assert.equal(response.status, 201); created = (await response.json()).data;
    assert.equal(created.published, false);
    const publish = await fetchApi('/v1/admin/properties/' + created.id, { method: 'PATCH', headers,
      body: JSON.stringify({ updates: { published: true }, expected_updated_at: created.updated_at }) });
    assert.equal(publish.status, 503);
    const edited = await fetchApi('/v1/admin/properties/' + created.id, { method: 'PATCH', headers,
      body: JSON.stringify({ updates: { price: 200000 }, expected_updated_at: created.updated_at }) });
    assert.equal(edited.status, 200);
    const stale = await fetchApi('/v1/admin/properties/' + created.id, { method: 'PATCH', headers,
      body: JSON.stringify({ updates: { price: 300000 }, expected_updated_at: created.updated_at }) });
    assert.equal(stale.status, 409); created = (await edited.json()).data;
    const rows = await db.prepare('SELECT action FROM audit_events WHERE target_id=?').bind(created.id).all();
    assert.deepEqual(rows.results.map(r => r.action), ['created', 'updated']);
    const competing = await Promise.all([400000, 500000].map(price => fetchApi('/v1/admin/properties/' + created.id,
      { method: 'PATCH', headers, body: JSON.stringify({ updates: { price }, expected_updated_at: created.updated_at }) })));
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
    created = (await (await fetchApi('/v1/admin/properties/' + created.id, { headers })).json()).data;
  });
  await t.test('R2 writes enforce ADMIN, live state, origin and undeleted owner', async () => {
    const upload = () => fetchApi('/v1/media/properties/' + created.id, { method: 'POST',
      headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': String(png.length) }, body: png });
    await db.prepare('UPDATE profiles SET role=? WHERE uid=?').bind('AGENT', uid).run();
    assert.equal((await upload()).status, 403);
    await db.prepare('UPDATE profiles SET role=? WHERE uid=?').bind('ADMIN', uid).run();
    account.disabled = true; assert.equal((await upload()).status, 403); account.disabled = false;
    assert.equal((await fetchApi('/v1/media/properties/' + created.id, { method: 'POST',
      headers: { ...headers, Origin: 'https://evil.example.test' }, body: png })).status, 403);
    const result = await upload(); assert.equal(result.status, 201);
    const { media_id } = await result.json();
    const stored = await db.prepare('SELECT object_key FROM property_media WHERE id=?').bind(media_id).first();
    assert.deepEqual(Buffer.from(await (await publicBucket.get(stored.object_key)).arrayBuffer()), png);
    assert.equal((await fetchApi('/v1/media/properties/' + media_id)).status, 404);
    assert.equal((await fetchApi('/v1/media/properties/' + deletedId, { method: 'POST',
      headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': String(png.length) }, body: png })).status, 404);
  });
  await t.test('audit failure rolls back create, update and delete', async () => {
    await db.prepare("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END").run();
    try {
      const create = await fetchApi('/v1/admin/properties', { method: 'POST', headers, body: JSON.stringify({
        title: 'Audit rollback', slug: 'audit-rollback', property_type: 'house', status: 'sale',
        price: 123, province: 'Test', district: 'Test',
      }) });
      assert.equal(create.status, 503);
      assert.equal(await db.prepare("SELECT id FROM properties WHERE slug='audit-rollback'").first(), null);
      const endpoint = '/v1/admin/properties/' + created.id;
      const update = await fetchApi(endpoint, { method: 'PATCH', headers, body: JSON.stringify({
        updates: { price: 999 }, expected_updated_at: created.updated_at,
      }) });
      assert.equal(update.status, 503);
      const remove = await fetchApi(endpoint, { method: 'DELETE', headers,
        body: JSON.stringify({ expected_updated_at: created.updated_at }) });
      assert.equal(remove.status, 503);
      const row = await db.prepare('SELECT price,updated_at,deleted_at FROM properties WHERE id=?').bind(created.id).first();
      assert.equal(row.price, created.price); assert.equal(row.updated_at, created.updated_at);
      assert.equal(row.deleted_at, null);
    } finally { await db.prepare('DROP TRIGGER reject_audit').run(); }
  });
  await t.test('concurrent uploads cannot exceed either quota and losing objects are cleaned', async () => {
    for (const kind of ['properties', 'inquiries']) {
      const property = kind === 'properties';
      const table = property ? 'property_media' : 'inquiry_media';
      const ownerField = property ? 'property_id' : 'inquiry_id';
      const owner = property ? created.id : inquiryId;
      const limit = property ? 60 : 15;
      const bucket = property ? publicBucket : privateBucket;
      const count = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${ownerField}=?`).bind(owner).first();
      for (let i = count.n; i < limit - 1; i++) {
        const id = crypto.randomUUID();
        const query = property
          ? 'INSERT INTO property_media(id,property_id,object_key,public_url,content_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?)'
          : 'INSERT INTO inquiry_media(id,inquiry_id,object_key,content_type,byte_size,created_at) VALUES (?,?,?,?,?,?)';
        const values = [id, owner, 'synthetic-quota/' + id, ...(property ? ['/v1/media/properties/' + id] : []), 'image/png', png.length, '2026-10-20'];
        await db.prepare(query).bind(...values).run();
      }
      const before = (await bucket.list()).objects.length;
      const replies = await Promise.all(Array.from({ length: 6 }, () => fetchApi('/v1/media/' + kind + '/' + owner, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': String(png.length) }, body: png,
      })));
      assert.equal(replies.filter(r => r.status === 201).length, 1);
      assert.ok(replies.every(r => [201, 409, 429].includes(r.status)));
      assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${ownerField}=?`).bind(owner).first()).n, limit);
      assert.equal((await bucket.list()).objects.length, before + 1);
    }
  });
  await t.test('delete requires observed revision and preserves soft-deleted row', async () => {
    const endpoint = '/v1/admin/properties/' + created.id;
    assert.equal((await fetchApi(endpoint, { method: 'DELETE', headers,
      body: JSON.stringify({ expected_updated_at: '2026-01-01T00:00:00.000Z' }) })).status, 409);
    assert.equal((await fetchApi(endpoint, { method: 'DELETE', headers,
      body: JSON.stringify({ expected_updated_at: created.updated_at }) })).status, 200);
    assert.equal((await fetchApi(endpoint, { headers })).status, 404);
    assert.ok((await db.prepare('SELECT deleted_at FROM properties WHERE id=?').bind(created.id).first()).deleted_at);
  });
});
