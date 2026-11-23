const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

function harness({ configured = true, canonicalAgent = { id: 'catalog-agent', name: 'Catalog contact', phone: '0811111111' }, fail = false } = {}) {
  let legacyReads = 0;
  const row = { id: 'listing-one', published: true, agent_id: 'catalog-agent',
    latitude: 7, longitude: 100, price: 1250000, created_at: '2026-11-16T00:00:00.000Z',
    ...(canonicalAgent ? { agent: canonicalAgent } : {}) };
  const result = async () => { if (fail) throw Error('Catalog unavailable'); return row; };
  const page = async () => ({ data: [await result()], nextCursor: null, total: 1, counts: { all: 1 } });
  const store = loader({
    '@/lib/backend': { dataBackend: 'firebase', useCloudflarePropertyBackend: true },
    '@/lib/firebase/client': { db: configured ? {} : null },
    '@/lib/cloudflare-properties': {
      cloudflarePublicDetail: result, cloudflareAdminDetail: result,
      cloudflareListProperties: async () => [await result()],
      cloudflarePropertyPage: page, cloudflareAdminPropertyPage: page,
    },
    '@/lib/store/agents-store': { getAgents: () => { legacyReads++; return [{ id: 'catalog-agent', name: 'Stale Firestore contact', phone: '0899999999' }]; } },
    '@/lib/store/property-history-store': {}, '@/lib/store/activity-store': {},
    '@/lib/property-media': {}, '@/lib/inquiry-submit': {}, '@/lib/staff-api': {},
  }, { window: {} })('lib/store/properties-store.ts');
  return { store, legacyReads: () => legacyReads };
}

test('D1 public and staff reads retain canonical catalog contacts without consulting legacy agent cache', async () => {
  const h = harness();
  const records = [await h.store.fetchPropertyBySlug('listing-one'), ...(await h.store.fetchProperties()),
    ...(await h.store.fetchPropertyPage({})).data, await h.store.fetchAdminPropertyById('listing-one'),
    ...(await h.store.fetchAdminPropertiesPage()).data, ...(await h.store.fetchAdminCatalog())];
  for (const row of records) {
    assert.equal(row.agent.name, 'Catalog contact');
    assert.equal(row.agent.phone, '0811111111');
  }
  assert.equal(h.legacyReads(), 0);
});

test('a hidden or unassigned D1 agent stays absent instead of reviving a legacy contact', async () => {
  const h = harness({ canonicalAgent: null });
  assert.equal((await h.store.fetchPropertyBySlug('listing-one')).agent, undefined);
  assert.equal((await h.store.fetchPropertyPage({})).data[0].agent, undefined);
  assert.equal(h.legacyReads(), 0);
});

test('public D1 catalog does not require Firestore initialization and failures remain visible', async () => {
  const h = harness({ configured: false });
  assert.equal((await h.store.fetchProperties()).length, 1);
  assert.equal((await h.store.fetchPropertyBySlug('listing-one')).id, 'listing-one');
  assert.equal((await h.store.fetchPropertyPage({})).data.length, 1);
  await assert.rejects(h.store.fetchAdminPropertyById('listing-one'), /Firebase/);
  const unavailable = harness({ configured: false, fail: true });
  await assert.rejects(unavailable.store.fetchProperties(), /Catalog unavailable/);
  await assert.rejects(unavailable.store.fetchPropertyBySlug('listing-one'), /Catalog unavailable/);
});
