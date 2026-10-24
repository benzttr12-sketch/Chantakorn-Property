-- Ordering indexes bound the common paginated sorts; substring filters may still scan.
CREATE INDEX idx_properties_live_price_asc ON properties(published, deleted_at, price ASC, created_at DESC, id DESC);
CREATE INDEX idx_properties_live_price_desc ON properties(published, deleted_at, price DESC, created_at DESC, id DESC);
CREATE INDEX idx_properties_live_featured ON properties(published, deleted_at, featured DESC, created_at DESC, id DESC);
