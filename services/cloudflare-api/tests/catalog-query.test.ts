import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogCursor, parseCatalogQuery, type Sort } from '../src/catalog-query.ts';

test('catalog filters reject malformed or unbounded values', () => {
  for (const query of ['bedrooms=-1', 'bathrooms=100', 'hasVideo=yes', 'featured=1', 'features={}',
    'sortBy=random', 'sortBy=newest&sortBy=popular', 'features=' + encodeURIComponent(JSON.stringify(Array(11).fill('pool'))),
    'searchQuery=' + 'x'.repeat(121), 'subdistrict=' + 'x'.repeat(101), 'unknown=value'])
    assert.equal(parseCatalogQuery(new URLSearchParams(query)).ok, false, query);
});

test('sorted cursors preserve numeric sort key and reject a different sort', () => {
  const row = { createdAt: '2026-10-20T00:00:00.000Z', id: 'new-listing', price: 100.25, featured: true };
  for (const sort of ['newest', 'price_asc', 'price_desc', 'popular'] as Sort[]) {
    const token = catalogCursor(row, sort);
    const parsed = parseCatalogQuery(new URLSearchParams({ sortBy: sort, cursor: token }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.cursor?.id, row.id);
      assert.equal(parsed.value.sortValue, sort === 'newest' ? undefined : sort === 'popular' ? 1 : 100.25);
    }
    assert.equal(parseCatalogQuery(new URLSearchParams({ sortBy: sort === 'popular' ? 'price_asc' : 'popular', cursor: token })).ok, false);
  }
});

test('Thai filters and explicit false remain meaningful', () => {
  const parsed = parseCatalogQuery(new URLSearchParams({ searchQuery: 'บ้าน', features: '["สวน"]', featured: 'false', bedrooms: '0' }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.searchQuery, 'บ้าน');
    assert.deepEqual(parsed.value.features, ['สวน']);
    assert.equal(parsed.value.featured, false);
    assert.equal(parsed.value.bedrooms, 0);
  }
});
