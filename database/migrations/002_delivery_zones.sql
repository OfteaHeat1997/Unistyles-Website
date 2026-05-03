-- ===========================================
-- MIGRATION 002 — Delivery Zones
-- ===========================================
-- Single source of truth for delivery zones, fees, ETA and neighborhoods.
-- Fees calculated from real Curaçao costs (April 2026):
--   - Gasoline: ANG 2.15/L (GlobalPetrolPrices)
--   - Vehicle wear: ~ANG 0.30/km
--   - Driver labor: ANG 15/hour
-- Customer pays roughly 50-60% of real cost; product margin covers the rest.
-- Each zone keeps its own free-shipping threshold so far zones don't bleed money.
-- ===========================================

CREATE TABLE IF NOT EXISTS delivery_zones (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    fee             DECIMAL(10,2) NOT NULL DEFAULT 0,
    free_threshold  DECIMAL(10,2),                  -- per-zone override (NULL = use global setting)
    estimated_days  VARCHAR(30) NOT NULL DEFAULT '1-2 business days',
    color           VARCHAR(7) DEFAULT '#27ae60',
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    polygon         JSONB,                          -- GeoJSON polygon (Phase 2)
    neighborhoods   JSONB NOT NULL DEFAULT '[]',    -- [{name, desc}]
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_slug   ON delivery_zones(slug);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);

-- Add zone reference + coordinates to orders (nullable for backward compat)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(10,7);

CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(delivery_zone_id);

-- Seed the 3 zones with market-realistic fees
INSERT INTO delivery_zones (slug, name, fee, free_threshold, estimated_days, color, sort_order, neighborhoods) VALUES
('zone-1-centro', 'Zone 1 — Centro', 5, 75, '1-2 business days', '#27ae60', 1,
 '[
    {"name": "Willemstad", "desc": "City center, Handelskade, Sha Caprileskade"},
    {"name": "Punda",      "desc": "Fort Amsterdam, Waterfort, Floating Market area"},
    {"name": "Otrobanda",  "desc": "Brionplein, Breedestraat, Renaissance area"},
    {"name": "Pietermaai", "desc": "Pietermaai District, historic quarter"},
    {"name": "Scharloo",   "desc": "Scharloo Abou, museum district"}
  ]'::jsonb),

('zone-2-east', 'Zone 2 — East', 10, 100, '1-2 business days', '#e67e22', 2,
 '[
    {"name": "Jan Thiel",   "desc": "Jan Thiel Beach, Papagayo, Spanish Water area"},
    {"name": "Blue Bay",    "desc": "Blue Bay Golf & Beach Resort area"},
    {"name": "Cas Grandi",  "desc": "Residential area east of Willemstad"},
    {"name": "Santa Rosa",  "desc": "Santa Rosa, Mahaai, Salinja area"},
    {"name": "Saliña",      "desc": "Saliña shopping district"},
    {"name": "Mahaai",      "desc": "Mahaai residential"}
  ]'::jsonb),

('zone-3-west-north', 'Zone 3 — West & North', 25, 150, '2-3 business days', '#c0392b', 3,
 '[
    {"name": "Banda Abou",     "desc": "Westpunt, Lagun, Jeremi, Santa Cruz, Barber"},
    {"name": "Banda Ariba",    "desc": "Fuik, Sint Joris, Brievengat, Hato area"},
    {"name": "Tera Kòrá",      "desc": "Northern residential neighborhoods"},
    {"name": "Groot Kwartier", "desc": "Emmastad, Julianadorp area"},
    {"name": "Brievengat",     "desc": "Brievengat residential"},
    {"name": "Suffisant",      "desc": "Suffisant residential"}
  ]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Make sure the global free-shipping threshold setting exists (used as fallback when zone has none)
INSERT INTO settings (key, value) VALUES ('free_delivery_threshold', '80')
ON CONFLICT (key) DO NOTHING;
