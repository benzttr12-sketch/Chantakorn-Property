const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, imports = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Request, Response, URL, Date,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw Error(`Unexpected import: ${name}`);
    },
    ...globals,
  });
  return module.exports;
}

const core = load('src/lib/landsmaps.ts');
const input = overrides => ({ ...core.EMPTY_LAND_VALUATION, landSizeSqWah: 100, ...overrides });
const officialRate = overrides => input({
  appraisalPricePerSqWah: 9500,
  appraisalReference: 'รายการโฉนดที่ตรวจสอบจากกรมธนารักษ์',
  appraisalCheckedAt: '2024-02-29', appraisalPeriod: '2566–2569', ...overrides,
});

test('empty area cannot be silently replaced with a sample parcel or price', () => {
  for (const value of [undefined, null, {}, core.EMPTY_LAND_VALUATION, { landSizeSqWah: '80' }]) {
    assert.throws(() => core.validateLandValuation(value), core.LandValuationValidationError);
  }
  const validated = core.validateLandValuation({ landSizeSqWah: 80 });
  assert.equal(validated.chanoteNo, '');
  assert.equal(validated.province, '');
  assert.equal(validated.latitude, null);
  assert.equal(validated.appraisalPricePerSqWah, null);
  const result = core.calculateLandValuation(validated);
  assert.equal(result.totalAppraisalValue, null);
  assert.equal(result.standardTransferFee, null);
  assert.equal(result.askingPricePerSqWah, null);
});

test('fractional square wah remain precise across unit boundaries', () => {
  for (const size of [0, 0.001, 99.99, 100.125, 399.999, 400.001, 1126.5]) {
    const parts = core.sqWahToRaiNganWah(size);
    assert.ok(parts.ngan >= 0 && parts.ngan <= 3);
    assert.ok(parts.sqWah >= 0 && parts.sqWah < 100);
    assert.ok(Math.abs(core.raiNganWahToSqWah(parts.rai, parts.ngan, parts.sqWah) - size) < 1e-10);
    assert.equal(parts.totalSqMeters, size * 4);
  }
  for (const size of [-1, NaN, Infinity]) assert.throws(() => core.sqWahToRaiNganWah(size));
  assert.throws(() => core.raiNganWahToSqWah(1, 4, 0));
  assert.throws(() => core.raiNganWahToSqWah(0.5, 0, 0));
  assert.throws(() => core.raiNganWahToSqWah(0, 0, 100));
});

test('appraisal calculation requires entered rate and evidence, retaining zero asking price', () => {
  const valuation = core.calculateLandValuation(officialRate({ landSizeSqWah: 1126.5, askingPrice: 6100000 }));
  assert.equal(valuation.totalSqMeters, 4506);
  assert.equal(valuation.totalAppraisalValue, 10701750);
  assert.equal(valuation.standardTransferFee, 214035);
  assert.equal(valuation.askingPricePerSqWah, 5415);
  assert.equal(valuation.differencePercentage, -43);
  assert.equal(core.calculateLandValuation(officialRate({ askingPrice: 0 })).askingPricePerSqWah, 0);
  assert.equal(core.calculateLandValuation(officialRate({ askingPrice: 0 })).differencePercentage, -100);
  assert.equal('withholdingTax' in valuation, false);
  assert.equal('totalDepartmentOfLandsFees' in valuation, false);
});

test('rates cannot be presented as checked official appraisal without reference, date and period', () => {
  for (const field of ['appraisalReference', 'appraisalCheckedAt', 'appraisalPeriod']) {
    assert.throws(() => core.validateLandValuation(officialRate({ [field]: '' })), core.LandValuationValidationError);
  }
  for (const date of ['2024-02-30', '2023-02-29', '2000-00-10', '1999-01-01', '2999-12-31']) {
    assert.throws(() => core.validateLandValuation(officialRate({ appraisalCheckedAt: date })));
  }
  assert.equal(core.validateLandValuation(officialRate()).appraisalCheckedAt, '2024-02-29');
});

test('extreme valid positive inputs never produce infinite financial results', () => {
  const result = core.calculateLandValuation(officialRate({ landSizeSqWah: 1e-320, askingPrice: 1 }));
  assert.equal(result.askingPricePerSqWah, null);
  assert.equal(result.differencePercentage, null);
  assert.ok(Object.values(result).every(value => value === null || Number.isFinite(value)));
  assert.throws(() => core.validateLandValuation(officialRate({ landSizeSqWah: 1e9, appraisalPricePerSqWah: 1e9 })));
});

test('invalid numbers, one-sided coordinates and oversized text are rejected', () => {
  for (const value of [-1, 0, NaN, Infinity, 1e12]) {
    assert.throws(() => core.validateLandValuation(input({ landSizeSqWah: value })));
  }
  for (const value of [-1, 0, NaN, Infinity, '9500']) {
    assert.throws(() => core.validateLandValuation(officialRate({ appraisalPricePerSqWah: value })));
  }
  for (const value of [-1, NaN, Infinity, '0']) {
    assert.throws(() => core.validateLandValuation(input({ askingPrice: value })));
  }
  for (const coordinates of [
    { latitude: 7, longitude: null }, { latitude: null, longitude: 100 },
    { latitude: 91, longitude: 100 }, { latitude: 7, longitude: -181 },
  ]) assert.throws(() => core.validateLandValuation(input(coordinates)));
  assert.equal(core.validateLandValuation(input({ latitude: 0, longitude: 0 })).latitude, 0);
  assert.throws(() => core.validateLandValuation(input({ chanoteNo: 'a'.repeat(101) })));
  assert.throws(() => core.validateLandValuation(input({ province: '\u0000' })));
});

test('official service links use only established roots and coordinates link only to Google Maps', () => {
  assert.equal(core.buildLandsMapsUrl(), 'https://landsmaps.dol.go.th/');
  assert.equal(core.TREASURY_APPRAISAL_URL, 'https://assessprice.treasury.go.th/');
  assert.equal(core.buildGoogleMapsUrl(null, null), null);
  assert.equal(core.buildGoogleMapsUrl(0, 0), 'https://www.google.com/maps/search/?api=1&query=0,0');
  assert.equal(core.buildGoogleMapsUrl(91, 100), null);
});

test('asking-price comparison excludes rental, building, other locations and invalid prices or areas', () => {
  const listing = (price, land_size, overrides = {}) => ({
    property_type: 'land', status: 'sale', province: 'สงขลา', district: 'สิงหนคร', price, land_size, ...overrides,
  });
  const properties = [listing(1000000, 100), listing(2400000, 200), listing(9000000, 300),
    listing(1e9, 100, { property_type: 'house' }), listing(1e9, 100, { status: 'rent' }),
    listing(1e9, 100, { province: 'กรุงเทพมหานคร' }), listing(1e9, 100, { district: 'หาดใหญ่' }),
    listing(1e9, 0), listing(1e9, -1), listing(Infinity, 100), listing(-1, 100), listing(10000, NaN),
    listing(1e9, 100, { province: null }), listing(1e9, 100, { district: undefined }), null];
  const result = core.getAskingPriceComparables(properties, input({ province: 'สงขลา', district: 'สิงหนคร', landSizeSqWah: 80 }));
  assert.equal(result.count, 3);
  assert.equal(result.medianPricePerSqWah, 12000);
  assert.equal(result.estimatedTotal, 960000);
  const empty = core.getAskingPriceComparables(properties, input());
  assert.equal(empty.count, 0);
  assert.equal(empty.estimatedTotal, null);
  assert.equal(core.getAskingPriceComparables(properties.slice(0, 2), input({ province: 'สงขลา', district: 'สิงหนคร' })).medianPricePerSqWah, 11000);
});

function api() {
  return load('src/app/api/landsmaps/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/landsmaps': core,
  });
}

test('GET reports lookup-only capabilities without fabricated parcel data, even with legacy query params', async () => {
  const result = await (await api().GET(new Request('https://example.com/api/landsmaps?chanoteNo=12345'))).json();
  assert.equal(result.officialDataFetched, false);
  assert.equal(result.source, 'manual_official_lookup');
  assert.equal(result.capabilities.parcelApi, false);
  assert.equal('data' in result, false);
  assert.equal('chanoteNo' in result, false);
});

test('POST returns transparent manual calculation and rejects invalid JSON and missing evidence', async () => {
  const route = api();
  const request = body => new Request('https://example.com/api/landsmaps', { method: 'POST', body: JSON.stringify(body) });
  const response = await route.POST(request(officialRate({ chanoteNo: '67890', latitude: 7.1, longitude: 100.6 })));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.officialDataFetched, false);
  assert.equal(result.input.chanoteNo, '67890');
  assert.equal(result.data.totalAppraisalValue, 950000);
  assert.equal(result.links.landsmaps, 'https://landsmaps.dol.go.th/');
  assert.equal((await route.POST(request({}))).status, 400);
  assert.equal((await route.POST(request(officialRate({ appraisalReference: '' })))).status, 400);
  assert.equal((await route.POST(new Request('https://example.com/api/landsmaps', { method: 'POST', body: '{' }))).status, 400);
});

function store({ backend = 'firebase', user = { uid: 'staff-uid' }, saved = null, deny = false, ready = async () => {} } = {}) {
  const calls = [];
  const local = new Map();
  const authModel = { currentUser: user, authStateReady: async () => ready(authModel) };
  const module = load('src/lib/store/land-valuation-store.ts', {
    '@/lib/landsmaps': core, '@/lib/backend': { dataBackend: backend },
    '@/lib/firebase/client': { db: {}, auth: authModel },
    'firebase/firestore': {
      doc: (_database, collection, id) => ({ collection, id }),
      getDocFromServer: async reference => {
        calls.push({ operation: 'read', reference });
        if (deny) throw Error('permission-denied');
        return { exists: () => saved !== null, data: () => ({ input: saved }) };
      },
      setDoc: async (reference, value) => {
        calls.push({ operation: 'write', reference, value });
        if (deny) throw Error('permission-denied');
      },
    },
  }, { window: { localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) } } });
  return { ...module, calls, local };
}

test('private appraisal persistence uses staff-only settings and keeps source provenance', async () => {
  const persistence = store({ saved: officialRate() });
  const loaded = await persistence.loadLandValuation('property-123');
  assert.equal(loaded.appraisalPricePerSqWah, 9500);
  await persistence.saveLandValuation('property-123', officialRate());
  for (const call of persistence.calls) {
    assert.equal(call.reference.collection, 'settings');
    assert.equal(call.reference.id, 'land_valuation_property-123');
  }
  assert.equal(persistence.calls[1].value.officialDataFetched, false);
  assert.equal(persistence.calls[1].value.source, 'manual_official_lookup');
  assert.equal(persistence.calls[1].value.updated_by, 'staff-uid');
  assert.equal(persistence.local.size, 0);
});

test('no auth, invalid storage key and denied writes never fall back to local success', async () => {
  const anonymous = store({ user: null });
  await assert.rejects(anonymous.loadLandValuation('manual'));
  await assert.rejects(anonymous.saveLandValuation('manual', input()));
  assert.equal(anonymous.calls.length, 0);
  await assert.rejects(store().saveLandValuation('../properties', input()));
  const denied = store({ deny: true });
  await assert.rejects(denied.saveLandValuation('manual', input()), /permission-denied/);
  assert.equal(denied.local.size, 0);
  await assert.rejects(store({ backend: 'supabase' }).saveLandValuation('manual', input()));
});

test('a restoring Firebase session loads the existing record before permitting any database operation', async () => {
  let finishRestoring;
  const restoring = new Promise(resolve => { finishRestoring = resolve; });
  const saved = officialRate({ chanoteNo: 'restored-parcel', appraisalPricePerSqWah: 12000 });
  const persistence = store({ user: null, saved, ready: async authModel => {
    await restoring;
    authModel.currentUser = { uid: 'restored-staff' };
  } });
  const pendingLoad = persistence.loadLandValuation('property-123');
  assert.equal(persistence.calls.length, 0);
  finishRestoring();
  const existing = await pendingLoad;
  assert.equal(existing.chanoteNo, 'restored-parcel');
  assert.equal(existing.appraisalPricePerSqWah, 12000);
  assert.equal(persistence.calls.length, 1);
  assert.equal(persistence.calls[0].operation, 'read');
  assert.equal(persistence.local.size, 0);
  await persistence.saveLandValuation('property-123', existing);
  assert.equal(persistence.calls[1].value.input.chanoteNo, 'restored-parcel');
  assert.equal(persistence.calls[1].value.updated_by, 'restored-staff');
});

test('local backend persists explicitly in this browser and handles absent records', async () => {
  const local = store({ backend: 'local', user: null });
  assert.equal(await local.loadLandValuation('manual'), null);
  await local.saveLandValuation('manual', officialRate());
  assert.equal((await local.loadLandValuation('manual')).appraisalPricePerSqWah, 9500);
  assert.equal(local.calls.length, 0);
});
