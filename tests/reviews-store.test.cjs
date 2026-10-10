const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

const review = { id: 'rev-real', customerName: 'Customer', customerRole: '', propertyTitleOrZone: '', agentName: '', rating: 4, comment: 'Actual feedback', date: '2026-10-10', verifiedBuyer: false, serviceType: 'buy', published: false };
function load() {
  const state = { data: [], reads: [], writes: [], events: [], failRead: false, failWrite: false, staff: true, storage: new Map([['chantakorn_customer_reviews_v1', JSON.stringify([{ ...review, id: 'local-fake', published: true }])]]) };
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/store/reviews-store.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, crypto: { randomUUID: () => 'new-id' }, Intl, Date,
    window: { localStorage: { getItem: key => state.storage.get(key), setItem: (key,value) => state.storage.set(key,value) }, dispatchEvent: event => state.events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    require(name) {
      if (name === '@/lib/firebase/client') return { db: {} };
      if (name === '@/lib/supabase/client') return { supabase: null };
      if (name === '@/lib/backend') return { dataBackend: 'firebase' };
      if (name === '@/lib/auth-helpers') return { getCurrentUserProfile: async () => ({ role: state.staff ? 'ADMIN' : 'USER' }) };
      if (name === 'firebase/firestore') return {
        collection: (_db, name) => ({ name }), doc: (_db, name, id) => ({ name,id }), where: (field,op,value) => ({ field,op,value }), query: (source, filter) => ({ ...source, filter }),
        getDocsFromServer: async source => { state.reads.push(source); if (state.failRead) throw Error('offline'); return { docs: state.data.filter(value => !source.filter || value.published).map(value => ({ id: value.id, data: () => value })) }; },
        setDoc: async (ref,value) => { if (state.failWrite) throw Error('write denied'); state.writes.push({ ref,value }); },
        deleteDoc: async ref => { if (state.failWrite) throw Error('delete denied'); state.writes.push({ ref }); },
      };
      throw Error(name);
    },
  });
  return { state, api: mod.exports };
}
test('public cloud query reads only published reviews and never browser examples', async () => {
  const { api,state } = load();
  assert.equal((await api.fetchReviews()).length, 0);
  state.data = [review, { ...review, id: 'published', published: true }];
  assert.equal((await api.fetchReviews()).length, 1);
  assert.equal(state.reads[0].filter.field, 'published');
  assert.equal(state.writes.length, 0);
  assert.equal((await api.fetchReviews(true)).length, 2);
  state.failRead = true;
  await assert.rejects(api.fetchReviews(), /offline/);
});
test('failed create update and delete do not emit success or change cached cloud data', async () => {
  const { api,state } = load(); state.data = [review];
  await api.fetchReviews(true); const events = state.events.length; state.failWrite = true;
  await assert.rejects(api.addReview(review), /write denied/);
  await assert.rejects(api.updateReview(review.id, { comment: 'changed' }), /write denied/);
  await assert.rejects(api.deleteReview(review.id), /delete denied/);
  assert.equal(api.getReviews(true)[0].comment, review.comment);
  assert.equal(state.events.length, events);
});
test('new reviews are drafts and updates preserve identity even if caller supplies another id', async () => {
  const { api,state } = load();
  const { published, ...input } = review;
  const created = await api.addReview(input);
  assert.equal(created[0].published, false); assert.equal(api.getReviews().length, 0);
  await api.updateReview(created[0].id, { id: 'other', published: true });
  assert.equal(state.writes[1].value.id, created[0].id);
  assert.equal(api.getReviews().length, 1);
});
test('ordinary users and invalid review content cannot write', async () => {
  const { api,state } = load(); state.staff = false;
  await assert.rejects(api.addReview(review)); assert.equal(state.writes.length, 0);
  state.staff = true;
  for (const fields of [{ rating: 6 }, { customerName: '' }, { comment: 'x'.repeat(4001) }, { avatarUrl: 'http://unsafe.test/photo.jpg' }]) await assert.rejects(api.addReview({ ...review, ...fields }));
  assert.equal(state.writes.length, 0);
});
test('a late public fetch cannot evict an admin draft before editing it', async () => {
  const { api,state } = load(); state.data = [review, { ...review, id: 'live', published: true }];
  await api.fetchReviews(true);
  await api.fetchReviews();
  assert.equal(api.getReviews(true).length, 2);
  const updated = await api.updateReview(review.id, { comment: 'Saved draft update' });
  assert.equal(updated.length, 2);
  assert.equal(updated.find(item => item.id === review.id).comment, 'Saved draft update');
});
