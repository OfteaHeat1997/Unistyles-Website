-- ===========================================
-- MIGRATION 004 — Roles, pickup/delivery fulfillment, payment integrity,
-- inventory audit trail.
-- ===========================================
-- Applies on top of init.v2.sql (and is tolerant of a v1 database: every
-- statement is guarded with IF [NOT] EXISTS). Business values seeded here are
-- DEFAULTS PENDING OWNER APPROVAL — they are editable in Admin → Settings.
-- See docs/PROMPT-FULL-IMPLEMENTATION.md §4 and §7.
-- ===========================================

-- -------------------------------------------
-- 1. USERS.ROLE  (customer | admin | driver)
--    is_admin is kept in sync for older code paths.
-- -------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_valid') THEN
        ALTER TABLE users ADD CONSTRAINT users_role_valid
            CHECK (role IN ('customer','admin','driver'));
    END IF;
END $$;

UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND role <> 'admin';

CREATE OR REPLACE FUNCTION sync_user_is_admin()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_admin = (NEW.role = 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_sync_admin ON users;
CREATE TRIGGER trg_users_sync_admin BEFORE INSERT OR UPDATE OF role ON users
    FOR EACH ROW EXECUTE FUNCTION sync_user_is_admin();

-- -------------------------------------------
-- 2. PICKUP LOCATIONS, SLOTS, BLOCKED DATES
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_locations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    address       VARCHAR(255) NOT NULL,
    latitude      DECIMAL(10,7),
    longitude     DECIMAL(10,7),
    hours         VARCHAR(200),
    instructions  TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fulfillment_slots (
    id          SERIAL PRIMARY KEY,
    method      VARCHAR(10) NOT NULL CHECK (method IN ('pickup','delivery')),
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    capacity    INTEGER NOT NULL DEFAULT 8 CHECK (capacity >= 0),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fulfillment_slots_window CHECK (end_time > start_time)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_slots_unique
    ON fulfillment_slots(method, weekday, start_time);

CREATE TABLE IF NOT EXISTS blocked_dates (
    id          SERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    method      VARCHAR(10) CHECK (method IS NULL OR method IN ('pickup','delivery')),  -- NULL = both
    reason      VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_dates_unique ON blocked_dates(date, COALESCE(method, ''));

-- -------------------------------------------
-- 3. ORDERS — fulfillment, tracking, idempotency, driver, payment expiry
-- -------------------------------------------
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_method   VARCHAR(10) NOT NULL DEFAULT 'delivery',
    ADD COLUMN IF NOT EXISTS pickup_location_id   INTEGER REFERENCES pickup_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fulfillment_slot_id  INTEGER REFERENCES fulfillment_slots(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tracking_token       VARCHAR(32),
    ADD COLUMN IF NOT EXISTS idempotency_key      VARCHAR(64),
    ADD COLUMN IF NOT EXISTS assigned_driver_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_expires_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS needs_review         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_zone_name   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS coupon_id            UUID,
    ADD COLUMN IF NOT EXISTS coupon_code          VARCHAR(50),
    ADD COLUMN IF NOT EXISTS admin_notes          TEXT,
    ADD COLUMN IF NOT EXISTS currency             VARCHAR(3) NOT NULL DEFAULT 'XCG';

-- Pickup orders have no shipping address.
ALTER TABLE orders ALTER COLUMN shipping_address DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token) WHERE tracking_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency    ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_slot_occupancy
    ON orders(delivery_date, fulfillment_slot_id)
    WHERE status NOT IN ('cancelled','expired');
CREATE INDEX IF NOT EXISTS idx_orders_payment_expiry
    ON orders(payment_expires_at) WHERE status = 'awaiting_payment';
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;

-- Legacy 'shipped' now means 'out_for_delivery'.
DO $$
DECLARE c RECORD;
BEGIN
    -- Drop every CHECK on orders.status / orders.payment_status, whatever it was named (v1 or v2).
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'orders'::regclass AND con.contype = 'c'
          AND att.attname IN ('status','payment_status','fulfillment_method')
    LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

UPDATE orders SET status = 'out_for_delivery' WHERE status = 'shipped';

ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN (
    'pending','awaiting_payment','confirmed','processing',
    'ready_for_pickup','picked_up','out_for_delivery','delivered',
    'delivery_failed','returned','cancelled','expired'));
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_valid CHECK (payment_status IN (
    'pending','pending_delivery','paid','failed','refunded','partially_refunded','expired','cancelled'));
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_valid CHECK (fulfillment_method IN ('delivery','pickup'));
ALTER TABLE orders ADD CONSTRAINT orders_delivery_has_address CHECK (
    fulfillment_method = 'pickup' OR shipping_address IS NOT NULL);

-- Same widening for payments.status
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'payments'::regclass AND con.contype = 'c' AND att.attname = 'status'
    LOOP
        EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS provider       VARCHAR(50),
    ADD COLUMN IF NOT EXISTS currency       VARCHAR(3) NOT NULL DEFAULT 'XCG',
    ADD COLUMN IF NOT EXISTS failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS paid_at        TIMESTAMPTZ;
ALTER TABLE payments ADD CONSTRAINT payments_status_valid CHECK (status IN (
    'pending','pending_delivery','paid','failed','refunded','partially_refunded','expired','cancelled'));

-- Status history: who changed it and why (v1 databases do not have the table yet).
CREATE TABLE IF NOT EXISTS order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    note        TEXT,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at);

-- The application sets app.user_id / app.status_note with SET LOCAL inside the
-- transaction; the trigger records them so no code path can forget the audit row.
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user UUID := NULLIF(current_setting('app.user_id', true), '')::UUID;
    v_note TEXT := NULLIF(current_setting('app.status_note', true), '');
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by)
        VALUES (NEW.id, NULL, NEW.status, COALESCE(v_note, 'Order created'), v_user);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, v_note, v_user);
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

-- -------------------------------------------
-- 4. PAYMENT EVENTS, REFUNDS
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
    id               BIGSERIAL PRIMARY KEY,
    payment_id       UUID REFERENCES payments(id) ON DELETE CASCADE,
    order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
    source           VARCHAR(20) NOT NULL CHECK (source IN ('webhook','poll','admin','system','mock')),
    provider_status  VARCHAR(30),
    result           VARCHAR(30),          -- what we did: marked_paid, ignored_already_paid, amount_mismatch, ...
    payload          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS refunds (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_id  UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount      DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason      TEXT NOT NULL,
    method      VARCHAR(30) NOT NULL,      -- sentoo_dashboard, cash, bank_transfer
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

-- -------------------------------------------
-- 5. DELIVERY ATTEMPTS (driver app)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_attempts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    outcome         VARCHAR(20) NOT NULL CHECK (outcome IN ('delivered','failed','picked_up')),
    reason          VARCHAR(50),
    recipient_name  VARCHAR(200),
    note            TEXT,
    cod_collected   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_order ON delivery_attempts(order_id, created_at);

-- -------------------------------------------
-- 6. INVENTORY MOVEMENTS — every stock change, from any channel
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
    id          BIGSERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL,
    variant_id  UUID,
    delta       INTEGER NOT NULL CHECK (delta <> 0),
    reason      VARCHAR(30) NOT NULL CHECK (reason IN (
                    'order','order_cancelled','payment_expired','restock',
                    'manual_sale','whatsapp_sale','correction','return')),
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    note        TEXT,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order   ON inventory_movements(order_id);

-- -------------------------------------------
-- 7. COUPON REDEMPTIONS (v1 databases lack it)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id     UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_email   VARCHAR(255),
    amount_saved  DECIMAL(10,2) NOT NULL CHECK (amount_saved >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coupon_redemptions_one_per_order UNIQUE (order_id)
);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1;

-- -------------------------------------------
-- 8. SEED DEFAULTS (pending approval)
-- -------------------------------------------
INSERT INTO settings (key, value) VALUES
    ('free_delivery_threshold',     '80'),
    ('free_delivery_rule',          '"gte"'),
    ('pickup_enabled',              'true'),
    ('delivery_enabled',            'true'),
    ('delivery_cutoff_hour',        '14'),
    ('booking_days_ahead',          '7'),
    ('payment_expiry_minutes',      '30'),
    ('bank_transfer_expiry_hours',  '48'),
    ('payment_methods',             '["cod","sentoo","bank_transfer","whatsapp"]'),
    ('support_whatsapp',            '"59996736285"'),
    ('bank_details',                '{"bankName":"MCB Bank Curacao","accountName":"Unistyles Curacao","accountNumber":"PENDING","swift":"MCBKCWCU"}'),
    ('return_policy',               '{"default":"Returns within 7 days for unused items in original packaging.","panties":"For hygiene reasons panties can only be reported within 48 hours if defective."}'),
    ('pending_approval',            '["free_delivery_threshold","free_delivery_rule","delivery_cutoff_hour","payment_expiry_minutes","support_whatsapp","bank_details","return_policy","zones","slots"]')
ON CONFLICT (key) DO NOTHING;

INSERT INTO pickup_locations (name, address, latitude, longitude, hours, instructions)
SELECT 'Unistyles Showroom', 'Willemstad, Curaçao (address pending approval)', 12.1091, -68.9316,
       'Mon–Fri 9:00–18:00, Sat 10:00–16:00', 'Bring your order number. We message you on WhatsApp when it is ready.'
WHERE NOT EXISTS (SELECT 1 FROM pickup_locations);

-- Mon(1)..Sat(6): delivery 10–13 and 14–18 (8 each); pickup 10–13, 14–17 (10 each)
INSERT INTO fulfillment_slots (method, weekday, start_time, end_time, capacity)
SELECT m.method, d.weekday, w.start_time, w.end_time, w.capacity
FROM (VALUES (1),(2),(3),(4),(5),(6)) AS d(weekday)
CROSS JOIN (VALUES ('delivery'),('pickup')) AS m(method)
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        ('delivery', TIME '10:00', TIME '13:00', 8),
        ('delivery', TIME '14:00', TIME '18:00', 8),
        ('pickup',   TIME '10:00', TIME '13:00', 10),
        ('pickup',   TIME '14:00', TIME '17:00', 10)
    ) AS v(method, start_time, end_time, capacity)
    WHERE v.method = m.method
) AS w
ON CONFLICT DO NOTHING;

-- Server-side zone polygons (GeoJSON, [lng, lat]) — mirrors frontend data/curacaoZones.js
UPDATE delivery_zones SET polygon = '{"type":"Polygon","coordinates":[[[-68.965,12.135],[-68.910,12.135],[-68.895,12.115],[-68.890,12.085],[-68.940,12.080],[-68.965,12.100],[-68.965,12.135]]]}'::jsonb
 WHERE slug = 'zone-1-centro' AND polygon IS NULL;
UPDATE delivery_zones SET polygon = '{"type":"Polygon","coordinates":[[[-68.910,12.135],[-68.825,12.140],[-68.785,12.080],[-68.830,12.045],[-68.890,12.080],[-68.895,12.115],[-68.910,12.135]]]}'::jsonb
 WHERE slug = 'zone-2-east' AND polygon IS NULL;
UPDATE delivery_zones SET polygon = '{"type":"MultiPolygon","coordinates":[[[[-69.165,12.385],[-68.985,12.395],[-68.965,12.140],[-68.965,12.135],[-68.965,12.100],[-68.985,12.080],[-69.080,12.085],[-69.170,12.155],[-69.165,12.385]]],[[[-68.785,12.080],[-68.745,12.095],[-68.745,12.045],[-68.830,12.045],[-68.785,12.080]]]]}'::jsonb
 WHERE slug = 'zone-3-west-north' AND polygon IS NULL;
