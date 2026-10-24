"""Offline migration sanity checks; no Cloudflare credentials or production database needed."""
import sqlite3
from pathlib import Path

migrations = sorted((Path(__file__).parents[1] / 'migrations').glob('*.sql'))
assert len(migrations) >= 2, 'Expected auth-state migration after initial schema'
sql = '\n'.join(path.read_text(encoding='utf-8') for path in migrations)
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.executescript(sql)
db.execute('PRAGMA foreign_keys = ON')

tables = {row['name'] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    'properties', 'property_media', 'profiles', 'agents', 'inquiries',
    'inquiry_media', 'line_followers', 'work_jobs', 'settings', 'audit_events',
    'media_upload_sessions',
}
assert required <= tables, f'Missing tables: {required - tables}'
session_columns = {row['name'] for row in db.execute('PRAGMA table_info(media_upload_sessions)')}
assert {'owner_id', 'created_by', 'expires_at', 'max_uploads', 'used_uploads'} <= session_columns
assert db.execute('SELECT COUNT(*) FROM properties').fetchone()[0] == 0, 'Do not seed legacy properties'
assert db.execute('SELECT COUNT(*) FROM profiles').fetchone()[0] == 0, 'Never seed staff roles from fixtures'
profile_columns = {row['name'] for row in db.execute('PRAGMA table_info(profiles)')}
assert {'auth_disabled', 'tokens_valid_after'} <= profile_columns, 'Auth state fields missing'

now = '2026-10-20T05:00:00.000Z'
def property_values(id, published, notes):
    return (id, f'CK-{id.upper()}', id, f'New listing {id}', 'land', 'sale', 123456.0,
            'สงขลา', 'หาดใหญ่', published, notes, now, now)

insert = """INSERT INTO properties
    (id,code,slug,title,property_type,status,price,province,district,published,internal_notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"""
db.execute(insert, property_values('new1', 1, 'PRIVATE internal note'))
db.execute(insert, property_values('new2', 0, 'UNPUBLISHED'))
try:
    db.execute("""INSERT INTO media_upload_sessions
        (id, owner_id, created_by, created_at, expires_at, max_uploads, used_uploads)
        VALUES ('s1', 'new1', 'staff', ?, ?, 1, 0)""", (now, now))
except sqlite3.IntegrityError:
    raise AssertionError('A valid upload session must be insertable')
try:
    db.execute("""INSERT INTO media_upload_sessions
        (id, owner_id, created_by, created_at, expires_at, max_uploads, used_uploads)
        VALUES ('s2', 'new1', 'staff', ?, ?, 21, 0)""", (now, now))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError('Upload session max_uploads must be bounded')
db.execute("DELETE FROM media_upload_sessions WHERE id = 's1'")
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
db.execute("INSERT INTO profiles (uid,full_name,created_at,updated_at) VALUES ('uid1','Staff test',?,?)", (now, now))
assert tuple(db.execute("SELECT role, auth_disabled, tokens_valid_after FROM profiles WHERE uid='uid1'").fetchone()) == ('USER', 0, 0), 'New user must start with USER role'
try:
    db.execute("UPDATE profiles SET role='SUPER_ADMIN' WHERE uid='uid1'")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError('Invalid staff role must be rejected by DB')
for sort, expected_index in [
    ('price ASC', 'idx_properties_live_price_asc'),
    ('price DESC', 'idx_properties_live_price_desc'),
    ('featured DESC', 'idx_properties_live_featured'),
]:
    plan = [r['detail'] for r in db.execute(
        f"EXPLAIN QUERY PLAN SELECT id FROM properties WHERE published=1 AND deleted_at IS NULL ORDER BY {sort}, created_at DESC, id DESC LIMIT 24"
    )]
    assert any(expected_index in line for line in plan), plan
    assert not any('TEMP B-TREE' in line for line in plan), plan

db.close()
print('OK: D1 fresh-start SQL creates expected tables, starts empty, bounds public queries and uses indexed ordering')
