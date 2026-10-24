-- Accepted property-photo uploads are recorded so the Worker can enforce a
-- bounded per-staff hourly rate before touching R2. Events carry sizes only.
CREATE TABLE IF NOT EXISTS media_upload_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  staff_uid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'property'),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_media_upload_events_staff_time
  ON media_upload_events(staff_uid, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_media_upload_events_owner_time
  ON media_upload_events(owner_id, created_at);
