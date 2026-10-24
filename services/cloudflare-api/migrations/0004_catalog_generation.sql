-- Cache generation is changed in the same transaction as every catalog mutation.
CREATE TABLE catalog_generation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO catalog_generation (id, version) VALUES (1, lower(hex(randomblob(16))));
--> statement-breakpoint
CREATE TRIGGER catalog_properties_insert AFTER INSERT ON properties
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_properties_update AFTER UPDATE ON properties
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_properties_delete AFTER DELETE ON properties
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_property_media_insert AFTER INSERT ON property_media
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_property_media_update AFTER UPDATE ON property_media
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_property_media_delete AFTER DELETE ON property_media
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
