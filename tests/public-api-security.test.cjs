const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');
const request = (body, path='test') => new Request(`https://example.com/api/${path}`, { method:'POST', body:JSON.stringify(body) });
test('maps resolver blocks substring domains, HTTP, credentials, ports and private redirect destinations before fetching them', async () => {
  const fetched=[];
  const load=loader({}, { fetch:async (url, options)=>{fetched.push(String(url)); assert.equal(options.redirect,'manual'); return new Response(null,{status:302,headers:{location:'https://127.0.0.1/admin'}});}});
  const api=load('app/api/resolve-maps/route.ts');
  for(const url of ['https://google.attacker.example/', 'https://evilgoo.gl/maps/place', 'http://maps.app.goo.gl/test', 'https://user:pass@google.com/maps/test', 'https://google.com:444/maps/test', 'https://google.com/url?target=private']) {
    assert.equal((await api.POST(request({url}))).status,400);
  }
  assert.equal(fetched.length,0);
  assert.equal((await api.POST(request({url:'https://maps.app.goo.gl/test'}))).status,400);
  assert.deepEqual(fetched,['https://maps.app.goo.gl/test']);
});
test('maps direct coordinates and allowed shortlink redirects keep their public contract', async () => {
  const fetched=[];
  const api=loader({}, {fetch:async url=>{fetched.push(String(url));return fetched.length === 1 ? new Response(null,{status:302,headers:{location:'https://www.google.com/maps/@7.21,100.56,16z'}}) : new Response('');}})('app/api/resolve-maps/route.ts');
  const direct=await (await api.POST(request({url:'7.21, 100.56'}))).json();
  assert.equal(direct.success,true); assert.equal(direct.lat,7.21); assert.equal(fetched.length,0);
  const resolved=await (await api.POST(request({url:'https://maps.app.goo.gl/test'}))).json();
  assert.equal(resolved.success,true); assert.equal(resolved.lng,100.56);
  assert.equal(fetched.length,2);
});
test('bounded JSON reader rejects streamed overflow, invalid JSON and invalid UTF8 without trusting length headers', async () => {
  const {readJsonBody}=loader()('lib/server-request.ts');
  assert.equal((await readJsonBody(new Request('https://example.com',{method:'POST',body:'x'.repeat(11),headers:{'Content-Length':'1'}}),10)).error.status,413);
  assert.equal((await readJsonBody(new Request('https://example.com',{method:'POST',body:'{' }),10)).error.status,400);
  assert.equal((await readJsonBody(new Request('https://example.com',{method:'POST',body:new Uint8Array([0xff])}),10)).error.status,400);
  assert.equal((await readJsonBody(request({a:1}),50)).data.a,1);
});
test('property templates reject anonymous and ordinary callers before parsing; staff retain bounded generation', async () => {
  for (const status of [401, 403]) {
    const api = loader({'@/lib/server-auth': {requireStaff: async () => new Response(null, {status})}})('app/api/property-description/route.ts');
    assert.equal((await api.POST({})).status, status);
  }
  const api = loader({'@/lib/server-auth': {requireStaff: async () => null}})('app/api/property-description/route.ts');
  assert.equal((await api.POST(request({propertyType:'house', title:'บ้านใหม่', price:2000000}))).status, 200);
  assert.equal((await api.POST(request({title:'x'.repeat(10000)}))).status, 400);
  assert.equal((await api.POST(request({title:'x'.repeat(40000)}))).status, 413);
});

test('property templates need no external service or shared database budget', async () => {
  let calls = 0;
  const load = loader({'@/lib/server-auth': {requireStaff: async () => null}}, {fetch: async () => {calls++; throw Error('Must not call');}});
  const api = load('app/api/property-description/route.ts');
  const response = await api.POST(request({propertyType:'house', price:2000000}));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, 'property-template');
  assert.ok(result.description.includes('2,000,000'));
  assert.equal(calls, 0);
});

test('unpublished catalog rows disappear on the next request without a stale server cache', async () => {
  let rows=[{id:'home',published:true,title:'Home',internal_notes:'private'}], reads=0;
  const api=loader({'@/lib/firestore-rest':{listFirestoreDocuments:async()=>{reads++;return rows;}}})('app/api/properties/route.ts');
  const req=new Request('https://example.com/api/properties');
  assert.equal((await (await api.GET(req)).json()).properties.length,1);
  rows=[];
  assert.equal((await (await api.GET(req)).json()).properties.length,0);
  assert.equal(reads,2);
});
