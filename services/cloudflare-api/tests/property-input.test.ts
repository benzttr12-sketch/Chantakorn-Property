import test from 'node:test';
import assert from 'node:assert/strict';
import { newPropertyIdentity, parseEditorInput, readBoundedJson } from '../src/property-input.ts';
import { canWriteProperties } from '../src/property-auth.ts';

const valid = {
  title: 'ที่ดินใหม่ในอำเภอหาดใหญ่',
  slug: 'land-new-01', description: 'รายละเอียดตัวอย่างสำหรับทดสอบเท่านั้น',
  property_type: 'land', status: 'sale', price: 6100000,
  province: 'สงขลา', district: 'หาดใหญ่', latitude: 7.0084, longitude: 100.4705,
  features: ['ติดถนน'], published: true, featured: false, videos: [],
};

test('existing Thai property-editor payload maps to vetted D1 fields', () => {
  const result = parseEditorInput(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fields.propertyType, 'land');
  assert.equal(result.fields.price, 6100000);
  assert.equal(result.fields.featuresJson, '["ติดถนน"]');
  assert.equal(result.fields.published, true);
  assert.equal(result.fields.furniture, '');
  assert.equal(result.fields.internalNotes, null);
});

test('rejects client-controlled identity, audit and property media inputs', () => {
  for (const forbidden of ['id', 'code', 'created_at', 'updated_at', 'role', 'deleted_at',
    'cover_image', 'images', 'cover_media_id', 'agent', 'user_id']) {
    const parsed = parseEditorInput({ ...valid, [forbidden]: 'bad' });
    assert.equal(parsed.ok, false, forbidden);
  }
});

test('rejects malformed values and out-of-bounds money, coordinates and links', () => {
  for (const input of [
    { ...valid, price: Infinity }, { ...valid, price: -50 },
    { ...valid, latitude: 91 }, { ...valid, longitude: -181 },
    { ...valid, title: '' }, { ...valid, slug: '../admin' },
    { ...valid, features: new Array(51).fill('A') },
    { ...valid, video_url: 'javascript:alert(1)' },
    { ...valid, published: 'yes' },
    { ...valid, year_built: 1700 },
  ]) assert.equal(parseEditorInput(input).ok, false);
});

test('partial update does not accept empty or forged fields', () => {
  assert.equal(parseEditorInput({}, true).ok, false);
  assert.deepEqual(parseEditorInput({ price: 4500000 }, true), { ok: true, fields: { price: 4500000 } });
  assert.equal(parseEditorInput({ is_admin: true }, true).ok, false);
});

test('new codes are server generated, longer and not reused from old listings', () => {
  const id = '7537cedc-3fbf-4df9-9741-82757f583628';
  assert.deepEqual(newPropertyIdentity(id), { id, code: 'CK-7537CE' });
  assert.throws(() => newPropertyIdentity('CK-000'));
});

test('JSON payloads must be bounded, typed, UTF-8 and not empty', async () => {
  const make = (body: string) => new Request('https://example.test/v1/admin/properties', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  assert.deepEqual(await readBoundedJson(make('{"foo":12}')), { foo: 12 });
  await assert.rejects(readBoundedJson(make('a'.repeat(40000))));
  await assert.rejects(readBoundedJson(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })));
});

test('listing mutations stay disabled without exact allowed origin', () => {
  const env = {
    ALLOWED_ORIGIN: 'https://chantakornproperty.com', PROPERTY_WRITES_ENABLED: 'true',
    FIREBASE_PROJECT_ID: 'some-valid-project', DB: {} as D1Database,
  };
  assert.equal(canWriteProperties(env, undefined), false);
  assert.equal(canWriteProperties(env, 'https://evil.invalid'), false);
  assert.equal(canWriteProperties(env, env.ALLOWED_ORIGIN), true);
  assert.equal(canWriteProperties({ ...env, PROPERTY_WRITES_ENABLED: undefined }, env.ALLOWED_ORIGIN), false);
});
