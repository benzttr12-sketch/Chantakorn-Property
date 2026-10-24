import { asc, desc } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Keep this declaration aligned with migrations/0001_initial.sql.
// New D1 databases start with ZERO properties by design. No demo seed is deployed.
export const profiles = sqliteTable('profiles', {
  uid: text('uid').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  role: text('role', { enum: ['USER', 'AGENT', 'ADMIN'] }).notNull().default('USER'),
  authDisabled: integer('auth_disabled', { mode: 'boolean' }).notNull().default(false),
  tokensValidAfter: integer('tokens_valid_after').notNull().default(0),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_profiles_role').on(table.role)]);

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  uid: text('uid').references(() => profiles.uid, { onDelete: 'set null' }),
  name: text('name').notNull(),
  title: text('title').notNull().default('นายหน้า'),
  phone: text('phone'),
  lineId: text('line_id'),
  facebook: text('facebook'),
  email: text('email'),
  photoUrl: text('photo_url'),
  bio: text('bio'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_agents_public').on(table.isPublic, table.name)]);

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  propertyType: text('property_type', { enum: ['house', 'land', 'condo', 'commercial', 'investment', 'consignment'] }).notNull(),
  status: text('status', { enum: ['sale', 'rent'] }).notNull(),
  price: real('price').notNull(),
  province: text('province').notNull(),
  district: text('district').notNull(),
  subdistrict: text('subdistrict'),
  address: text('address'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  bedrooms: integer('bedrooms').notNull().default(0),
  bathrooms: integer('bathrooms').notNull().default(0),
  parking: integer('parking').notNull().default(0),
  landSize: real('land_size').notNull().default(0),
  usableArea: real('usable_area').notNull().default(0),
  featuresJson: text('features_json').notNull().default('[]'),
  coverImage: text('cover_image'),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at'),
  yearBuilt: integer('year_built'),
  furniture: text('furniture').notNull().default(''),
  facingDirection: text('facing_direction'),
  fengShuiJson: text('feng_shui_json'),
  videoUrl: text('video_url'),
  videosJson: text('videos_json').notNull().default('[]'),
  internalNotes: text('internal_notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_properties_public_newest').on(table.published, table.createdAt, table.id),
  index('idx_properties_public_location').on(table.published, table.province, table.district, table.createdAt),
  index('idx_properties_public_type_price').on(table.published, table.propertyType, table.status, table.price),
  index('idx_properties_public_price').on(table.published, table.price),
  index('idx_properties_live_published').on(table.published, table.deletedAt, table.createdAt, table.id),
  index('idx_properties_live_price_asc').on(table.published, table.deletedAt, asc(table.price), desc(table.createdAt), desc(table.id)),
  index('idx_properties_live_price_desc').on(table.published, table.deletedAt, desc(table.price), desc(table.createdAt), desc(table.id)),
  index('idx_properties_live_featured').on(table.published, table.deletedAt, desc(table.featured), desc(table.createdAt), desc(table.id)),
  index('idx_properties_admin_updated').on(table.deletedAt, table.updatedAt, table.id),
]);

export const propertyMedia = sqliteTable('property_media', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull().unique(),
  publicUrl: text('public_url').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_property_media_listing').on(table.propertyId, table.sortOrder)]);

export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
  propertyTitle: text('property_title'),
  name: text('name').notNull(),
  phone: text('phone'),
  lineId: text('line_id'),
  message: text('message').notNull().default(''),
  inquiryType: text('inquiry_type').notNull().default('inquiry'),
  status: text('status', { enum: ['new','contacted','scheduled','closed'] }).notNull().default('new'),
  source: text('source'),
  consignmentJson: text('consignment_json'),
  lineNoticeState: text('line_notice_state'),
  lineNoticeUntil: integer('line_notice_until'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_inquiries_status').on(table.status, table.createdAt)]);

export const inquiryMedia = sqliteTable('inquiry_media', {
  id: text('id').primaryKey(),
  inquiryId: text('inquiry_id').notNull().references(() => inquiries.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_inquiry_media_owner').on(table.inquiryId)]);

/** Temporary, property-scoped photo upload intents (see migration 0006). */
export const mediaUploadSessions = sqliteTable('media_upload_sessions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  maxUploads: integer('max_uploads').notNull(),
  usedUploads: integer('used_uploads').notNull().default(0),
}, (table) => [
  index('idx_media_upload_sessions_scope').on(table.ownerId, table.createdBy, table.expiresAt),
  index('idx_media_upload_sessions_expiry').on(table.expiresAt),
]);

export const lineFollowers = sqliteTable('line_followers', {
  userId: text('user_id').primaryKey(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  followedAt: text('followed_at').notNull(),
  lastActiveAt: text('last_active_at').notNull(),
  source: text('source'),
}, (table) => [index('idx_line_followers_active').on(table.isActive, table.lastActiveAt)]);

export const workJobs = sqliteTable('work_jobs', {
  id: text('id').primaryKey(),
  jobCode: text('job_code').notNull().unique(),
  title: text('title').notNull(),
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
  inquiryId: text('inquiry_id').references(() => inquiries.id, { onDelete: 'set null' }),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  status: text('status', { enum: ['active','completed','on_hold'] }).notNull().default('active'),
  assignedAgent: text('assigned_agent'),
  phasesJson: text('phases_json').notNull().default('[]'),
  currentPhaseNumber: integer('current_phase_number').notNull().default(1),
  totalPhases: integer('total_phases').notNull().default(7),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_work_jobs_active').on(table.status, table.updatedAt)]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  action: text('action').notNull(),
  actorUid: text('actor_uid'),
  targetId: text('target_id'),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_audit_events_time').on(table.createdAt)]);

// A singleton invalidation token; SQL triggers maintain it inside catalog writes.
export const catalogGeneration = sqliteTable('catalog_generation', {
  id: integer('id').primaryKey(),
  version: text('version').notNull(),
});
