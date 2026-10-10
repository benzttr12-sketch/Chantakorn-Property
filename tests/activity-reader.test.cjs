const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ backend = 'firebase', configured = true, failure = false, records = [] } = {}) {
  const state = { reads: 0 };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/store/activity-store.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleContext = { exports: {} };
  vm.runInNewContext(source, {
    exports: moduleContext.exports,
    require(name) {
      if (name === '@/lib/firebase/client') return { db: configured ? {} : null };
      if (name === '@/lib/backend') return { dataBackend: backend };
      if (name === '@/lib/auth-helpers') return { getStoredUser: () => null };
      if (name === 'firebase/firestore') return {
        collection: () => ({}), query: () => ({}), orderBy: () => ({}), limit: () => ({}),
        getDocs: async () => {
          state.reads += 1;
          if (failure) throw new Error('Permission denied');
          return { docs: records.map(record => ({ data: () => record })) };
        },
      };
      throw new Error(name);
    },
  });
  return { api: moduleContext.exports, state };
}

test('activity read failure remains an error rather than appearing as an empty feed', async () => {
  const { api, state } = load({ failure: true });
  await assert.rejects(api.fetchSystemActivities(), /Permission denied/);
  assert.equal(state.reads, 1);
});

test('missing Firebase activity configuration remains distinct from an empty database', async () => {
  await assert.rejects(load({ configured: false }).api.fetchSystemActivities(), /ยังไม่ได้ตั้งค่า/);
  assert.deepEqual(Array.from(await load().api.fetchSystemActivities()), []);
});

test('explicit local mode yields no cloud activity or invented records', async () => {
  const { api, state } = load({ backend: 'local', failure: true });
  assert.deepEqual(Array.from(await api.fetchSystemActivities()), []);
  assert.equal(state.reads, 0);
});
