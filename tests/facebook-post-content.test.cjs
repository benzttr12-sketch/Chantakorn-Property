const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const { generateLocalSocialPost } = loader()('lib/automation-engine.ts');
const officialPhone = '081-604-0097';
const emoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\uFE0E\uFE0F\u200D\u20E3]/u;
const listing = {
  id: '1f2b283e-254d-45c4-ae0e-caacf1374aaa',
  title: 'ที่ดินทดสอบ', slug: 'legacy-test-title', description: '',
  property_type: 'land', status: 'sale', price: 600000,
  province: 'สงขลา', district: 'สทิงพระ', subdistrict: 'ทดสอบ',
  bedrooms: 0, bathrooms: 0, parking: 0, land_size: 447, usable_area: 0,
  furniture: '', features: [], published: true,
};

test('every Facebook tone describes land without invented home features or financing promises', () => {
  for (const tone of ['hot_deal', 'luxury', 'friendly', 'investor']) {
    const post = generateLocalSocialPost(listing, 'facebook', tone);
    assert.match(post.fullPost, /ที่ดินทดสอบ/);
    assert.match(post.fullPost, /฿600,000/);
    assert.match(post.fullPost, /เนื้อที่: 447 ตร\.ว\./);
    assert.match(post.fullPost, /ทดสอบ, สทิงพระ, สงขลา/);
    assert.doesNotMatch(post.fullPost, /ห้องนอน|ห้องน้ำ|ที่จอดรถ|การตกแต่ง|บ้านสวย|พร้อมเข้าอยู่|พรีเมียม|โครงสร้างแข็งแรง|ปลอดภัย|รู้ผลไว|จนผ่าน|360°|#บ้าน|#หาดใหญ่|#คอนโด/);
    assert.equal(post.body, post.fullPost);
    assert.ok(post.hashtags.includes('#ที่ดิน'));
    assert.doesNotMatch(post.fullPost, emoji);
    assert.match(post.fullPost, /^ขายที่ดิน \| ที่ดินทดสอบ\nราคา: ฿600,000\nทำเล:/);
    assert.doesNotMatch(post.fullPost, /\*\*|ข้อมูลราคาและรายละเอียดทรัพย์|ข้อมูลประกอบการพิจารณาทรัพย์/);
    assert.ok(post.fullPost.length < 600);
    assert.ok(post.fullPost.split('\n').length <= 12);
  }
});

test('house posts retain both recorded area units and explicit room, furnishing and feature details', () => {
  const post = generateLocalSocialPost({
    ...listing, title: 'บ้านทดสอบ', property_type: 'house',
    land_size: 52.5, usable_area: 185, bedrooms: 3, bathrooms: 2, parking: 1,
    furniture: 'มีเครื่องปรับอากาศ 2 เครื่อง', facing_direction: 'ทิศเหนือ',
    description: 'บันทึกรายละเอียดจากเจ้าของทรัพย์', features: ['ติดถนนคอนกรีต', 'มีรั้ว'],
  }, 'facebook');
  assert.match(post.fullPost, /เนื้อที่: 52\.5 ตร\.ว\./);
  assert.match(post.fullPost, /พื้นที่ใช้สอย: 185 ตร\.ม\./);
  assert.match(post.fullPost, /ห้องนอน: 3 ห้อง/);
  assert.match(post.fullPost, /ห้องน้ำ: 2 ห้อง/);
  assert.match(post.fullPost, /ที่จอดรถ: 1 คัน/);
  assert.match(post.fullPost, /มีเครื่องปรับอากาศ 2 เครื่อง/);
  assert.match(post.fullPost, /ทิศหน้าทรัพย์: ทิศเหนือ/);
  assert.doesNotMatch(post.fullPost, /รายละเอียด:|บันทึกรายละเอียดจากเจ้าของทรัพย์/);
  assert.match(post.fullPost, /ติดถนนคอนกรีต/);
  assert.match(post.fullPost, /มีรั้ว/);
  assert.doesNotMatch(post.fullPost, /รับทรัพย์ รับลม/);
});

test('rental posts use the recorded monthly price exactly once without sale or ownership-transfer promises', () => {
  const post = generateLocalSocialPost({ ...listing, title: 'คอนโดทดสอบ', property_type: 'condo', status: 'rent', price: 12500, land_size: 0, usable_area: 32 }, 'facebook');
  assert.match(post.headline, /^ให้เช่าคอนโดมิเนียม/);
  assert.equal(post.fullPost.match(/฿12,500 \/ เดือน/g)?.length, 1);
  assert.match(post.fullPost, /พื้นที่ใช้สอย: 32 ตร\.ม\./);
  assert.doesNotMatch(post.fullPost, /ขายคอนโด|โอนกรรมสิทธิ์|ยื่นกู้|บาท\/เดือน|\/เดือน\/เดือน/);
  assert.ok(post.hashtags.includes('#ให้เช่า'));
});

test('missing or invalid prices, locations and numeric specifications cannot fabricate Facebook facts', () => {
  for (const price of [0, -1, NaN, Infinity, undefined, null]) {
    const post = generateLocalSocialPost({
      ...listing, title: '', description: undefined, property_type: 'house', price,
      province: undefined, district: '', subdistrict: undefined,
      land_size: Infinity, usable_area: -50, bedrooms: undefined, bathrooms: NaN, parking: 0,
      furniture: null, features: undefined,
    }, 'facebook');
    assert.match(post.fullPost, /ติดต่อสอบถามราคา/);
    assert.doesNotMatch(post.fullPost, /NaN|Infinity|undefined|null|฿0|฿-1|ทำเล:|หาดใหญ่|สงขลา|เนื้อที่:|พื้นที่ใช้สอย:|ห้องนอน:|ห้องน้ำ:|ที่จอดรถ:|การตกแต่ง:/);
  }
});

test('Facebook posts use the official fallback contact and preserve a listing agent contact when supplied', () => {
  const fallback = generateLocalSocialPost(listing, 'facebook');
  assert.ok(fallback.fullPost.includes(officialPhone));
  assert.doesNotMatch(fallback.fullPost, /082-436-4499/);
  assert.match(fallback.fullPost, /https:\/\/lin\.ee\/NMSe28T3/);
  const assigned = generateLocalSocialPost({ ...listing, agent: { name: 'นายหน้าทดสอบ', phone: ' 012-345-6789 ', line_id: '@fixture-agent' } }, 'facebook');
  assert.match(assigned.fullPost, /012-345-6789 \(นายหน้าทดสอบ\)/);
  assert.match(assigned.fullPost, /fixture-agent/);
  assert.ok(!assigned.fullPost.includes(officialPhone));
  const blank = generateLocalSocialPost({ ...listing, agent: { name: ' ', phone: ' ', line_id: ' ' } }, 'facebook');
  assert.ok(blank.fullPost.includes(officialPhone));
  assert.match(blank.fullPost, /ทีมงาน ฉันทากร พร็อพเพอร์ตี้/);
});

test('public social copy never includes a hidden catalog agent from an Admin property response', () => {
  const hiddenAgent = { id: 'hidden-agent', name: 'PRIVATE_AGENT_NAME', phone: '0899990000', line_id: 'private-line-id', is_public: false };
  for (const channel of ['facebook', 'line', 'instagram', 'tiktok', 'english', 'chinese']) {
    const post = generateLocalSocialPost({ ...listing, agent: hiddenAgent }, channel);
    assert.ok(post.fullPost.includes(officialPhone), channel);
    assert.doesNotMatch(post.fullPost + post.callToAction, /PRIVATE_AGENT_NAME|0899990000|private-line-id/);
  }
  for (const is_public of [undefined, true]) {
    const post = generateLocalSocialPost({ ...listing, agent: { ...hiddenAgent, is_public } }, 'facebook');
    assert.ok(post.fullPost.includes(hiddenAgent.phone));
    assert.ok(post.fullPost.includes(hiddenAgent.line_id));
  }
});

test('land posts do not inherit stale building counts, and empty feature entries add no made-up defaults', () => {
  const post = generateLocalSocialPost({ ...listing, bedrooms: 3, bathrooms: 2, parking: 4, furniture: 'เก่า', features: ['', '  ', null, 4, ' ติดถนนสาธารณะ '] }, 'facebook');
  assert.doesNotMatch(post.fullPost, /ห้องนอน|ห้องน้ำ|ที่จอดรถ|การตกแต่ง|null|จุดเด่น: 4/);
  assert.match(post.fullPost, /จุดเด่น: ติดถนนสาธารณะ/);
});

test('Facebook strips source emoji sequences while retaining Thai text, numbers, contact and punctuation', () => {
  for (const tone of ['hot_deal', 'luxury', 'friendly', 'investor']) {
    const post = generateLocalSocialPost({
      ...listing, title: '🏡 ที่ดิน (แปลง 123) 🇹🇭', district: '📍 สทิงพระ',
      description: '👨‍👩‍👧‍👦 เจ้าของแจ้ง: ติดถนน 6 เมตร',
      features: ['✅ ติดถนน', '👍🏽 มีรั้ว', '1️⃣ ติดถนน', 'มีรั้ว', ''],
      agent: { name: '👩🏻‍💼 นายหน้า (ทีม A)', phone: '📞 012-345-6789', line_id: '@fixture-agent' },
    }, 'facebook', tone);
    assert.doesNotMatch(post.fullPost, emoji);
    assert.match(post.fullPost, /ที่ดิน \(แปลง 123\)/);
    assert.doesNotMatch(post.fullPost, /รายละเอียด:|เจ้าของแจ้ง:/);
    assert.match(post.fullPost, /จุดเด่น: ติดถนน \/ มีรั้ว/);
    assert.equal(post.fullPost.match(/ติดถนน \/ มีรั้ว/g)?.length, 1);
    assert.match(post.fullPost, /012-345-6789 \(นายหน้า \(ทีม A\)\)/);
    assert.match(post.fullPost, /fixture-agent/);
  }
});

test('long Facebook descriptions and feature lists stay concise without truncating price, areas or links', () => {
  const post = generateLocalSocialPost({
    ...listing, title: 'ที่ดินแปลงทดสอบ '.repeat(25), property_type: 'house',
    bedrooms: 3, bathrooms: 2, parking: 1, land_size: 52.5, usable_area: 185,
    description: 'รายละเอียดที่เจ้าของแจ้งไว้ '.repeat(300),
    features: ['ติดถนน', 'มีรั้ว', 'มีสวน', 'มีระเบียง', 'มีโรงรถ'],
  }, 'facebook');
  assert.ok(post.fullPost.length < 1000);
  assert.match(post.fullPost, /ราคา: ฿600,000\n/);
  assert.match(post.fullPost, /เนื้อที่: 52\.5 ตร\.ว\./);
  assert.match(post.fullPost, /พื้นที่ใช้สอย: 185 ตร\.ม\./);
  assert.match(post.fullPost, /ห้องนอน: 3 ห้อง \| ห้องน้ำ: 2 ห้อง \| ที่จอดรถ: 1 คัน/);
  assert.match(post.fullPost, /จุดเด่น: ติดถนน \/ มีรั้ว \/ มีสวน/);
  assert.doesNotMatch(post.fullPost, /มีระเบียง|มีโรงรถ/);
  assert.match(post.fullPost, /https:\/\/chantakornproperty\.com\/properties\/CK-[A-Z0-9]+/);
  assert.ok(post.fullPost.includes(officialPhone));
});

test('a saved title already starting with the correct sale type is not prefixed twice', () => {
  const title = 'ขายที่ดิน 447 ตร.ว. ใกล้มหาวิทยาลัย';
  const post = generateLocalSocialPost({ ...listing, title }, 'facebook');
  assert.equal(post.headline, title);
  assert.equal(post.fullPost.match(/ขายที่ดิน/g)?.length, 1);
});

test('a short saved description fills in missing highlights without duplicating an existing highlight section', () => {
  const description = '📍 เจ้าของแจ้ง: ติดถนน 6 เมตร';
  const fallback = generateLocalSocialPost({ ...listing, description, features: ['', ' '] }, 'facebook');
  assert.match(fallback.fullPost, /รายละเอียด: เจ้าของแจ้ง: ติดถนน 6 เมตร/);
  assert.doesNotMatch(fallback.fullPost, /จุดเด่น:|\p{Extended_Pictographic}/u);
  const highlights = generateLocalSocialPost({ ...listing, description, features: ['ติดถนน 6 เมตร'] }, 'facebook');
  assert.match(highlights.fullPost, /จุดเด่น: ติดถนน 6 เมตร/);
  assert.doesNotMatch(highlights.fullPost, /รายละเอียด:|เจ้าของแจ้ง:/);
});

test('Facebook emoji cleanup does not alter other social channels', () => {
  for (const channel of ['line', 'instagram', 'tiktok', 'english', 'chinese']) {
    const post = generateLocalSocialPost({ ...listing, title: '🏡 ทรัพย์ทดสอบ' }, channel);
    assert.ok(post.fullPost.includes('🏡 ทรัพย์ทดสอบ'), channel);
  }
});

test('the shared official phone fallback is consistent across existing marketing channels', () => {
  for (const channel of ['facebook', 'line', 'instagram', 'tiktok', 'english', 'chinese']) {
    const post = generateLocalSocialPost(listing, channel);
    assert.ok(post.fullPost.includes(officialPhone), channel);
    assert.ok(!post.fullPost.includes('082-436-4499'), channel);
  }
});
