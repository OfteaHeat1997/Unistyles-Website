-- ============================================================================
-- UNISTYLES CURACAO — E-COMMERCE DATABASE SCHEMA (v2)
-- PostgreSQL 16
-- ============================================================================
-- Ownership model:
--   * THIS FILE owns:      users, addresses, carts, orders, order_items,
--                          order_status_history, payments, coupons,
--                          coupon_redemptions, product_variants, reviews,
--                          delivery_zones, newsletter_subscribers, settings,
--                          whatsapp_messages
--   * DIRECTUS owns:       products, categories, brands, pages, customers,
--                          business_settings, homepage, directus_files
--                          (created by services/directus/bootstrap.js)
--
-- Both live in the SAME PostgreSQL database. This file never creates or drops
-- a Directus-owned table. Foreign keys that point at Directus tables are added
-- at the very end, guarded, so this file runs cleanly on a fresh database
-- BEFORE Directus has bootstrapped, and completes the links afterwards.
--
-- Run order on a fresh environment:
--   1) psql -f database/init.v2.sql          (core commerce schema)
--   2) node services/directus/bootstrap.js   (product catalog collections)
--   3) psql -f database/init.v2.sql          (idempotent re-run: adds catalog FKs)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- product/order text search
CREATE EXTENSION IF NOT EXISTS "citext";       -- case-insensitive email

-- ============================================================================
-- SHARED FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Collision-free order numbers. The previous RANDOM()-based trigger could
-- collide against the UNIQUE constraint and fail a live checkout.
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number = 'UNI-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                           LPAD((nextval('order_number_seq') % 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. USERS — customer accounts and the shop owner's admin login
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt, cost 12
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(20),
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,                     -- soft delete: keeps order history intact
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = TRUE;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. DELIVERY ZONES — Curacao delivery areas, fees, free-shipping thresholds
--    Declared before addresses/orders because both reference it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    fee             DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    free_threshold  DECIMAL(10,2) CHECK (free_threshold IS NULL OR free_threshold >= 0),
    estimated_days  VARCHAR(30) NOT NULL DEFAULT '1-2 business days',
    color           VARCHAR(7) DEFAULT '#27ae60',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    polygon         JSONB,                            -- GeoJSON, phase 2 map matching
    neighborhoods   JSONB NOT NULL DEFAULT '[]',      -- [{name, desc}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_slug   ON delivery_zones(slug);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = TRUE;
-- Supports the neighborhood lookup in orders.js / delivery.js
CREATE INDEX IF NOT EXISTS idx_delivery_zones_hoods  ON delivery_zones USING GIN (neighborhoods);

DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. ADDRESSES — saved address book (NOT the shipping address of an order)
-- ============================================================================
CREATE TABLE IF NOT EXISTS addresses (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label             VARCHAR(50) NOT NULL DEFAULT 'Home',
    recipient_name    VARCHAR(200),
    phone             VARCHAR(20),
    street            VARCHAR(255) NOT NULL,
    area              VARCHAR(100),
    city              VARCHAR(100) NOT NULL DEFAULT 'Willemstad',
    country           VARCHAR(50)  NOT NULL DEFAULT 'Curacao',
    landmark          TEXT,
    latitude          DECIMAL(10,7) CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    longitude         DECIMAL(10,7) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    delivery_zone_id  INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL,
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_zone ON addresses(delivery_zone_id);
-- At most one default address per customer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default
    ON addresses(user_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4. CARTS — server-side cart for logged-in users
--    Guest carts live in Redis (cart:<uuid>, TTL) and are merged in on login.
--    items JSONB shape: [{productId, variantId, quantity, size, color}]
--    Prices are NOT stored here — they are re-read from products at checkout.
-- ============================================================================
CREATE TABLE IF NOT EXISTS carts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    items       JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carts_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. COUPONS — discount codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS coupons (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code              VARCHAR(50) NOT NULL,
    description       TEXT,
    discount_type     VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage','fixed')),
    discount_value    DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount  DECIMAL(10,2) CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
    max_discount      DECIMAL(10,2) CHECK (max_discount IS NULL OR max_discount > 0),
    max_uses          INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
    max_uses_per_user INTEGER DEFAULT 1 CHECK (max_uses_per_user IS NULL OR max_uses_per_user > 0),
    times_used        INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
    valid_from        TIMESTAMPTZ,
    valid_until       TIMESTAMPTZ,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coupons_percentage_range CHECK (
        discount_type <> 'percentage' OR discount_value <= 100
    ),
    CONSTRAINT coupons_valid_window CHECK (
        valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from
    )
);

-- Codes are compared case-insensitively everywhere in the API.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_upper ON coupons(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, valid_until) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 6. ORDERS — the transaction record. Everything price-related is a snapshot.
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number        VARCHAR(20) NOT NULL UNIQUE,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = guest checkout

    -- Contact snapshot (filled for guests AND logged-in users so the order is
    -- self-contained if the account is later deleted)
    guest_email         VARCHAR(255),
    guest_phone         VARCHAR(20),
    guest_name          VARCHAR(200),

    status              VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','awaiting_payment','confirmed','processing',
                          'shipped','delivered','cancelled')),
    payment_method      VARCHAR(30) NOT NULL
        CHECK (payment_method IN ('cod','sentoo','bank_transfer','card','whatsapp')),
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending','pending_delivery','paid','failed',
                                  'refunded','expired','cancelled')),

    -- Money. All amounts in `currency`, snapshotted at purchase time.
    subtotal            DECIMAL(10,2) NOT NULL CHECK (subtotal     >= 0),
    delivery_fee        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    discount            DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount     >= 0),
    total               DECIMAL(10,2) NOT NULL CHECK (total        >= 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'XCG',

    -- Coupon: FK for reporting, code snapshotted so the order stays readable
    -- even if the coupon is deleted.
    coupon_id           UUID REFERENCES coupons(id) ON DELETE SET NULL,
    coupon_code         VARCHAR(50),

    -- Delivery snapshot. shipping_address is a frozen copy of the address as
    -- typed at checkout — it must NEVER be a foreign key to addresses.
    shipping_address    JSONB NOT NULL,
    delivery_zone_id    INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL,
    delivery_zone_name  VARCHAR(100),                  -- snapshot of the zone label
    delivery_lat        DECIMAL(10,7),
    delivery_lng        DECIMAL(10,7),
    delivery_date       DATE,
    delivery_time_slot  VARCHAR(50),

    notes               TEXT,                          -- customer note
    admin_notes         TEXT,                          -- internal, never returned to customers

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_total_matches CHECK (total = subtotal + delivery_fee - discount),
    CONSTRAINT orders_discount_within_subtotal CHECK (discount <= subtotal),
    -- A guest order must carry a way to reach the customer.
    CONSTRAINT orders_contactable CHECK (
        user_id IS NOT NULL OR guest_email IS NOT NULL OR guest_phone IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_number         ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user           ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_zone           ON orders(delivery_zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon         ON orders(coupon_id) WHERE coupon_id IS NOT NULL;
-- Admin dashboard: "open orders, newest first"
CREATE INDEX IF NOT EXISTS idx_orders_open
    ON orders(created_at DESC)
    WHERE status IN ('pending','awaiting_payment','confirmed','processing','shipped');

DROP TRIGGER IF EXISTS trg_orders_number ON orders;
CREATE TRIGGER trg_orders_number BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 7. ORDER ITEMS — line items, fully snapshotted
--    product_id / variant_id are reporting links only. Every field the customer
--    and the invoice need is copied here, so renaming, repricing or deleting a
--    product in Directus can never rewrite history.
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INTEGER,          -- FK to Directus products(id), added at end of file
    variant_id    UUID,             -- FK to product_variants(id), added at end of file

    -- Snapshot columns (NOT NULL: an order line is meaningless without them)
    product_name  VARCHAR(255) NOT NULL,
    product_sku   VARCHAR(50)  NOT NULL DEFAULT '',
    quantity      INTEGER      NOT NULL CHECK (quantity > 0),
    price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),   -- unit price at purchase
    size          VARCHAR(20),
    color         VARCHAR(50),
    image_url     VARCHAR(500),
    line_total    DECIMAL(10,2) GENERATED ALWAYS AS (price * quantity) STORED,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);

-- ============================================================================
-- 8. ORDER STATUS HISTORY — powers TrackOrder.jsx and the admin audit trail
--    Written automatically by trigger so no code path can forget it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    note        TEXT,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system/webhook
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
    ON order_status_history(order_id, created_at);

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, note)
        VALUES (NEW.id, NULL, NEW.status, 'Order created');
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_status_history_ins ON orders;
CREATE TRIGGER trg_order_status_history_ins AFTER INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

DROP TRIGGER IF EXISTS trg_order_status_history_upd ON orders;
CREATE TRIGGER trg_order_status_history_upd AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ============================================================================
-- 9. PAYMENTS — one row per payment attempt against an order
--    NO card data is ever stored. Sentoo holds the card; we keep an opaque
--    transaction id and the provider's own status payload.
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method            VARCHAR(30) NOT NULL
        CHECK (method IN ('cod','sentoo','bank_transfer','card','whatsapp')),
    provider          VARCHAR(50),                  -- 'sentoo', 'manual', NULL for COD
    status            VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','pending_delivery','paid','failed',
                          'refunded','expired','cancelled')),
    amount            DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency          VARCHAR(3) NOT NULL DEFAULT 'XCG',
    transaction_id    VARCHAR(255),                 -- provider reference, opaque
    provider_response JSONB,                        -- provider status payload, no PAN/CVV
    failure_reason    TEXT,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
-- The Sentoo webhook looks a payment up by transaction_id; it must be unique
-- and fast, otherwise a replayed webhook can hit the wrong row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction
    ON payments(transaction_id) WHERE transaction_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. COUPON REDEMPTIONS — who used which code, on which order
--     Without this, "10% off your FIRST order" cannot be enforced.
-- ============================================================================
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id     UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_email   VARCHAR(255),                    -- guest checkout identity
    amount_saved  DECIMAL(10,2) NOT NULL CHECK (amount_saved >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coupon_redemptions_one_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user   ON coupon_redemptions(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_email  ON coupon_redemptions(coupon_id, LOWER(guest_email));

-- ============================================================================
-- 11. PRODUCT VARIANTS — size/colour SKUs for bras, panties and shapewear
--     product_id is INTEGER to match Directus products.id.
--     When a product has variants, THE VARIANT owns the stock, not the product.
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id       INTEGER NOT NULL,             -- FK added at end of file
    size             VARCHAR(20),
    color            VARCHAR(50),
    sku              VARCHAR(50),
    stock_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_sku
    ON product_variants(sku) WHERE sku IS NOT NULL;
-- One row per product+size+colour combination.
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_combo
    ON product_variants(product_id, COALESCE(size,''), COALESCE(color,''));

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 12. REVIEWS — product ratings
--     product_id is INTEGER (was UUID, which the API could never satisfy).
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id   INTEGER NOT NULL,                 -- FK added at end of file
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title        VARCHAR(200),
    comment      TEXT CHECK (comment IS NULL OR length(comment) <= 2000),
    is_verified  BOOLEAN NOT NULL DEFAULT FALSE,   -- bought it in a delivered order
    is_approved  BOOLEAN NOT NULL DEFAULT FALSE,   -- moderation gate
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce "one review per product per customer" in the database, not only in
-- application code (the code check has a race window).
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_user
    ON reviews(product_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_product_public
    ON reviews(product_id) WHERE is_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 13. NEWSLETTER SUBSCRIBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT NOT NULL UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    source          VARCHAR(50),                   -- 'footer', 'checkout', ...
    subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    CONSTRAINT newsletter_inactive_has_date CHECK (
        is_active = TRUE OR unsubscribed_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active)
    WHERE is_active = TRUE;

-- ============================================================================
-- 14. SETTINGS — operational key/value settings read by the API
--     Branding and marketing copy belong in Directus business_settings.
--     This table is only for values the API itself must read inside a
--     transaction (e.g. free_delivery_threshold during checkout).
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 15. WHATSAPP MESSAGES — order notification log / inbound webhook log
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direction        VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    phone            VARCHAR(20) NOT NULL,
    wamid            VARCHAR(255),                 -- WhatsApp message id
    message_type     VARCHAR(20) NOT NULL DEFAULT 'text',
    content          TEXT,
    template_name    VARCHAR(100),
    status           VARCHAR(20) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('queued','sent','delivered','read','failed')),
    status_timestamp TIMESTAMPTZ,
    order_id         UUID REFERENCES orders(id) ON DELETE SET NULL,
    metadata         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone   ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_order   ON whatsapp_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at DESC);
-- Meta redelivers webhooks; a unique wamid makes ingestion idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_wamid
    ON whatsapp_messages(wamid) WHERE wamid IS NOT NULL;

-- ============================================================================
-- 16. SEED DATA
-- ============================================================================

-- Admin account. CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.
INSERT INTO users (email, password_hash, first_name, last_name, is_admin, is_verified)
VALUES ('admin@unistylescuracao.com',
        '$2a$12$X1HG4kDGkCFrVOjEAv0lyuqNZo8HhinhkU/eXKHw.jIpu9ZoIKC/a',
        'Admin', 'Unistyles', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Operational settings the API reads directly.
INSERT INTO settings (key, value) VALUES
    ('store_currency',          '"XCG"'),
    ('free_delivery_threshold', '80'),
    ('payment_methods',         '["cod","sentoo","bank_transfer","whatsapp"]'),
    ('max_cart_items',          '50'),
    ('max_item_quantity',       '10')
ON CONFLICT (key) DO NOTHING;

-- Delivery zones (real Curacao fuel/labour cost basis, April 2026).
INSERT INTO delivery_zones (slug, name, fee, free_threshold, estimated_days, color, sort_order, neighborhoods) VALUES
('zone-1-centro', 'Zone 1 — Centro', 5, 75, '1-2 business days', '#27ae60', 1,
 '[{"name":"Willemstad","desc":"City center, Handelskade, Sha Caprileskade"},
   {"name":"Punda","desc":"Fort Amsterdam, Waterfort, Floating Market area"},
   {"name":"Otrobanda","desc":"Brionplein, Breedestraat, Renaissance area"},
   {"name":"Pietermaai","desc":"Pietermaai District, historic quarter"},
   {"name":"Scharloo","desc":"Scharloo Abou, museum district"}]'::jsonb),
('zone-2-east', 'Zone 2 — East', 10, 100, '1-2 business days', '#e67e22', 2,
 '[{"name":"Jan Thiel","desc":"Jan Thiel Beach, Papagayo, Spanish Water area"},
   {"name":"Blue Bay","desc":"Blue Bay Golf & Beach Resort area"},
   {"name":"Cas Grandi","desc":"Residential area east of Willemstad"},
   {"name":"Santa Rosa","desc":"Santa Rosa, Mahaai, Salinja area"},
   {"name":"Saliña","desc":"Saliña shopping district"},
   {"name":"Mahaai","desc":"Mahaai residential"}]'::jsonb),
('zone-3-west-north', 'Zone 3 — West & North', 25, 150, '2-3 business days', '#c0392b', 3,
 '[{"name":"Banda Abou","desc":"Westpunt, Lagun, Jeremi, Santa Cruz, Barber"},
   {"name":"Banda Ariba","desc":"Fuik, Sint Joris, Brievengat, Hato area"},
   {"name":"Tera Kòrá","desc":"Northern residential neighborhoods"},
   {"name":"Groot Kwartier","desc":"Emmastad, Julianadorp area"},
   {"name":"Brievengat","desc":"Brievengat residential"},
   {"name":"Suffisant","desc":"Suffisant residential"}]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Launch coupons.
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_uses_per_user, valid_until) VALUES
('WELCOME10', '10% off your first order',        'percentage', 10, 30, 1, NOW() + INTERVAL '1 year'),
('BEAUTY20',  'XCG 20 off beauty products',      'fixed',      20, 80, 1, NOW() + INTERVAL '6 months'),
('FREESHIP',  'XCG 10 off, covers Zone 1-2 fee', 'fixed',      10,  0, 1, NOW() + INTERVAL '3 months')
ON CONFLICT (UPPER(code)) DO NOTHING;

-- ============================================================================
-- 17. CATALOG LINKS — foreign keys into the Directus-owned tables
--     Skipped silently when Directus has not bootstrapped yet, so this file
--     runs on an empty database. Re-run after bootstrap to complete the links.
-- ============================================================================
DO $$
BEGIN
    IF to_regclass('public.products') IS NULL THEN
        RAISE NOTICE 'Directus products table not found — catalog foreign keys skipped. Run services/directus/bootstrap.js, then re-run this file.';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_product') THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_product
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_variant') THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_variant
            FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_variants_product') THEN
        ALTER TABLE product_variants
            ADD CONSTRAINT fk_product_variants_product
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_product') THEN
        ALTER TABLE reviews
            ADD CONSTRAINT fk_reviews_product
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;

    RAISE NOTICE 'Catalog foreign keys installed.';
END
$$;

-- Catalog query support (skipped if Directus has not run yet).
DO $$
BEGIN
    IF to_regclass('public.products') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(slug);
        CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_brand     ON products(brand_id);
        CREATE INDEX IF NOT EXISTS idx_products_in_stock  ON products(in_stock) WHERE in_stock = TRUE;
        CREATE INDEX IF NOT EXISTS idx_products_featured  ON products(featured) WHERE featured = TRUE;
        CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
    END IF;
    IF to_regclass('public.categories') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    END IF;
    IF to_regclass('public.brands') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
    END IF;
END
$$;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
