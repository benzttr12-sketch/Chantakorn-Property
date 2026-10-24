import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.ts';

function env(overrides: Record<string, unknown> = {}) {
  return {
    ALLOWED_ORIGIN: 'https://chantakornproperty.com',
    FIREBASE_PROJECT_ID: 'test-chantakorn-auth',
    MEDIA_WRITES_ENABLED: undefined,
    DB: {} as D1Database,
    PROPERTY_MEDIA: {} as R2Bucket,
    PRIVATE_MEDIA: {} as R2Bucket,
    ...overrides,
  };
}
const uuid = '7537cedc-3fbf-4df9-9741-82757f583628';

test('anonymous private files are rejected before database or R2 access', async () => {
  const response = await app.request('/v1/media/inquiries/' + uuid, {}, env());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('public media requires a valid UUID even before querying data', async () => {
  const response = await app.request('/v1/media/properties/../../inquiries', {}, env());
  assert.equal(response.status, 404);
  const invalid = await app.request('/v1/media/properties/wrong-id', {}, env());
  assert.equal(invalid.status, 404);
});

test('writes are off by default and cannot be anonymously turned on', async () => {
  const response = await app.request('/v1/media/properties/' + uuid, {
    method: 'POST',
    headers: { Origin: 'https://chantakornproperty.com' },
  }, env());
  assert.equal(response.status, 503);
  const forgedOrigin = await app.request('/v1/media/properties/' + uuid, {
    method: 'POST',
    headers: { Origin: 'https://evil.invalid' },
  }, env({ MEDIA_WRITES_ENABLED: 'true' }));
  assert.equal(forgedOrigin.status, 403);
  const unauthenticated = await app.request('/v1/media/properties/' + uuid, {
    method: 'POST',
    headers: { Origin: 'https://chantakornproperty.com' },
  }, env({ MEDIA_WRITES_ENABLED: 'true' }));
  assert.equal(unauthenticated.status, 401);
});

test('cross-origin preflight is not silently granted', async () => {
  const invalid = await app.request('/v1/media/properties/' + uuid, {
    method: 'OPTIONS', headers: { Origin: 'https://evil.invalid' },
  }, env());
  assert.equal(invalid.status, 403);
  assert.equal(invalid.headers.get('Access-Control-Allow-Origin'), null);
  const valid = await app.request('/v1/media/properties/' + uuid, {
    method: 'OPTIONS', headers: { Origin: 'https://chantakornproperty.com' },
  }, env());
  assert.equal(valid.status, 204);
});
