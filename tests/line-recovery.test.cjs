const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const image = fs.readFileSync(path.join(__dirname, '../src/lib/line-recovery/original-rich-menu.jpg'));
const menu = require('../src/lib/line-recovery/menu.json');
const id = `richmenu-${'a'.repeat(32)}`;
const token = 'token-private';
const worker = loadTs()('lib/line-recovery/restore.ts').restore;
function harness(options = {}) {
  const events = [];
  let locked = false, defaults = 0, lists = 0, downloads = 0, menuReads = 0;
  const acquire = async () => {
    events.push('claim');
    if (locked || options.lockFails) throw Error('private database failure');
    locked = true;
    return { stage: async stage => { events.push(`stage:${stage}`); if (options.failStage === stage) throw Error('private failure'); } };
  };
  const fetcher = async (url, init) => {
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    const u = new URL(url), p = u.pathname;
    events.push(`${init.method} ${u.host}${p}`);
    if (options.throwWrite && init.method === 'POST') throw Error(token + ' private body');
    if (p === '/v2/bot/info') return Response.json({ basicId: options.wrongAccount ? '@other' : '@930xzcyi' });
    if (p === '/v2/bot/user/all/richmenu' && init.method === 'GET') {
      defaults++;
      if (options.defaultInitiallySet && defaults === 1 || options.defaultChanges && defaults === 2) return Response.json({ richMenuId: id });
      return defaults < 3 ? new Response(null, { status: 404 }) : Response.json({ richMenuId: options.badFinal ? 'other' : id });
    }
    if (p === '/v2/bot/richmenu/list') {
      lists++;
      return Response.json({ richmenus: lists === 1 ? (options.listNotEmpty ? [{richMenuId:id}] : []) : options.extraMenu ? [{richMenuId:id},{richMenuId:'other'}] : [{richMenuId:id}] });
    }
    if (p === '/v2/bot/richmenu' && init.method === 'POST') {
      assert.deepEqual(JSON.parse(init.body), menu);
      return Response.json({ richMenuId: options.badId ? '../evil' : id });
    }
    if (p === `/v2/bot/richmenu/${id}` && init.method === 'GET') {
      menuReads++;
      const stored = JSON.parse(JSON.stringify(menu));
      if (options.badMenu && menuReads === 1 || options.badFinalMenu && menuReads === 2) stored.areas[0].action.text = 'unexpected-action';
      return Response.json({ richMenuId: id, ...stored });
    }
    if (p === `/v2/bot/richmenu/${id}/content` && init.method === 'POST') {
      assert.equal(u.host, 'api-data.line.me'); assert.equal(init.headers['Content-Type'], 'image/jpeg');
      assert.deepEqual(init.body, image);
      return options.uploadFails ? new Response('private error body ' + token, { status: 500 }) : new Response(null, { status: 200 });
    }
    if (p === `/v2/bot/richmenu/${id}/content` && init.method === 'GET') {
      downloads++;
      return new Response(options.badImage && downloads === 1 ? Buffer.from('not the image') : image);
    }
    if (p === `/v2/bot/user/all/richmenu/${id}` && init.method === 'POST') return new Response(null, { status: 200 });
    throw Error(`unexpected ${init.method} ${url}`);
  };
  const run = (overrides = {}) => worker({ token, image, fetcher, acquire, ...overrides });
  return { events, run };
}
const writes = events => events.filter(e => e.startsWith('POST '));

test('successful restoration checks state, journals all writes, verifies image before and after assignment', async () => {
  const h = harness(); assert.equal(await h.run(), 'RESTORED');
  assert.deepEqual(h.events, [
    'claim', 'GET api.line.me/v2/bot/info', 'GET api.line.me/v2/bot/user/all/richmenu', 'GET api.line.me/v2/bot/richmenu/list',
    'stage:creating', 'POST api.line.me/v2/bot/richmenu', 'stage:uploading', `POST api-data.line.me/v2/bot/richmenu/${id}/content`,
    `GET api-data.line.me/v2/bot/richmenu/${id}/content`, `GET api.line.me/v2/bot/richmenu/${id}`, 'stage:setting_default', 'GET api.line.me/v2/bot/richmenu/list',
    'GET api.line.me/v2/bot/user/all/richmenu', `POST api.line.me/v2/bot/user/all/richmenu/${id}`, 'GET api.line.me/v2/bot/user/all/richmenu',
    `GET api-data.line.me/v2/bot/richmenu/${id}/content`, `GET api.line.me/v2/bot/richmenu/${id}`, 'stage:completed',
  ]);
  assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE'); assert.equal(writes(h.events).length, 3);
});

test('bad token or image cannot claim the attempt or contact LINE', async () => {
  for (const overrides of [{ token: '' }, { image: Buffer.from('incorrect') }, { image: Buffer.alloc(image.length) }]) {
    const h = harness(); assert.equal(await h.run(overrides), 'CONFIGURATION_ERROR'); assert.deepEqual(h.events, []);
  }
});

test('durable lock failure and concurrent requests do not cause additional writes', async () => {
  const failed = harness({ lockFails: true }); assert.equal(await failed.run(), 'ATTEMPT_UNAVAILABLE'); assert.deepEqual(failed.events, ['claim']);
  const h = harness(); const results = await Promise.all([h.run(), h.run()]);
  assert.deepEqual(results.sort(), ['ATTEMPT_UNAVAILABLE', 'RESTORED']); assert.equal(writes(h.events).length, 3);
});

test('wrong OA or nonempty current state stops before the first LINE write', async () => {
  for (const opts of [{ wrongAccount: true }, { defaultInitiallySet: true }, { listNotEmpty: true }, { failStage: 'creating' }]) {
    const h = harness(opts); const code = await h.run();
    assert.notEqual(code, 'RESTORED'); assert.equal(writes(h.events).length, 0);
    assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE');
  }
});

test('uncertain create, invalid ID, upload failure, image mismatch, changed default/list, or journal failure never retries or assigns default', async () => {
  for (const opts of [{ throwWrite: true }, { badId: true }, { uploadFails: true }, { badImage: true }, { badMenu: true }, { defaultChanges: true }, { extraMenu: true }, { failStage: 'uploading' }, { failStage: 'setting_default' }]) {
    const h = harness(opts); assert.equal(await h.run(), 'PARTIAL_OR_UNCERTAIN');
    assert.equal(h.events.filter(e => e === 'POST api.line.me/v2/bot/richmenu').length, 1);
    assert.equal(h.events.filter(e => e === `POST api.line.me/v2/bot/user/all/richmenu/${id}`).length, 0);
    assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE');
  }
});

test('failed final verification reports uncertain rather than success and never retries', async () => {
  const h = harness({ badFinal: true }); assert.equal(await h.run(), 'PARTIAL_OR_UNCERTAIN');
  assert.equal(h.events.filter(e => e === `POST api.line.me/v2/bot/user/all/richmenu/${id}`).length, 1);
  assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE');
});

function routeHarness({ admin = true, env = {}, code = 'RESTORED' } = {}) {
  let calls = 0;
  const globals = { process: { env: { VERCEL_ENV: 'production', LINE_CHANNEL_ACCESS_TOKEN: token, ...env }, cwd: () => process.cwd() }, fetch: async () => { throw Error('unexpected network'); } };
  const route = loadTs({
    '@/lib/server-auth': { requireAdmin: async () => admin ? null : Response.json({error:'forbidden'}, {status:403}) },
    '@/lib/server-firestore': { serverFirestore: () => { throw Error('unexpected database'); } },
    '@/lib/line-recovery/restore': { restore: async () => { calls++; return code; } },
  }, globals)('app/api/line/restore-rich-menu/route.ts');
  const req = (body = '{"confirmation":"@930xzcyi"}', headers = {'content-type': 'application/json'}) => new Request('https://site.example/api/line/restore-rich-menu', { method:'POST', body, headers });
  return { post: route.POST, req, calls: () => calls };
}

test('route enforces admin, production, exact confirmation and bounded JSON before worker', async () => {
  let h = routeHarness({admin:false}); let response = await h.post(h.req()); assert.equal(response.status,403); assert.equal(h.calls(),0); assert.equal(response.headers.get('cache-control'),'no-store, private');
  h = routeHarness({env:{VERCEL_ENV:'preview'}}); response = await h.post(h.req()); assert.equal(response.status,503); assert.equal(h.calls(),0);
  h = routeHarness();
  for (const body of ['{}', '{"confirmation":"@other"}', '{"confirmation":"@930xzcyi","url":"x"}', ' '.repeat(100000), '{"confirmation":"@930xzcyi" }']) {
    response = await h.post(h.req(body)); assert.equal(response.status,400); assert.equal(h.calls(),0);
  }
  response = await h.post(h.req('{"confirmation":"@930xzcyi"}', {'content-type':'text/plain'})); assert.equal(response.status,400); assert.equal(h.calls(),0);
  response = await h.post(h.req()); assert.equal(response.status,200); assert.deepEqual(await response.json(), {success:true,code:'RESTORED'}); assert.equal(h.calls(),1);
});

test('route returns only stable failure codes', async () => {
  const h = routeHarness({code:'PARTIAL_OR_UNCERTAIN'}); const response = await h.post(h.req());
  const body = await response.text(); assert.equal(response.status,409); assert.deepEqual(JSON.parse(body), {success:false,code:'PARTIAL_OR_UNCERTAIN'}); assert.ok(!body.includes(token));
});

test('actual authentication allows only verified ADMIN for recovery', async () => {
  for (const [role, verified, expected] of [['ADMIN', true, null], ['AGENT', true, 403], ['ADMIN', false, 403], ['USER', true, 403]]) {
    let requests = 0;
    const auth = loadTs({ '@/lib/api-response': { jsonResponse: (value, options) => Response.json(value, options) } }, {
      fetch: async url => {
        requests++;
        if (String(url).includes('identitytoolkit')) return Response.json({ users: [{ localId: 'uid', emailVerified: verified }] });
        return Response.json({ fields: { role: { stringValue: role } } });
      },
    })('lib/server-auth.ts');
    const denied = await auth.requireAdmin(new Request('https://site.example/api/line/restore-rich-menu', {headers:{Authorization:'Bearer private-session'}}));
    assert.equal(denied?.status ?? null, expected);
    assert.equal(requests, verified ? 2 : 1);
  }
});


test('changed action in stored menu after assignment prevents reported success', async () => {
  const h = harness({ badFinalMenu: true });
  assert.equal(await h.run(), 'PARTIAL_OR_UNCERTAIN');
  assert.equal(h.events.filter(e => e === `POST api.line.me/v2/bot/user/all/richmenu/${id}`).length, 1);
  assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE');
});

test('authentication provider exception cannot leak the session in response or logs', async () => {
  const secret = 'sensitive-fake-token-unique';
  const logs = [];
  const auth = loadTs({ '@/lib/api-response': { jsonResponse: (value, options) => Response.json(value, options) } }, {
    console: { error: (...args) => logs.push(args.join(' ')), log: (...args) => logs.push(args.join(' ')) },
    fetch: async () => { throw Error(`upstream error with ${secret}`); },
  })('lib/server-auth.ts');
  const denied = await auth.requireAdmin(new Request('https://site.example/api/line/restore-rich-menu', { headers: { Authorization: `Bearer ${secret}` } }));
  assert.equal(denied.status, 503);
  assert.equal((await denied.text()).includes(secret), false);
  assert.equal(logs.join('\n').includes(secret), false);
});
