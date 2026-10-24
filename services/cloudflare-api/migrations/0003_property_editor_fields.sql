-- Preserve the fields already used by the Chantakorn Property editor.
-- Soft deletion deliberately preserves historical references, inquiry/media records and auditability.
ALTER TABLE properties ADD COLUMN deleted_at TEXT;
ALTER TABLE properties ADD COLUMN year_built INTEGER;
ALTER TABLE properties ADD COLUMN furniture TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN facing_direction TEXT;
ALTER TABLE properties ADD COLUMN feng_shui_json TEXT;
ALTER TABLE properties ADD COLUMN video_url TEXT;
ALTER TABLE properties ADD COLUMN videos_json TEXT NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_properties_live_published ON properties(published, deleted_at, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_properties_admin_updated ON properties(deleted_at, updated_at DESC, id DESC);
