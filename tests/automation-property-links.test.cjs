const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const property = {
  id: 'ck-rp6nqm',
  title: 'ขายที่ดิน 447 ตร.ว. ใกล้มหาวิทยาลัย',
  slug: 'ขายที่ดิน-447-ตรวติดถนนคอนกรีด-ใกล้-มทักษิณสงขลา-จสงขลา-6377',
  description: 'ที่ดินติดถนนคอนกรีต',
  property_type: 'land',
  status: 'sale',
  price: 2500000,
  province: 'สงขลา',
  district: 'เมืองสงขลา',
  bedrooms: 0,
  bathrooms: 0,
  parking: 0,
  land_size: 447,
  usable_area: 0,
  features: ['ติดถนนคอนกรีต'],
  published: true,
};

function load(globals = {}) {
  return loader({}, globals)('lib/automation-engine.ts');
}

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function assertPropertyUrl(text, expectedUrl, message) {
  const propertyUrls = extractUrls(text).filter(url => new URL(url).pathname.split('/').includes('properties'));
  assert.deepEqual(propertyUrls, [expectedUrl], message);
}

test('social posts share a short property code for every channel that includes a property link', () => {
  const { generateLocalSocialPost } = load();
  for (const channel of ['facebook', 'line', 'instagram', 'english', 'chinese']) {
    const result = generateLocalSocialPost(property, channel);
    assertPropertyUrl(result.fullPost, 'https://chantakornproperty.com/properties/CK-RP6NQM', channel);
    assert.ok(result.fullPost.includes(property.title), channel);
    assert.ok(!result.fullPost.includes(property.slug), channel);
    assert.ok(!result.fullPost.includes(encodeURIComponent(property.slug)), channel);
  }
});

test('browser-generated social posts keep the current site origin and use the short property code', () => {
  const { generateLocalSocialPost } = load({ window: { location: { origin: 'https://preview.example.com' } } });
  const result = generateLocalSocialPost(property, 'line');
  assertPropertyUrl(result.fullPost, 'https://preview.example.com/properties/CK-RP6NQM');
  assert.ok(!result.fullPost.includes(property.slug));
});

test('marketing links include the static site prefix and query-based detail route', () => {
  const { generateLocalSocialPost, matchLeadToProperties, getQuickClosingScripts } = load({
    window: { location: { origin: 'https://preview.example.com' } },
    process: { env: { NEXT_PUBLIC_STATIC_EXPORT: 'true', NEXT_PUBLIC_BASE_PATH: '/Chantakorn-Property' } },
  });
  const expectedUrl = 'https://preview.example.com/Chantakorn-Property/properties/detail/?slug=CK-RP6NQM';
  assertPropertyUrl(generateLocalSocialPost(property, 'facebook').fullPost, expectedUrl);
  const [match] = matchLeadToProperties({ name: 'สมชาย', message: '' }, [property]);
  assertPropertyUrl(match.recommendedLinePitch, expectedUrl);
  const reply = getQuickClosingScripts(property).find(item => item.id === 'script_location');
  assertPropertyUrl(reply.recommendedResponse, expectedUrl);
});

test('lead matching sends the short detail link and still excludes unpublished properties', () => {
  const { matchLeadToProperties } = load();
  const inquiry = {
    name: 'สมชาย',
    message: 'ขอดูที่ดินเมืองสงขลา',
    property_id: property.id,
    inquiry_type: 'inquiry',
  };
  const matches = matchLeadToProperties(inquiry, [property, { ...property, id: 'ck-hidden', published: false }]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].property.id, property.id);
  assertPropertyUrl(matches[0].recommendedLinePitch, 'https://chantakornproperty.com/properties/CK-RP6NQM');
  assert.ok(matches[0].recommendedLinePitch.includes(inquiry.name));
  assert.ok(!matches[0].recommendedLinePitch.includes(property.slug));
});

test('location reply scripts share the short detail link and keep the homepage fallback', () => {
  const { getQuickClosingScripts } = load();
  const script = getQuickClosingScripts(property).find(item => item.id === 'script_location');
  assertPropertyUrl(script.recommendedResponse, 'https://chantakornproperty.com/properties/CK-RP6NQM');
  assert.ok(!script.recommendedResponse.includes(property.slug));
  const fallback = getQuickClosingScripts().find(item => item.id === 'script_location');
  assert.deepEqual(extractUrls(fallback.recommendedResponse), ['https://chantakornproperty.com']);
  assert.ok(!fallback.recommendedResponse.includes('/properties/'));
});
