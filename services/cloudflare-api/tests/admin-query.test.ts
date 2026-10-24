import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SORTS, adminCursor, parseAdminQuery } from '../src/admin-query.ts';
import { decodeCursor, encodeCursor } from '../src/property-query.ts';

const row = { createdAt: '2026-10-20T00:00:00.000Z', id: 'ck-123456', price: 2_500_000, usableArea: 120 };
const parse = (search: string) => parseAdminQuery(new URLSearchParams(search));

test('defaults to bounded newest-first Admin pagination and accepts every documented filter', () => {
  const defaults = parse('');
  assert.equal(defaults.ok, true);
  if (defaults.ok) {
    assert.equal(defaults.value.limit, 50);
    assert.equal(defaults.value.sortBy, 'newest');
    assert.equal(defaults.value.cursor, undefined);
  }
  const full = parse('limit=80&sortBy=price_desc&searchQuery=%20วิลล่า%20&filter=draft&type=house&district=หาดใหญ่');
  assert.equal(full.ok, true);
  if (full.ok) {
    assert.equal(full.value.limit, 80);
    assert.equal(full.value.sortBy, 'price_desc');
    assert.equal(full.value.searchQuery, 'วิลล่า');
    assert.equal(full.value.filter, 'draft');
    assert.equal(full.value.type, 'house');
    assert.equal(full.value.district, 'หาดใหญ่');
  }
  for (const filter of ['sale', 'rent', 'featured', 'draft', 'published'])
    assert.equal(parse(`filter=${filter}`).ok, true);
  for (const sort of ADMIN_SORTS) assert.equal(parse(`sortBy=${sort}`).ok, true);
});

test('rejects unknown, duplicate and invalid Admin query values', () => {
  for (const search of [
    'limit=0', 'limit=101', 'limit=abc', 'limit=1.5', 'limit=', 'limit=1&limit=2',
    'sortBy=popular', 'sortBy=', 'filter=archived', 'type=apartment', 'district=',
    'searchQuery=' + 'x'.repeat(121), 'district=' + 'x'.repeat(101), 'owner=abc', 'cursor=',
  ]) {
    const result = parse(search);
    assert.equal(result.ok, false, search);
    if (!result.ok) assert.match(result.error, /Unsupported|Duplicate|Invalid|must be|too long/);
  }
});

test('keyset cursors round-trip for timestamp and sorted-value orders', () => {
  for (const sort of ['newest', 'oldest'] as const) {
    const token = adminCursor(row, sort);
    const parsed = parse(`sortBy=${sort}&cursor=${encodeURIComponent(token)}`);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.value.cursor, decodeCursor(token));
  }
  for (const [sort, value] of [['price_desc', row.price], ['price_asc', row.price], ['area_desc', row.usableArea]] as const) {
    const token = adminCursor(row, sort);
    const parsed = parse(`sortBy=${sort}&cursor=${encodeURIComponent(token)}`);
    assert.equal(parsed.ok, true, sort);
    if (parsed.ok) {
      assert.equal(parsed.value.sortValue, value);
      assert.deepEqual(parsed.value.cursor, decodeCursor(encodeCursor(row)));
    }
  }
});

test('Admin cursors fail closed across sorts, tampering and out-of-range values', () => {
  const priceDesc = adminCursor(row, 'price_desc');
  for (const search of [
    `sortBy=price_asc&cursor=${encodeURIComponent(priceDesc)}`,
    `sortBy=newest&cursor=${encodeURIComponent(priceDesc)}`,
    `sortBy=price_desc&cursor=${encodeURIComponent(adminCursor(row, 'newest'))}`,
    'sortBy=price_desc&cursor=not-a-cursor',
    `sortBy=price_desc&cursor=${encodeURIComponent(priceDesc.slice(0, -2))}`,
  ]) {
    assert.equal(parse(search).ok, false, search);
  }
  const wrap = (value: unknown, sort: string) => btoa(JSON.stringify({ after: encodeCursor(row), sort, value }))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  for (const token of [wrap(-1, 'price_desc'), wrap(1e14, 'price_desc'), wrap('900', 'price_desc'),
    wrap(row.price, 'newest'), btoa(JSON.stringify({ after: 'bad', sort: 'price_desc', value: 1 }))])
    assert.equal(parse(`sortBy=price_desc&cursor=${encodeURIComponent(token)}`).ok, false);
});
