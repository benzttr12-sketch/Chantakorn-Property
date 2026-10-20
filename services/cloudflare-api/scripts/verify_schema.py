"""Offline migration sanity checks; no Cloudflare credentials or production database needed."""
import sqlite3
from pathlib import Path

sql = (Path(__file__).parents[1] / 'migrations' / '0001_initial.sql').read_text(encoding='utf-8')
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.executescript(sql)
db.execute('PRAGMA foreign_keys = ON')

tables = {row['name'] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    'properties', 'property_media', 'profiles', 'agents', 'inquiries',
    'inquiry_media', 'line_followers', 'work_jobs', 'settings', 'audit_events',
}
assert required <= tables, f'Missing tables: {required - tables}'
assert db.execute('SELECT COUNT(*) FROM properties').fetchone()[0] == 0, 'Do not seed legacy properties'

now = '2026-10-20T05:00:00.000Z'
def property_values(id, published, notes):
    return (id, f'CK-{id.upper()}', id, f'New listing {id}', 'land', 'sale', 123456.0,
            'สงขลา', 'หาดใหญ่', published, notes, now, now)

insert = """INSERT INTO properties
    (id,code,slug,title,property_type,status,price,province,district,published,internal_notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"""
db.execute(insert, property_values('new1', 1, 'PRIVATE internal note'))
db.execute(insert, property_values('new2', 0, 'UNPUBLISHED'))
rows = db.execute("SELECT id, title, price FROM properties WHERE published = 1 ORDER BY created_at DESC, id DESC LIMIT ?", (12,)).fetchall()
assert [r['id'] for r in rows] == ['new1'], 'Public selection must exclude drafts'
assert all('internal_notes' not in r.keys() for r in rows), 'Public field allowlist regression'
plan = [r['detail'] for r in db.execute(
    "EXPLAIN QUERY PLAN SELECT id FROM properties WHERE published = 1 ORDER BY created_at DESC, id DESC LIMIT 12"
)]
assert any('idx_properties_public_newest' in line for line in plan), f'Missing index usage: {plan}'
try:
    db.execute(insert, property_values('new3', 2, 'bad published flag'))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError('Published flag must be constrained to 0/1')
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
db.close()
print('OK: D1 fresh-start SQL creates expected tables, starts empty, bounds public queries and uses indexed ordering')
