const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const image = fs.readFileSync(path.join(__dirname, '../src/lib/line-recovery/original-rich-menu.jpg'));
const original = require('../src/lib/line-recovery/menu.json');
const oldId = `richmenu-${'a'.repeat(32)}`, newId = `richmenu-${'b'.repeat(32)}`;
const next = JSON.parse(JSON.stringify(original));
next.areas[1].action = {type:'message',label:'ฝากขายทรัพย์',text:'บริการฝากขาย'};
const worker = loadTs()('lib/line-recovery/transition.ts').transition;
function harness(options = {}) {
  let claimed = false, defaults = 0, lists = 0, oldReads = 0, newReads = 0;
  const events = [];
  const acquire = async () => { events.push('claim'); if (claimed || options.lockFail) throw Error(); claimed = true; return {stage: async stage => {events.push(`stage:${stage}`); if (stage === options.failStage) throw Error();}}; };
  const fetcher = async (url, init) => {
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Authorization, 'Bearer private');
    const u = new URL(url), p = u.pathname; events.push(`${init.method} ${u.host}${p}`);
    if (init.method === 'POST' && options.failWrite) throw Error('private');
    if (p === '/v2/bot/info') return Response.json({basicId:options.wrongAccount ? '@other' : '@930xzcyi'});
    if (p === '/v2/bot/user/all/richmenu' && init.method === 'GET') { defaults++; return options.noDefault && defaults === 1 ? new Response(null,{status:404}) : Response.json({richMenuId: defaults === 1 ? oldId : defaults === 2 ? (options.changedDefault ? newId : oldId) : (options.badFinal ? oldId : newId)}); }
    if (p === '/v2/bot/richmenu/list') { lists++; return Response.json({richmenus: (lists === 1 ? (options.extraInitial ? [oldId,newId] : [oldId]) : (options.extraLater ? [oldId,newId,`richmenu-${'c'.repeat(32)}`] : [oldId,newId])).map(richMenuId => ({richMenuId}))}); }
    if (p === '/v2/bot/richmenu' && init.method === 'POST') { assert.deepEqual(JSON.parse(init.body), next); return Response.json({richMenuId:options.sameId ? oldId : newId}); }
    if (p === `/v2/bot/richmenu/${newId}/content` && init.method === 'POST') {assert.deepEqual(init.body,image); return options.uploadFail ? new Response(null,{status:500}) : new Response(null,{status:200});}
    if (p.endsWith('/content') && init.method === 'GET') return new Response(options.badImage && p.includes(oldId) ? Buffer.from('bad') : image);
    if (p === `/v2/bot/richmenu/${oldId}`) {oldReads++; const value = JSON.parse(JSON.stringify(original)); if (options.badOriginal || options.oldChanges && oldReads === 2) value.areas[0].action.text = 'changed'; return Response.json({richMenuId:oldId,...value,...(options.extraMetadata ? {providerMetadata: 'ignored'} : {})});}
    if (p === `/v2/bot/richmenu/${newId}`) {newReads++; const value = JSON.parse(JSON.stringify(next)); if (options.badNew || options.badFinalMenu && newReads === 2) value.areas[0].action.text = 'changed'; return Response.json({richMenuId:newId,...value,...(options.extraMetadata ? {providerMetadata: 'ignored'} : {})});}
    if (p === `/v2/bot/user/all/richmenu/${newId}` && init.method === 'POST') return new Response(null,{status:200});
    throw Error(`unexpected ${init.method} ${url}`);
  };
  return {events, run: (overrides = {}) => worker({token:'private',image,fetcher,acquire,...overrides})};
}
const posts = events => events.filter(e => e.startsWith('POST '));
test('transition preserves all but B, verifies before and after and permanently claims one attempt', async () => {
  const h = harness(); assert.equal(await h.run(), 'TRANSITIONED');
  assert.equal(posts(h.events).length,3);
  assert.equal(h.events.at(-1),'stage:completed');
  assert.equal(await h.run(),'ATTEMPT_UNAVAILABLE');
});
test('invalid account, configuration, original menu, image, or conflicting state never writes', async () => {
  for (const opts of [{wrongAccount:true},{noDefault:true},{extraInitial:true},{badOriginal:true},{badImage:true},{lockFail:true},{failStage:'creating'}]) {
    const h=harness(opts); assert.notEqual(await h.run(),'TRANSITIONED'); assert.equal(posts(h.events).length,0,JSON.stringify(opts));
  }
  const h=harness(); assert.equal(await h.run({image:Buffer.from('invalid')}),'CONFIGURATION_ERROR'); assert.deepEqual(h.events,[]);
});
test('uncertain writes, changed state, and verification failures stop without retry', async () => {
  for (const opts of [{failWrite:true},{sameId:true},{uploadFail:true},{badNew:true},{extraLater:true},{oldChanges:true},{changedDefault:true},{badFinal:true},{badFinalMenu:true},{failStage:'uploading'},{failStage:'setting_default'}]) {
    const h=harness(opts); assert.equal(await h.run(),'PARTIAL_OR_UNCERTAIN',JSON.stringify(opts));
    const count=posts(h.events).length; assert.equal(await h.run(),'ATTEMPT_UNAVAILABLE'); assert.equal(posts(h.events).length,count);
    if (!opts.badFinal && !opts.badFinalMenu) assert.equal(h.events.filter(e=>e===`POST api.line.me/v2/bot/user/all/richmenu/${newId}`).length,0,JSON.stringify(opts));
  }
});
test('route stays disabled, denies non-admin, and validates exact confirmation when enabled', async () => {
  for (const [admin, enabled, body, expected, calls] of [[false,true,'{"confirmation":"@930xzcyi"}',403,0],[true,false,'{"confirmation":"@930xzcyi"}',503,0],[true,true,'{}',400,0],[true,true,'{"confirmation":"@930xzcyi"}',200,1]]) {
    let count=0;
    const route=loadTs({ '@/lib/server-auth':{requireAdmin:async()=>admin?null:Response.json({error:'forbidden'},{status:403})}, '@/lib/server-firestore':{serverFirestore:()=>{throw Error('unexpected');}}, '@/lib/line-recovery/transition-enabled':{TRANSITION_ENABLED:enabled}, '@/lib/line-recovery/transition':{transition:async()=>{count++;return 'TRANSITIONED';}} }, {fetch:async()=>{throw Error('unexpected network');},process:{env:{VERCEL_ENV:'production',LINE_CHANNEL_ACCESS_TOKEN:'private'},cwd:()=>process.cwd()}})('app/api/line/transition-rich-menu/route.ts');
    const response=await route.POST(new Request('https://example.test/api',{method:'POST',headers:{'content-type':'application/json'},body}));
    assert.equal(response.status,expected); assert.equal(count,calls); assert.equal(response.headers.get('cache-control'),'no-store, private');
  }
});
test('enabled route claims a distinct durable marker before the worker can write', async () => {
  const calls=[];
  const marker={create:async value=>{calls.push(['create',value.stage]);},update:async value=>{calls.push(['update',value.stage]);}};
  const route=loadTs({
    '@/lib/server-auth':{requireAdmin:async()=>null},
    '@/lib/server-firestore':{serverFirestore:()=>({collection:name=>{calls.push(['collection',name]); return {doc:id=>{calls.push(['doc',id]); return marker;}};}})},
    '@/lib/line-recovery/transition-enabled':{TRANSITION_ENABLED:true},
    '@/lib/line-recovery/transition':{transition:async ({acquire})=>{const journal=await acquire(); await journal.stage('creating'); return 'TRANSITIONED';}},
  }, {fetch:async()=>{throw Error('unexpected');},process:{env:{VERCEL_ENV:'production',LINE_CHANNEL_ACCESS_TOKEN:'private'},cwd:()=>process.cwd()}})('app/api/line/transition-rich-menu/route.ts');
  const response=await route.POST(new Request('https://example.test/api',{method:'POST',headers:{'content-type':'application/json'},body:'{"confirmation":"@930xzcyi"}'}));
  assert.equal(response.status,200);
  assert.deepEqual(calls,[['collection','server_line_recovery_once'],['doc','transition_930xzcyi_v2'],['create','claimed'],['update','creating']]);
});

test('unexpected provider top-level fields stop before a mutation and cannot be retried', async () => {
  const h = harness({extraMetadata:true}); assert.equal(await h.run(), 'STATE_CHANGED_OR_UNAVAILABLE'); assert.equal(posts(h.events).length, 0); assert.equal(await h.run(), 'ATTEMPT_UNAVAILABLE');
});
