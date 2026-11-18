-- Assigned public agent contacts are part of catalog responses. Invalidate
-- cached lists/details atomically when an agent changes, including direct SQL.
CREATE TRIGGER catalog_agents_insert AFTER INSERT ON agents
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_agents_update AFTER UPDATE ON agents
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_agents_delete AFTER DELETE ON agents
BEGIN
  UPDATE catalog_generation SET version = lower(hex(randomblob(16))) WHERE id = 1;
END;
