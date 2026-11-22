import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.ts';

const env = {
  ALLOWED_ORIGIN: 'https://admin.example.test', FIREBASE_PROJECT_ID: 'test-chantakorn-auth',
  DB: {} as D1Database, PROPERTY_MEDIA: {} as R2Bucket, PRIVATE_MEDIA: {} as R2Bucket,
};

test('catalog agent reads require staff identity before accessing D1 and remain private', async () => {
  const response = await app.request('/v1/admin/agents', {}, env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await app.request('/v1/admin/agents', { method: 'POST' }, env)).status, 404);
});

test('catalog agent preflight allows only the configured origin and read method', async () => {
  const good = await app.request('/v1/admin/agents', {
    method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGIN },
  }, env);
  assert.equal(good.status, 204);
  assert.equal(good.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.equal(good.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  assert.equal(good.headers.get('Access-Control-Allow-Headers'), 'Authorization');
  const bad = await app.request('/v1/admin/agents', {
    method: 'OPTIONS', headers: { Origin: 'https://other.example.test' },
  }, env);
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
});
