const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load-ts.cjs');

const coordinates = load()('lib/property-coordinates.ts');
const landmarks = load()('lib/nearby-landmarks.ts');
const mapsConfig = load()('lib/maps-config.ts');
const valid = {
  id: 'valid', title: 'Recorded property', slug: 'valid', description: '', property_type: 'house',
  status: 'sale', price: 1000000, district: 'หาดใหญ่', province: 'สงขลา',
  latitude: 7.0086, longitude: 100.4984, images: [], cover_image: '', features: [],
  bedrooms: 2, bathrooms: 1, parking: 1, land_size: 50, usable_area: 100,
};
const invalidLocations = [
  { latitude: 7.0084, longitude: 100.4705, coordinates_available: false },
  { latitude: undefined, longitude: 100.5 },
  { latitude: null, longitude: null },
  { latitude: '', longitude: 100.5 },
  { latitude: '  ', longitude: 100.5 },
  { latitude: 'invalid', longitude: 100.5 },
  { latitude: false, longitude: 100.5 },
  { latitude: Infinity, longitude: 100.5 },
  { latitude: 91, longitude: 100.5 },
  { latitude: 7, longitude: -181 },
  { latitude: 0, longitude: 0 },
];

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...node.children.flatMap(nodes)];
}

function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (Array.isArray(node) ? node : node.children).map(text).join('');
}

// Render the actual component tree and execute its handlers/effects without Google or network access.
function component(file, initialProps, overrides = {}, runEffects = false) {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let props = initialProps;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) hooks[index] = { deps, value: factory() };
      return hooks[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!runEffects) return;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const mocks = {
    react,
    'next/link': 'a',
    'next/image': 'img',
    'lucide-react': new Proxy({}, { get: (_target, name) => name }),
    '@/lib/property-coordinates': coordinates,
    '@/lib/nearby-landmarks': landmarks,
    '@/lib/maps-config': { ...mapsConfig, GOOGLE_MAPS_API_KEY: 'test-key' },
    '@/lib/utils': {
      formatPrice: String, formatThaiNumber: String, formatPropertyCode: String, formatLineUrl: String,
      getPropertyStatusBadge: () => ({ text: 'sale' }),
    },
    '@/components/properties/property-link': { propertyHref: property => `/properties/${property.id}` },
    ...overrides,
  };
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console, window: {},
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/components/')) return name;
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  function render(update) {
    if (update) props = { ...props, ...update };
    cursor = 0;
    effects = [];
    const output = module.exports.default(props);
    for (const node of nodes(output)) {
      if (typeof node.type === 'function' && node.type.name === 'MapCameraController') node.type(node.props);
    }
    effects.forEach(effect => effect());
    return output;
  }
  render();
  return { render };
}

function map(properties, options = {}) {
  const calls = { pans: [], zooms: [], selections: [], districts: [] };
  const camera = { panTo: value => calls.pans.push(value), getZoom: () => 12, setZoom: value => calls.zooms.push(value) };
  const app = component('src/components/properties/GooglePropertyMap.tsx', {
    properties, isFullScreen: true,
    onSelectProperty: value => calls.selections.push(value),
    onDistrictSelect: value => calls.districts.push(value),
    ...options,
  }, {
    '@vis.gl/react-google-maps': { APIProvider: 'APIProvider', Map: 'Map', AdvancedMarker: 'AdvancedMarker', InfoWindow: 'InfoWindow', useMap: () => camera },
    '@/lib/maps-config': { ...mapsConfig, GOOGLE_MAPS_API_KEY: options.embed ? '' : 'test-key' },
  }, true);
  return { ...app, calls };
}

function detail(property) {
  const calculations = [];
  const app = component('src/components/properties/PropertyDetail.tsx', { slug: property.slug, initialProperty: property }, {
    '@/lib/auth-helpers': { getStoredUser: () => null },
    '@/lib/store/properties-store': {},
    '@/lib/nearby-landmarks': { calculateNearbyLandmarks(...args) { calculations.push(args); return landmarks.calculateNearbyLandmarks(...args); } },
  });
  const output = app.render();
  const jsonLd = JSON.parse(nodes(output).find(node => node.type === 'script').props.dangerouslySetInnerHTML.__html);
  return { output, jsonLd, calculations };
}

test('recorded coordinate helper rejects unavailable and malformed locations without coercion or fallback', () => {
  for (const location of [null, undefined, {}, ...invalidLocations]) assert.equal(coordinates.getPropertyCoordinates(location), null, JSON.stringify(location));
  for (const location of [{ latitude: '7.2', longitude: '100.5' }, { latitude: 0, longitude: 100 }, { latitude: -90, longitude: 180 }]) {
    const result = coordinates.getPropertyCoordinates(location);
    assert.equal(result.lat, Number(location.latitude));
    assert.equal(result.lng, Number(location.longitude));
  }
});

test('public map renders only recorded pins and keeps every listing accessible', () => {
  const properties = [valid, ...invalidLocations.map((location, index) => ({ ...valid, ...location, id: `unavailable-${index}`, title: `Unavailable ${index}` }))];
  const app = map(properties);
  const output = app.render();
  const markers = nodes(output).filter(node => node.type === 'AdvancedMarker');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].props.position.lat, valid.latitude);
  assert.equal(markers[0].props.position.lng, valid.longitude);
  assert.match(text(output), /แสดงตำแหน่งทรัพย์ 1 จาก 12 รายการ/);
  for (const property of properties.slice(1)) assert.ok(nodes(output).some(node => node.type === 'a' && node.props.href === `/properties/${property.id}`));
  markers[0].props.onClick();
  const popup = nodes(app.render()).find(node => node.type === 'InfoWindow');
  assert.equal(popup.props.position.lat, valid.latitude);
  assert.equal(app.calls.selections[0], valid);
});

test('selecting an unavailable property never pans, opens a popup, or supplies an embed pin', () => {
  const unavailable = { ...valid, ...invalidLocations[0] };
  const app = map([unavailable], { selectedProperty: unavailable });
  const output = app.render();
  assert.equal(nodes(output).filter(node => node.type === 'AdvancedMarker' || node.type === 'InfoWindow').length, 0);
  assert.equal(app.calls.pans.length, 0);
  assert.match(text(output), /ยังไม่มีพิกัดทรัพย์ที่ใช้งานได้/);
  const embed = map([unavailable], { selectedProperty: unavailable, embed: true });
  const embeddedOutput = embed.render();
  const url = new URL(nodes(embeddedOutput).find(node => node.type === 'iframe').props.src);
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(url.searchParams.get('ll'), `${mapsConfig.DEFAULT_MAP_CENTER.lat},${mapsConfig.DEFAULT_MAP_CENTER.lng}`);
  const external = new URL(nodes(embeddedOutput).find(node => node.type === 'a' && node.props.title === 'เปิดดูใน Google Maps App').props.href);
  assert.equal(external.searchParams.has('q'), false);
});

test('valid numeric-string selection retains exact camera movement and popup; district jumps remain navigation', () => {
  const legacy = { ...valid, latitude: '7.0086', longitude: '100.4984' };
  const app = map([legacy], { selectedProperty: legacy });
  let output = app.render();
  assert.equal(app.calls.pans[0].lat, 7.0086);
  assert.equal(app.calls.pans[0].lng, 100.4984);
  assert.equal(app.calls.zooms[0], 15);
  assert.ok(nodes(output).some(node => node.type === 'InfoWindow'));
  const districtButton = nodes(output).find(node => node.type === 'button' && text(node) === 'สะเดา');
  districtButton.props.onClick();
  output = app.render();
  assert.equal(app.calls.districts[0], 'สะเดา');
  assert.equal(app.calls.pans.at(-1).lat, mapsConfig.SONGKHLA_DISTRICT_COORDS['สะเดา'].lat);
  const external = new URL(nodes(output).find(node => node.type === 'a' && node.props.title === 'เปิดดูใน Google Maps App').props.href);
  assert.equal(external.searchParams.has('q'), false);
  assert.equal(external.searchParams.get('ll'), `${mapsConfig.SONGKHLA_DISTRICT_COORDS['สะเดา'].lat},${mapsConfig.SONGKHLA_DISTRICT_COORDS['สะเดา'].lng}`);
});

test('unavailable detail pages omit exact map, structured geo, and travel calculations', () => {
  for (const location of invalidLocations) {
    const { output, jsonLd, calculations } = detail({ ...valid, ...location });
    assert.equal('geo' in jsonLd, false, JSON.stringify(location));
    assert.equal(calculations.length, 0);
    assert.equal(nodes(output).some(node => node.type === '@/components/properties/GooglePropertyMap'), false);
    assert.match(text(output), /ทรัพย์นี้ยังไม่มีพิกัดที่ใช้งานได้/);
    assert.doesNotMatch(text(output), /10-15 นาที|ขับรถ|คำนวณจากพิกัดจริง/);
  }
});

test('valid detail pages preserve recorded map and geo with explicitly approximate nearby estimates', () => {
  const { output, jsonLd, calculations } = detail({ ...valid, latitude: '7.0086', longitude: '100.4984' });
  assert.equal(jsonLd.geo.latitude, 7.0086);
  assert.equal(jsonLd.geo.longitude, 100.4984);
  assert.equal(calculations[0][0], 7.0086);
  assert.equal(calculations[0][1], 100.4984);
  assert.ok(nodes(output).some(node => node.type === '@/components/properties/GooglePropertyMap'));
  assert.match(text(output), /ระยะทางและเวลาโดยประมาณ/);
  assert.match(text(output), /ระยะทางตรงจากพิกัดทรัพย์/);
});

test('valid locations outside the landmark catalog never inherit fixed Hat Yai travel times', () => {
  const { output, jsonLd } = detail({ ...valid, latitude: 13.75, longitude: 100.5 });
  assert.ok(jsonLd.geo);
  assert.match(text(output), /ยังไม่มีข้อมูลสถานที่ใกล้เคียงในระยะที่แสดง/);
  assert.doesNotMatch(text(output), /10-15 นาที|Central Hatyai|HDY Airport|คำนวณอัตโนมัติ/);
});
