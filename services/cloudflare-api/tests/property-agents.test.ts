import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/d1';
import { agentsForRows } from '../src/property-agents.ts';

test('canonical property agent hydration uses one bounded allowlisted query and no profile data', async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    prepare(statement: string) {
      return { bind(...values: unknown[]) {
        queries.push({ sql: statement, values });
        return { raw: async () => [['catalog-agent', 'Agent', 'Advisor', null, 'line-id', null, null, null, null]] };
      } };
    },
  } as unknown as D1Database;
  const db = drizzle(database);
  const result = await agentsForRows(db, [{ agentId: 'catalog-agent' }, { agentId: 'catalog-agent' }, { agentId: null }], true);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, ['catalog-agent']);
  assert.match(queries[0].sql, /"is_public" = 1/);
  const projection = queries[0].sql.slice(0, queries[0].sql.indexOf(' from '));
  for (const field of ['uid', 'role', 'is_public', 'created_at', 'updated_at'])
    assert.equal(projection.includes(`"${field}"`), false);
  assert.deepEqual(result.get('catalog-agent'), {
    id: 'catalog-agent', name: 'Agent', title: 'Advisor', phone: '', line_id: 'line-id',
    facebook: '', email: '', photo_url: '', bio: '',
  });
});

test('empty assignments make no query and the helper cannot exceed a D1 page', async () => {
  const db = drizzle({ prepare() { assert.fail('Unexpected query'); } } as unknown as D1Database);
  assert.equal((await agentsForRows(db, [])).size, 0);
  assert.equal((await agentsForRows(db, [{ agentId: null }])).size, 0);
  await assert.rejects(agentsForRows(db, Array.from({ length: 101 }, (_, index) => ({ agentId: `agent-${index}` }))), /query bound/);
});

test('staff hydration preserves visibility so public marketing can exclude hidden contacts', async () => {
  let query = '';
  const db = drizzle({ prepare(statement: string) {
    query = statement;
    return { bind() { return { raw: async () => [['hidden-agent', 'Hidden agent', 'Advisor', '0899990000', 'private-line', null, null, null, null, 0]] }; } };
  } } as unknown as D1Database);
  const result = await agentsForRows(db, [{ agentId: 'hidden-agent' }]);
  assert.match(query, /"is_public"/);
  assert.equal(result.get('hidden-agent')?.is_public, false);
  assert.equal(result.get('hidden-agent')?.phone, '0899990000');
  assert.equal(Object.hasOwn(result.get('hidden-agent')!, 'uid'), false);
});
