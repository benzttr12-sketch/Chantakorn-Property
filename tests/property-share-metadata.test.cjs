const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const fields = {
  id: { stringValue: '1f2b283e-254d-45c4-ae0e-caacf1374aaa' },
  title: { stringValue: 'ขายที่ดิน สทิงพระ' }, published: { booleanValue: true },
  price: { integerValue: '600000' }, status: { stringValue: 'sale' },
  district: { stringValue: 'สทิงพระ' }, province: { stringValue: 'สงขลา' },
  cover_image: { stringValue: 'https://images.example.test/cover.jpg' },
  internal_notes: { stringValue: 'private notes' },
};
function make(response) {
  let calls = 0;
  const api = loader({ '@/lib/server-property-catalog': { getPublishedPropertyDocument: async () => { calls++; return response; } } })('lib/property-share-metadata.ts');
  return { api, calls: () => calls };
}

test('public property metadata contains the selected title, location, price, canonical URL and actual cover', async () => {
  const { api } = make(Response.json({ fields }));
  const meta = await api.propertyShareMetadata('CK-1F2B28');
  assert.equal(meta.openGraph.title, 'ขายที่ดิน สทิงพระ');
  assert.match(meta.openGraph.description, /สทิงพระ.*สงขลา.*600,000/);
  assert.equal(meta.openGraph.url, 'https://chantakornproperty.com/properties/CK-1F2B28');
  assert.equal(meta.openGraph.images[0].url, 'https://images.example.test/cover.jpg');
  assert.ok(!JSON.stringify(meta).includes('private notes'));
});

test('unpublished or deleted records and invalid identifiers never expose their metadata', async () => {
  for (const extra of [{ published: { booleanValue: false } }, { deleted_at: { stringValue: 'deleted' } }]) {
    const { api } = make(Response.json({ fields: { ...fields, ...extra } }));
    assert.equal(JSON.stringify(await api.propertyShareMetadata('CK-1F2B28')), '{}');
  }
  const invalid = make(Response.json({ fields }));
  assert.equal(JSON.stringify(await invalid.api.propertyShareMetadata('../private')), '{}');
  assert.equal(invalid.calls(), 0);
});

test('missing cover uses the saved gallery photo and inaccessible data does not crash the page', async () => {
  const { api } = make(Response.json({ fields: { ...fields, cover_image: { stringValue: 'javascript:alert(1)' }, images: { arrayValue: { values: [{ stringValue: 'https://images.example.test/gallery.jpg' }] } } } }));
  assert.equal((await api.propertyShareMetadata('CK-1F2B28')).openGraph.images[0].url, 'https://images.example.test/gallery.jpg');
  const unavailable = make(Response.json({}, { status: 503 }));
  assert.equal(JSON.stringify(await unavailable.api.propertyShareMetadata('CK-1F2B28')), '{}');
});
