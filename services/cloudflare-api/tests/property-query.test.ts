import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePropertyQuery, encodeCursor, decodeCursor } from '../src/property-query.ts';

test('defaults to 12 results and a truly empty filter', () => {
  assert.deepEqual(parsePropertyQuery(new URLSearchParams()), { ok: true, value: { limit: 12, type: undefined, status: undefined, province: undefined, district: undefined, minPrice: undefined, maxPrice: undefined, cursor: undefined } });
});

test('bounds query limits and rejects injection-like values', () => {
  for (const query of ['limit=0', 'limit=31', 'limit=100000', 'limit=10%20OR%201%3D1', 'limit=2&limit=3', 'random=hello']) {
    assert.equal(parsePropertyQuery(new URLSearchParams(query)).ok, false, query);
  }
});

test('accepts valid listing filters and rejects invalid money', () => {
  assert.deepEqual(parsePropertyQuery(new URLSearchParams('limit=25&type=land&status=sale&province=%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2&minPrice=100000&maxPrice=2000000')), {
    ok: true,
    value: { limit: 25, type: 'land', status: 'sale', province: 'สงขลา', district: undefined, minPrice: 100000, maxPrice: 2000000, cursor: undefined },
  });
  for (const query of ['minPrice=-1', 'maxPrice=Infinity', 'minPrice=12abc', 'minPrice=100&maxPrice=99', 'type=other', 'status=hidden', 'minPrice=']) {
    assert.equal(parsePropertyQuery(new URLSearchParams(query)).ok, false, query);
  }
});

test('cursor round-trip respects timestamp/ID and rejects forged formatting', () => {
  const value = { createdAt: '2026-10-20T05:05:00.000Z', id: 'new-property-001' };
  const encoded = encodeCursor(value);
  assert.deepEqual(decodeCursor(encoded), value);
  const parsed = parsePropertyQuery(new URLSearchParams({ cursor: encoded }));
  assert.equal(parsed.ok, true);
  for (const fake of ['not-base64!', '%%%F', 'a', btoa('bad|id'), btoa('2026-99-99T00:00:00.000Z|id'), btoa('2026-10-20T05:05:00.000Z|../admin')]) {
    assert.equal(decodeCursor(fake), null);
  }
});
