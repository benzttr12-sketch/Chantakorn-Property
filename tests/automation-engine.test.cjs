const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs');

const origin = 'https://property.example';
const engine = load({}, {
  window: { location: { origin } },
  fetch() { throw new Error('Local automation must not make network requests'); },
})('lib/automation-engine.ts');

const property = {
  id: 'house-1', slug: 'garden-house', title: 'บ้านสวนพร้อมอยู่',
  property_type: 'house', status: 'sale', published: true,
  price: 2500000, province: 'สงขลา', district: 'หาดใหญ่',
  land_size: 60, usable_area: 180, bedrooms: 3, bathrooms: 2, parking: 2,
  features: ['สวนส่วนตัว', 'ใกล้โรงเรียน'],
  agent: { name: 'คุณสมชาย', phone: '081-234-5678', line_id: '@garden-home' },
};

test('all marketing channels prepare usable property copy locally with working contact details', () => {
  for (const channel of ['facebook', 'tiktok', 'line', 'instagram', 'english', 'chinese']) {
    const post = engine.generateLocalSocialPost(property, channel, 'hot_deal');
    assert.ok(post.headline.includes(property.title) || post.headline.includes(property.district), channel);
    assert.ok(post.fullPost.includes(property.title), channel);
    assert.ok(post.fullPost.includes('2,500,000'), channel);
    assert.ok(post.fullPost.includes(property.agent.phone), channel);
    assert.ok(post.callToAction.length > 0, channel);
    assert.equal(post.body, post.fullPost, channel);
    assert.equal(engine.generateLocalSocialPost(property, channel, 'hot_deal').fullPost, post.fullPost, channel);
  }
  for (const channel of ['facebook', 'line', 'instagram', 'english', 'chinese']) {
    assert.ok(engine.generateLocalSocialPost(property, channel).fullPost.includes(`${origin}/properties/${property.slug}`), channel);
  }
});

test('template selection updates the listing, rent units and supported tone without a provider', () => {
  const rental = { ...property, title: 'บ้านเช่าสวนสวย', slug: 'garden-rental', price: 15000, status: 'rent' };
  const post = engine.generateLocalSocialPost(rental, 'line', 'luxury');
  assert.ok(post.fullPost.includes('15,000/เดือน'));
  assert.ok(post.fullPost.includes('บ้านเช่าสวนสวย'));
  assert.ok(post.fullPost.includes(`${origin}/properties/garden-rental`));
  assert.ok(!post.fullPost.includes('2,500,000'));
  assert.notEqual(
    engine.generateLocalSocialPost(property, 'facebook', 'hot_deal').fullPost,
    engine.generateLocalSocialPost(property, 'facebook', 'luxury').fullPost,
  );
});

test('lead matching keeps published listings ranked and prepares a personalized LINE pitch locally', () => {
  const inquiry = { name: 'มาลี', message: 'สนใจบ้าน 3 ห้องนอน', property_id: property.id };
  const lessRelevant = { ...property, id: 'condo-2', slug: 'city-condo', title: 'คอนโดในเมือง', property_type: 'condo', bedrooms: 1 };
  const hidden = { ...property, id: 'hidden-3', published: false };
  const results = engine.matchLeadToProperties(inquiry, [lessRelevant, hidden, property]);
  assert.equal(results.length, 2);
  assert.equal(results[0].property.id, property.id);
  assert.ok(results[0].score > results[1].score);
  assert.ok(results[0].recommendedLinePitch.includes(inquiry.name));
  assert.ok(results[0].recommendedLinePitch.includes(property.title));
  assert.ok(results[0].recommendedLinePitch.includes(`${origin}/properties/${property.slug}`));
});
