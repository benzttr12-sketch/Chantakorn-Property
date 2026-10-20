-- Chantakorn Property D1: fresh deployment, NEVER import legacy properties.
-- This is a new database schema. Do not run it against the legacy Firestore data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  uid TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','AGENT','ADMIN')),
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  uid TEXT REFERENCES profiles(uid) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'นายหน้า',
  phone TEXT,
  line_id TEXT,
  facebook TEXT,
  email TEXT,
  photo_url TEXT,
  bio TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public, name);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL CHECK(property_type IN ('house','land','condo','commercial','investment','consignment')),
  status TEXT NOT NULL CHECK(status IN ('sale','rent')),
  price REAL NOT NULL CHECK(price >= 0),
  province TEXT NOT NULL,
  district TEXT NOT NULL,
  subdistrict TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  parking INTEGER NOT NULL DEFAULT 0,
  land_size REAL NOT NULL DEFAULT 0,
  usable_area REAL NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL DEFAULT '[]',
  cover_image TEXT,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  internal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_properties_public_newest ON properties(published, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_properties_public_location ON properties(published, province, district, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_public_type_price ON properties(published, property_type, status, price);
CREATE INDEX IF NOT EXISTS idx_properties_public_price ON properties(published, price);

CREATE TABLE IF NOT EXISTS property_media (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_property_media_listing ON property_media(property_id, sort_order);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  property_title TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  line_id TEXT,
  message TEXT NOT NULL DEFAULT '',
  inquiry_type TEXT NOT NULL DEFAULT 'inquiry',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','scheduled','closed')),
  source TEXT,
  consignment_json TEXT,
  line_notice_state TEXT,
  line_notice_until INTEGER,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_media (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiry_media_owner ON inquiry_media(inquiry_id);

CREATE TABLE IF NOT EXISTS line_followers (
  user_id TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  followed_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_line_followers_active ON line_followers(is_active, last_active_at);

CREATE TABLE IF NOT EXISTS work_jobs (
  id TEXT PRIMARY KEY,
  job_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','on_hold')),
  assigned_agent TEXT,
  phases_json TEXT NOT NULL DEFAULT '[]',
  current_phase_number INTEGER NOT NULL DEFAULT 1,
  total_phases INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_jobs_active ON work_jobs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_uid TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(created_at DESC);
