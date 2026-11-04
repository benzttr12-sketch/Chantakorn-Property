const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const load = require('./load-ts.cjs');
const library = () => load()('lib/songkhla-land.ts');
const query = { map1: '5022', map2: '1', map3: '0000', map4: '003', scale: '5000', landNo: '422' };
const version = '0123456789abcdef';
const index = { schemaVersion: 1, version, rowCount: 3, sheets: { '5022-1-0000': 3 }, scales: ['5000'] };
const sheet = () => ({ schemaVersion: 1, version, key: '5022-1-0000', groups: [{ reference: ['5022','1','0000'],
  rows: [['003','5000','422',450,2], ['003','5000','422',900,3], ['005','5000','110',250,4]] }] });

test('exact lookup preserves every conflicting price, raw zero-padded identifiers and source line', () => {
  const { decodeLandSheet, matchingLandRecords } = library();
  const decoded = decodeLandSheet(sheet(), '5022-1-0000', index);
  assert.equal(decoded.length, 3);
  const matches = matchingLandRecords(decoded, query);
  assert.deepEqual(Array.from(matches, row => row.price), [450,900]);
  assert.deepEqual(Array.from(matches, row => row.sourceRow), [2,3]);
  assert.equal(matches[0].map4, '003');
  assert.equal(matchingLandRecords(decoded, { ...query, landNo: '42' }).length, 0);
  assert.equal(matchingLandRecords(decoded, { ...query, map1: '5123' }).length, 0);
  assert.equal(matchingLandRecords(decoded, { ...query, map4: '005' }).length, 0);
});

test('Thai digits and missing leading zeros normalize for lookup without accepting paths or scripts', () => {
  const { normalizeLandQuery, landAssetPath } = library();
  const normalized = normalizeLandQuery({ ...query, map3: '0', landNo: '๔๒๒', map4: '3' });
  assert.equal(normalized.map3, '0000'); assert.equal(normalized.landNo, '422');
  assert.equal(landAssetPath(index, '5022-1-0000', '/Chantakorn-Property/'), '/Chantakorn-Property/data/songkhla-land/0123456789abcdef/5022-1-0000.json');
  for (const value of ['../file','-1','1e3','1.5','<script>','999999999']) assert.throws(() => normalizeLandQuery({ ...query, landNo: value }));
  assert.throws(() => landAssetPath(index, '../settings'));
  assert.throws(() => landAssetPath({ ...index, version: '../escape' }, '5022-1-0000'));
  assert.throws(() => landAssetPath(index, '5022-1-0000', '//other-host'));
});

test('mismatched snapshots, truncated rows and malicious or malformed records are rejected', () => {
  const { decodeLandSheet } = library();
  for (const mutate of [value => { value.version = 'old'; }, value => { value.key = '5123-3-1111'; },
    value => { value.groups[0].rows.pop(); }, value => { value.groups[0].rows[0][3] = -1; },
    value => { value.groups[0].rows[0][4] = 0; }, value => { value.groups[0].reference[2] = '../file'; }]) {
    const value = sheet(); mutate(value);
    assert.throws(() => decodeLandSheet(value, '5022-1-0000', index));
  }
});

test('loading is a credential-free, abortable request for one sheet and refuses failed or malformed responses', async () => {
  const { loadLandSheet } = library();
  const signal = new AbortController().signal;
  let calls = 0;
  const records = await loadLandSheet(index, '5022-1-0000', signal, async (url, options) => {
    calls++; assert.equal(url, `/data/songkhla-land/${version}/5022-1-0000.json`);
    assert.equal(options.signal, signal); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    return Response.json(sheet());
  });
  assert.equal(calls, 1); assert.equal(records.length, 3);
  await assert.rejects(loadLandSheet(index, '5022-1-0000', signal, async () => new Response('unavailable', { status: 503 })));
  await assert.rejects(loadLandSheet(index, '5022-1-0000', signal, async () => new Response('<html>not data</html>')));
  await assert.rejects(loadLandSheet(index, '5022-1-0000', signal, async () => new Response('', { headers: { 'content-length': '3000000' } })));
});

test('area calculations handle rai/ngan/fractional square wah and refuse invalid or unsafe amounts', () => {
  const { calculateLandEstimate } = library();
  let result = calculateLandEstimate(450, { rai:'1',ngan:'1',wah:'50' });
  assert.equal(result.squareWah, 550); assert.equal(result.amount, 247500);
  result = calculateLandEstimate(3250, { rai:'0',ngan:'0',wah:'10.25' });
  assert.equal(result.amount, 33312.5);
  for (const area of [{rai:'0',ngan:'0',wah:'0'}, {rai:'1',ngan:'4',wah:'0'}, {rai:'1.5',ngan:'0',wah:'0'}, {rai:'1',ngan:'0',wah:'100'}, {rai:'1',ngan:'0',wah:'-1'}])
    assert.throws(() => calculateLandEstimate(450, area));
  assert.throws(() => calculateLandEstimate(400000, { rai:'999999',ngan:'0',wah:'0' }));
});

test('CSV builder preserves conflicting duplicates, checks source identity and never overwrites a version', async t => {
  const { buildLandAssets } = await import('../scripts/build-songkhla-land.mjs');
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, 'chantakorn-land-test-'));
  t.after(() => {
    const actual = fs.realpathSync(root);
    assert.equal(path.dirname(actual), base); assert.ok(path.basename(actual).startsWith('chantakorn-land-test-'));
    fs.rmSync(actual, { recursive: true, force: true });
  });
  const csv = 'UTMMAP1,UTMMAP2,UTMMAP3,UTMMAP4,UTMSCALE,LAND_NO,EVAPRICE\n5022,1,0000,003,5000,422,450.00000000\n5022,1,0000,003,5000,422,900.00000000\n';
  const input = path.join(root,'source.csv'); fs.writeFileSync(input,csv);
  const source = {sha256:crypto.createHash('sha256').update(csv).digest('hex')};
  const output = path.join(root,'version');
  const result = await buildLandAssets({input,output,source});
  assert.equal(result.index.rowCount,2); assert.equal(result.index.duplicateRows,1); assert.equal(result.index.conflictingKeys,1);
  const value = JSON.parse(fs.readFileSync(path.join(output,'5022-1-0000.json'),'utf8'));
  assert.equal(value.groups[0].rows[0][0],'003'); assert.equal(value.groups[0].rows[1][3],900);
  await assert.rejects(buildLandAssets({input,output,source}));
  await assert.rejects(buildLandAssets({input,output:path.join(root,'bad'),source:{sha256:'0'.repeat(64)}}));
  assert.equal(fs.existsSync(path.join(root,'bad')),false);
});

test('official catalog check fails when a newer file or metadata update is published', async () => {
  const { checkPublishedSource } = await import('../scripts/build-songkhla-land.mjs');
  const source = require('../src/data/songkhla-land-source.json');
  const record = {url:source.downloadUrl,hash:source.md5,size:source.bytes,resource_last_updated_date:source.sourceUpdatedAt,last_modified:source.fileModifiedAt+'T03:55:52'};
  assert.equal(await checkPublishedSource(source, async () => Response.json({success:true,result:record})),true);
  for (const update of [{hash:'different'},{size:1},{resource_last_updated_date:'2027-01-01'}])
    await assert.rejects(checkPublishedSource(source,async () => Response.json({success:true,result:{...record,...update}})));
});

test('all shipped sheet files match the pinned source integrity manifest and total inventory', () => {
  const generated = require('../src/data/songkhla-land-index.json');
  const integrity = require('../docs/data/songkhla-land-integrity.json');
  const folder = path.resolve(__dirname,'../public/data/songkhla-land',generated.version);
  let rows = 0;
  for (const [key,count] of Object.entries(generated.sheets)) {
    const data = fs.readFileSync(path.join(folder,key+'.json'));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),integrity.checksums[key],key);
    assert.ok(data.length<=2_097_152);
    const sheet = JSON.parse(data);
    assert.equal(sheet.groups.reduce((sum,group)=>sum+group.rows.length,0),count,key);
    rows+=count;
  }
  assert.equal(rows,1127154); assert.equal(generated.rowCount,rows);
  assert.equal(Object.keys(generated.sheets).length,1646);
  assert.equal(generated.conflictingKeys,1468);
});

test('only fingerprinted land assets receive immutable caching; login, APIs and pages keep their policies', async () => {
  const { pathToFileURL } = require('node:url');
  const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');
  const {default: config} = await import(pathToFileURL(path.resolve(__dirname,'../next.config.mjs')));
  const rules = await config.headers();
  const headersAt = pathname => {
    const headers = new Map();
    for (const rule of rules) if (getPathMatch(rule.source)(pathname) !== false)
      for (const header of rule.headers) headers.set(header.key.toLowerCase(),header.value);
    return headers;
  };
  const asset = headersAt('/data/songkhla-land/0123456789abcdef/5022-1-0000.json');
  assert.equal(asset.get('cache-control'),'public, max-age=31536000, immutable');
  assert.equal(asset.get('cross-origin-opener-policy'),'same-origin-allow-popups');
  for (const route of ['/land-valuation','/login','/admin','/api/landsmaps','/__/auth/handler','/data/songkhla-land/current/5022-1-0000.json'])
    assert.equal(headersAt(route).has('cache-control'),false,route);
});
