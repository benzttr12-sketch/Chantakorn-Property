-- Short-lived, property-scoped upload intents. An ADMIN creates a session for a
-- draft, and the Worker consumes one slot per accepted property photo. Rows are
-- deleted opportunistically after expiry; they carry no image bytes or tokens.
CREATE TABLE IF NOT EXISTS media_upload_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_uploads INTEGER NOT NULL CHECK (max_uploads BETWEEN 1 AND 20),
  used_uploads INTEGER NOT NULL DEFAULT 0 CHECK (used_uploads BETWEEN 0 AND max_uploads)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_scope
  ON media_upload_sessions(owner_id, created_by, expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_expiry
  ON media_upload_sessions(expires_at);
