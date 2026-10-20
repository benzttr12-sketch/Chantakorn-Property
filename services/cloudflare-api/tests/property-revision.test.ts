import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPropertyRevision } from '../src/property-admin-routes.ts';

test('a save always advances its observed revision despite same-millisecond saves or clock rollback', () => {
  const previous = '2026-10-20T00:00:00.000Z';
  const clock = Date.parse(previous);
  assert.equal(nextPropertyRevision(previous, clock), '2026-10-20T00:00:00.001Z');
  assert.equal(nextPropertyRevision(previous, clock - 1000), '2026-10-20T00:00:00.001Z');
  assert.equal(nextPropertyRevision(previous, clock + 1000), '2026-10-20T00:00:01.000Z');
});

test('malformed stored revisions and clocks fail closed instead of producing a reusable revision', () => {
  for (const previous of ['', 'invalid', '2026-02-30T00:00:00.000Z', '2026-10-20'])
    assert.throws(() => nextPropertyRevision(previous));
  for (const clock of [NaN, Infinity, 1.5])
    assert.throws(() => nextPropertyRevision('2026-10-20T00:00:00.000Z', clock));
});
