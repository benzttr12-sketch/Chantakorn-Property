const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const moduleScope = { exports: {} };
const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '..', 'src/lib/parcel-boundaries.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
vm.runInNewContext(source, {
  module: moduleScope, exports: moduleScope.exports, TextEncoder,
  require(name) { throw Error(`Unexpected runtime import: ${name}`); },
});
const boundaries = moduleScope.exports;
const local = value => JSON.parse(JSON.stringify(value));

// Synthetic test coordinates exercise GeoJSON structure, not an official cadastral claim.
const outline = [
  [100.1, 7.1], [100.2, 7.1], [100.2, 7.2], [100.1, 7.2], [100.1, 7.1],
];
const hole = [
  [100.12, 7.12], [100.12, 7.14], [100.14, 7.14], [100.14, 7.12], [100.12, 7.12],
];
const polygon = (coordinates = [outline]) => ({ type: 'Polygon', coordinates });
const feature = (geometry = polygon(), properties = {}) => ({ type: 'Feature', geometry, properties });
const collection = features => ({ type: 'FeatureCollection', features });

test('normalizes Polygon, Feature and FeatureCollection without inventing provenance', () => {
  for (const input of [polygon(), feature(), collection([feature()])]) {
    const result = boundaries.validateParcelBoundaries(input);
    assert.equal(result.type, 'FeatureCollection');
    assert.equal(result.features.length, 1);
    assert.deepEqual(local(result.features[0].properties), { label: 'แปลง 1', origin: 'imported' });
    assert.deepEqual(local(result.features[0].geometry), polygon());
  }
  assert.deepEqual(local(boundaries.validateParcelBoundaries(boundaries.EMPTY_PARCEL_BOUNDARIES)), collection([]));
  assert.equal(boundaries.getParcelBoundaryBounds(boundaries.EMPTY_PARCEL_BOUNDARIES), null);
});

test('retains MultiPolygon parts and interior holes and returns Leaflet latitude/longitude bounds', () => {
  const other = [[101, 8], [101.1, 8], [101.1, 8.1], [101, 8.1], [101, 8]];
  const multi = { type: 'MultiPolygon', coordinates: [[outline, hole], [other]] };
  const result = boundaries.validateParcelBoundaries(feature(multi, { name: '  สองรูปแปลงทดสอบ  ' }));
  assert.deepEqual(local(result.features[0].geometry), multi);
  assert.equal(result.features[0].properties.label, 'สองรูปแปลงทดสอบ');
  assert.deepEqual(local(boundaries.getParcelBoundaryBounds(result)), [[7.1, 100.1], [8.1, 101.1]]);
});

test('drops arbitrary metadata, bbox and foreign members, retaining labels strictly as plain text', () => {
  const input = feature(polygon(), {
    label: '<img src=x onerror=alert(1)>', name: 'fallback', origin: 'official-verified',
    privateToken: 'private-fixture-metadata', popupHtml: '<script>fixture</script>', owner: { email: 'fixture@example.test' },
  });
  input.id = 'foreign-id';
  input.bbox = [0, 0, 1, 1];
  input.geometry.bbox = [0, 0, 1, 1];
  const result = boundaries.validateParcelBoundaries(input);
  assert.deepEqual(local(result.features[0].properties), { label: '<img src=x onerror=alert(1)>', origin: 'imported' });
  assert.deepEqual(Object.keys(result.features[0]).sort(), ['geometry', 'properties', 'type']);
  assert.deepEqual(Object.keys(result.features[0].geometry).sort(), ['coordinates', 'type']);
  assert.equal(JSON.stringify(result).includes('private-fixture-metadata'), false);
  assert.equal(JSON.stringify(result).includes('popupHtml'), false);
  const fallback = boundaries.validateParcelBoundaries(feature(polygon(), { label: 'x'.repeat(101), name: '\u0000', chanoteNo: '123' }));
  assert.equal(fallback.features[0].properties.label, '123');
});

test('supports WGS84 CRS declarations but refuses projected or unknown coordinate systems', () => {
  for (const name of ['EPSG:4326', 'urn:ogc:def:crs:EPSG::4326']) {
    const input = collection([feature()]);
    input.crs = { type: 'name', properties: { name } };
    assert.equal(boundaries.validateParcelBoundaries(input).features.length, 1);
  }
  for (const crs of [null, {}, { type: 'name', properties: { name: 'EPSG:3857' } }, { type: 'link', properties: { href: 'https://example.test/crs' } }]) {
    const input = feature();
    input.geometry.crs = crs;
    assert.throws(() => boundaries.validateParcelBoundaries(input), boundaries.ParcelBoundaryValidationError);
  }
});

test('rejects nonpolygon, missing and malformed geometry without exposing input content', () => {
  const invalid = [
    null, undefined, [], 'not geojson', {},
    { type: 'FeatureCollection', features: null }, collection([polygon()]),
    feature(null), feature({ type: 'Point', coordinates: [100, 7] }),
    feature({ type: 'LineString', coordinates: outline }),
    feature({ type: 'GeometryCollection', geometries: [polygon()] }),
    polygon([]), { type: 'MultiPolygon', coordinates: [] }, polygon('private-fixture-content'),
  ];
  for (const input of invalid) {
    assert.throws(() => boundaries.validateParcelBoundaries(input), error => {
      assert.equal(error.name, 'ParcelBoundaryValidationError');
      assert.equal(error.message.includes('private-fixture-content'), false);
      return true;
    });
  }
  const cyclic = { type: 'FeatureCollection', features: [] };
  cyclic.self = cyclic;
  assert.throws(() => boundaries.validateParcelBoundaries(cyclic), boundaries.ParcelBoundaryValidationError);
});

test('rejects nonfinite, string and out-of-range coordinates and normalizes optional elevation', () => {
  for (const position of [[181, 7], [-181, 7], [100, 91], [100, -91], [NaN, 7], [100, Infinity], ['100', 7], [100], [100, 7, 0, 4], [100, 7, NaN]]) {
    const invalidRing = outline.map(point => [...point]);
    invalidRing[1] = position;
    assert.throws(() => boundaries.validateParcelBoundaries(polygon([invalidRing])), boundaries.ParcelBoundaryValidationError);
  }
  const elevated = outline.map(point => [...point, 20]);
  assert.deepEqual(local(boundaries.validateParcelBoundaries(polygon([elevated])).features[0].geometry), polygon());
});

test('rejects unclosed, short and zero-area rings including malformed holes', () => {
  const invalidRings = [
    outline.slice(0, -1), [[100, 7], [101, 7], [100, 7]],
    [[100, 7], [101, 7], [102, 7], [100, 7]],
    [[100, 7], [100, 7], [100, 7], [100, 7]],
    [[100, 7], [101, 8], [100, 8], [101, 7], [100, 7]],
  ];
  for (const ring of invalidRings) {
    assert.throws(() => boundaries.validateParcelBoundaries(polygon([ring])), boundaries.ParcelBoundaryValidationError);
    assert.throws(() => boundaries.validateParcelBoundaries(polygon([outline, ring])), boundaries.ParcelBoundaryValidationError);
  }
});

test('limits total feature count, total coordinates and UTF-8 storage size', () => {
  assert.equal(boundaries.validateParcelBoundaries(collection(Array.from({ length: 500 }, () => feature()))).features.length, 500);
  assert.throws(() => boundaries.validateParcelBoundaries(collection(Array.from({ length: 501 }, () => feature()))), /500/);
  const crowded = Array.from({ length: 10_000 }, (_, index) => [100 + Math.cos(index * 2 * Math.PI / 10_000) * 0.01, 7 + Math.sin(index * 2 * Math.PI / 10_000) * 0.01]);
  crowded.push([...crowded[0]]);
  assert.throws(() => boundaries.validateParcelBoundaries(polygon([crowded])), /10,000/);
  assert.throws(() => boundaries.validateParcelBoundaries(feature(polygon(), { discarded: 'ก'.repeat(180_000) })), /512 KB/);
});

test('file parsing only accepts valid JSON or GeoJSON with bounded size', () => {
  for (const fileName of ['parcels.geojson', 'parcels.JSON', 'parcels.GeoJSON']) {
    assert.equal(boundaries.parseParcelBoundaryFile(JSON.stringify(feature()), fileName).features.length, 1);
  }
  for (const fileName of ['parcels.kml', 'parcels.zip', 'parcels.geojson.exe', 'parcels']) {
    assert.throws(() => boundaries.parseParcelBoundaryFile(JSON.stringify(feature()), fileName), /GeoJSON/);
  }
  assert.throws(() => boundaries.parseParcelBoundaryFile('{private-fixture-content}', 'parcels.geojson'), error => {
    assert.equal(error.message.includes('private-fixture-content'), false);
    return error.name === 'ParcelBoundaryValidationError';
  });
  assert.throws(() => boundaries.parseParcelBoundaryFile(' '.repeat(512 * 1024 + 1), 'parcels.geojson'), /512 KB/);
});

test('explicit manual drawings close once without mutating vertices and stay marked as sketches', () => {
  const points = outline.slice(0, -1).map(point => [...point]);
  const before = structuredClone(points);
  const result = boundaries.createSketchBoundary(points, 'แปลงที่วาดเอง');
  assert.deepEqual(points, before);
  assert.deepEqual(local(result.features[0].geometry), polygon());
  assert.deepEqual(local(result.features[0].properties), { label: 'แปลงที่วาดเอง', origin: 'sketch' });
  assert.equal(boundaries.createSketchBoundary(outline, 'ปิดวงแล้ว').features[0].geometry.coordinates[0].length, outline.length);
  assert.throws(() => boundaries.createSketchBoundary([[100, 7], [101, 8]], 'ไม่ครบ'), boundaries.ParcelBoundaryValidationError);
});

test('the attributed DOL excerpt contains 100 valid WGS84 parcels in its stated Phetchabun coverage', () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/dol-nam-ron-parcels.geojson'), 'utf8'));
  const collection = boundaries.validateParcelBoundaries(source);
  assert.equal(collection.features.length, 100);
  const [[south, west], [north, east]] = boundaries.getParcelBoundaryBounds(collection);
  assert.ok(south > 16.30 && north < 16.33);
  assert.ok(west > 101.15 && east < 101.19);
  for (const feature of collection.features) {
    assert.equal(feature.properties.origin, 'imported');
    assert.match(feature.properties.label, /^แปลงข้อมูลเปิด \d+$/);
    assert.deepEqual(Object.keys(feature.properties).sort(), ['label', 'origin']);
  }
});
