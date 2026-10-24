-- Account-state flags for the D1 authorization bridge.
-- Authority MUST be written by trusted admin-only migration/service code.
-- Existing or missing roles always default to USER in the prior migration.
ALTER TABLE profiles ADD COLUMN auth_disabled INTEGER NOT NULL DEFAULT 0 CHECK(auth_disabled IN (0, 1));
ALTER TABLE profiles ADD COLUMN tokens_valid_after INTEGER NOT NULL DEFAULT 0 CHECK(tokens_valid_after >= 0);
