-- ===========================================
-- MIGRATION 003 — Address geocoding
-- ===========================================
-- Stores lat/lng + delivery_zone_id on the customer's saved addresses,
-- populated when the autocomplete (Nominatim) returns a chosen suggestion.
-- ===========================================

ALTER TABLE addresses
    ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_zone ON addresses(delivery_zone_id);
