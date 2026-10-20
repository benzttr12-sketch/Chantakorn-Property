import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.ts';
import { toEditorProperty } from '../src/property-admin-routes.ts';

const id = '7537cedc-3fbf-4df9-9741-82757f583628';
const env = {
  ALLOWED_ORIGIN: 'https://chantakornproperty.com',
  FIREBASE_PROJECT_ID: 'test-chantakorn-auth',
  PROPERTY_WRITES_ENABLED: 'false',
  PROPERTY_PUBLICATION_ENABLED: 'false',
  DB: {} as D1Database,
  PROPERTY_MEDIA: {} as R2Bucket,
  PRIVATE_MEDIA: {} as R2Bucket,
};

test('property Admin mutations are safely disabled before migration, without DB access', async () => {
  for (const [method, path] of [
    ['POST', '/v1/admin/properties'],
    ['PATCH', '/v1/admin/properties/' + id],
    ['DELETE', '/v1/admin/properties/' + id],
  ]) {
    const res = await app.request(path, {
      method, headers: { Origin: 'https://chantakornproperty.com', 'Content-Type': 'application/json' },
      body: '{}',
    }, env);
    assert.equal(res.status, 503, `${method} ${path}`);
  }
});

test('property Admin requires identity before any DB query; wrong origin is rejected', async () => {
  const unauth = await app.request('/v1/admin/properties', {}, env);
  assert.equal(unauth.status, 401);
  const forged = await app.request('/v1/admin/properties', {
    method: 'POST', headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' },
    body: '{}',
  }, { ...env, PROPERTY_WRITES_ENABLED: 'true' });
  assert.equal(forged.status, 503);
});

test('explicit serializer excludes staff notes, internal storage paths and account details from public output', () => {
  const record = {
    id, code: 'CK-7537CE', slug: 'test-01', title: 'แปลงทดลอง', description: '',
    propertyType: 'land', status: 'sale', price: 1000000, province: 'สงขลา',
    district: 'หาดใหญ่', subdistrict: '', address: 'Somewhere',
    latitude: 7, longitude: 100, bedrooms: 0, bathrooms: 0, parking: 0,
    landSize: 70, usableArea: 0, featuresJson: '["ติดถนน"]',
    coverImage: '', featured: false, published: true, agentId: null,
    createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
    furniture: '', facingDirection: null, fengShuiJson: null, yearBuilt: null,
    videoUrl: null, videosJson: '[]', internalNotes: 'SECRET-INTERNAL-NOTE',
    deletedAt: null,
  };
  const media = [{ propertyId: id, id, sortOrder: 0 }];
  const visible = toEditorProperty(record as any, media, false);
  assert.deepEqual(visible.images, ['/v1/media/properties/' + id]);
  assert.deepEqual(visible.features, ['ติดถนน']);
  assert.equal('internal_notes' in visible, false);
  assert.equal('deleted_at' in visible, false);
  assert.equal(JSON.stringify(visible).includes('SECRET-INTERNAL-NOTE'), false);
  const privateView = toEditorProperty(record as any, media, true);
  assert.equal(privateView.internal_notes, 'SECRET-INTERNAL-NOTE');
});
