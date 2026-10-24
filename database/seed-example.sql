-- ============================================================================
-- UNISTYLES CURACAO — EXAMPLE SEED DATA
-- ============================================================================
-- A small, fully connected dataset showing how every entity links together:
--   1 customer · 1 address · 3 categories · 1 brand · 1 product ·
--   3 variants · 1 cart · 1 order (2 lines) · 1 payment · 1 coupon redemption ·
--   1 review · 1 WhatsApp notification
--
-- DEVELOPMENT DATABASES ONLY. Seeding demo orders into production corrupts
-- your sales figures. Run against $DEV_DATABASE_URL, never $DATABASE_URL.
--
--   psql "$DEV_DATABASE_URL" -f database/seed-example.sql
--
-- Requires: database/init.v2.sql already applied, and the Directus catalog
-- tables to exist (services/directus/bootstrap.js) so the product FKs resolve.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Catalog (Directus-owned tables — inserted here only so the example is
-- self-contained on a dev box; in real life Directus creates these rows)
-- ---------------------------------------------------------------------------
INSERT INTO brands (name, slug, country, featured)
VALUES ('Ésika', 'esika', 'Colombia', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, slug, description, sort_order, show_in_menu) VALUES
    ('Brasiers', 'bras',    'Brasiers colombianos de alta calidad', 1, TRUE),
    ('Fajas',    'shapewear','Fajas colombianas moldeadoras',       2, TRUE),
    ('Perfumes', 'perfume', 'Colombian perfumes and fragrances',    3, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO products (
    name, slug, ref, description, price, compare_at_price,
    color, size, material, badge, in_stock, stock_quantity, featured, sort_order,
    legacy_image, category_id, brand_id
)
SELECT
    'Brasier Push-Up Encaje', 'brasier-push-up-encaje', 'UNI-BRA-001',
    'Brasier push-up de encaje colombiano con copa moldeada y tirantes ajustables.',
    45.00, 55.00,
    'Negro', '34B', 'Encaje / microfibra', 'bestseller', TRUE, 24, TRUE, 1,
    '/images/products/brasier-push-up-encaje.jpg',
    (SELECT id FROM categories WHERE slug = 'bras'),
    (SELECT id FROM brands     WHERE slug = 'esika')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE ref = 'UNI-BRA-001');

-- ---------------------------------------------------------------------------
-- Product variants — the size/colour SKUs that actually carry stock
-- ---------------------------------------------------------------------------
INSERT INTO product_variants (product_id, size, color, sku, stock_quantity, price_adjustment)
SELECT p.id, v.size, v.color, v.sku, v.stock, v.adj
FROM products p
CROSS JOIN (VALUES
    ('34B', 'Negro',  'UNI-BRA-001-34B-BLK',  8, 0.00),
    ('36B', 'Negro',  'UNI-BRA-001-36B-BLK', 10, 0.00),
    ('36C', 'Beige',  'UNI-BRA-001-36C-BEI',  6, 2.00)
) AS v(size, color, sku, stock, adj)
WHERE p.ref = 'UNI-BRA-001'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Customer
-- ---------------------------------------------------------------------------
-- Password below is the bcrypt hash of 'TestPassword123!' — dev use only.
INSERT INTO users (id, email, password_hash, first_name, last_name, phone, is_verified)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'maria.gomez@example.cw',
    '$2a$12$X1HG4kDGkCFrVOjEAv0lyuqNZo8HhinhkU/eXKHw.jIpu9ZoIKC/a',
    'María', 'Gómez', '+59996123456', TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Saved address (address book — NOT the order's delivery address)
-- ---------------------------------------------------------------------------
INSERT INTO addresses (
    id, user_id, label, recipient_name, phone, street, area, city, country,
    landmark, latitude, longitude, delivery_zone_id, is_default
)
VALUES (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Casa', 'María Gómez', '+59996123456',
    'Nieuwestraat 14', 'Punda', 'Willemstad', 'Curacao',
    'Al lado de la farmacia', 12.1091700, -68.9316700,
    (SELECT id FROM delivery_zones WHERE slug = 'zone-1-centro'),
    TRUE
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Active cart (note: no prices stored — they are re-read at checkout)
-- ---------------------------------------------------------------------------
INSERT INTO carts (user_id, items)
SELECT
    '11111111-1111-4111-8111-111111111111',
    jsonb_build_array(
        jsonb_build_object(
            'productId', p.id,
            'variantId', (SELECT id FROM product_variants WHERE sku = 'UNI-BRA-001-36B-BLK'),
            'quantity',  1,
            'size',      '36B',
            'color',     'Negro'
        )
    )
FROM products p
WHERE p.ref = 'UNI-BRA-001'
ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items;

-- ---------------------------------------------------------------------------
-- A completed order
--   2 lines · Zone 1 (fee 5, free over 75) · WELCOME10 = 10% off
--   subtotal 92.00 → discount 9.20 → delivery 0 (92 >= 75) → total 82.80
-- ---------------------------------------------------------------------------
INSERT INTO orders (
    id, order_number, user_id,
    guest_email, guest_phone, guest_name,
    status, payment_method, payment_status,
    subtotal, delivery_fee, discount, total, currency,
    coupon_id, coupon_code,
    shipping_address, delivery_zone_id, delivery_zone_name,
    delivery_lat, delivery_lng, delivery_date, delivery_time_slot,
    notes
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    'UNI-260821-0001',
    '11111111-1111-4111-8111-111111111111',
    'maria.gomez@example.cw', '+59996123456', 'María Gómez',
    'delivered', 'sentoo', 'paid',
    92.00, 0.00, 9.20, 82.80, 'XCG',
    (SELECT id FROM coupons WHERE UPPER(code) = 'WELCOME10'),
    'WELCOME10',
    -- Frozen snapshot: this stays correct even if she moves house tomorrow.
    '{"name":"María Gómez","phone":"+59996123456","street":"Nieuwestraat 14",
      "area":"Punda","city":"Willemstad","country":"Curacao",
      "landmark":"Al lado de la farmacia","lat":12.10917,"lng":-68.93167}'::jsonb,
    (SELECT id FROM delivery_zones WHERE slug = 'zone-1-centro'),
    'Zone 1 — Centro',
    12.1091700, -68.9316700,
    CURRENT_DATE - 3, 'morning',
    'Por favor tocar el timbre dos veces'
)
ON CONFLICT (order_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Order lines — every customer-visible field snapshotted at purchase time
-- ---------------------------------------------------------------------------
INSERT INTO order_items (
    order_id, product_id, variant_id,
    product_name, product_sku, quantity, price, size, color, image_url
)
SELECT
    '33333333-3333-4333-8333-333333333333',
    p.id,
    (SELECT id FROM product_variants WHERE sku = 'UNI-BRA-001-34B-BLK'),
    'Brasier Push-Up Encaje', 'UNI-BRA-001', 1, 45.00, '34B', 'Negro',
    '/images/products/brasier-push-up-encaje.jpg'
FROM products p WHERE p.ref = 'UNI-BRA-001'
ON CONFLICT DO NOTHING;

INSERT INTO order_items (
    order_id, product_id, variant_id,
    product_name, product_sku, quantity, price, size, color, image_url
)
SELECT
    '33333333-3333-4333-8333-333333333333',
    p.id,
    (SELECT id FROM product_variants WHERE sku = 'UNI-BRA-001-36C-BEI'),
    'Brasier Push-Up Encaje', 'UNI-BRA-001', 1, 47.00, '36C', 'Beige',
    '/images/products/brasier-push-up-encaje.jpg'
FROM products p WHERE p.ref = 'UNI-BRA-001'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Payment — one row per attempt. No card data, only Sentoo's own reference.
-- ---------------------------------------------------------------------------
INSERT INTO payments (
    order_id, method, provider, status, amount, currency,
    transaction_id, provider_response, paid_at
)
VALUES (
    '33333333-3333-4333-8333-333333333333',
    'sentoo', 'sentoo', 'paid', 82.80, 'XCG',
    'sen_tx_9f3a71c2b48e',
    '{"status":"success","method":"ideal","reference":"sen_tx_9f3a71c2b48e"}'::jsonb,
    NOW() - INTERVAL '4 days'
)
ON CONFLICT (transaction_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Coupon redemption — this is what makes "first order only" enforceable
-- ---------------------------------------------------------------------------
INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, amount_saved)
SELECT
    (SELECT id FROM coupons WHERE UPPER(code) = 'WELCOME10'),
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    9.20
ON CONFLICT (order_id) DO NOTHING;

UPDATE coupons SET times_used = times_used + 1 WHERE UPPER(code) = 'WELCOME10';

-- ---------------------------------------------------------------------------
-- Status timeline
--   The INSERT above already fired the trigger and logged 'pending'.
--   These UPDATEs walk the order through its real lifecycle, and the trigger
--   records each transition automatically — no manual history rows needed.
-- ---------------------------------------------------------------------------
UPDATE orders SET status = 'confirmed'  WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE orders SET status = 'processing' WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE orders SET status = 'shipped'    WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE orders SET status = 'delivered'  WHERE id = '33333333-3333-4333-8333-333333333333';

-- ---------------------------------------------------------------------------
-- Review — verified because the order above was delivered
-- ---------------------------------------------------------------------------
INSERT INTO reviews (
    product_id, user_id, order_id, rating, title, comment, is_verified, is_approved
)
SELECT
    p.id,
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    5, 'Excelente calidad',
    'El encaje es muy suave y la talla es exacta. Llegó al día siguiente en Punda.',
    TRUE, TRUE
FROM products p WHERE p.ref = 'UNI-BRA-001'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notification log
-- ---------------------------------------------------------------------------
INSERT INTO whatsapp_messages (
    direction, phone, wamid, message_type, content, template_name, status, order_id
)
VALUES (
    'outbound', '+59996123456', 'wamid.SEED0001', 'template',
    'Hola María, tu pedido UNI-260821-0001 fue confirmado. Total XCG 82.80.',
    'order_confirmation', 'delivered',
    '33333333-3333-4333-8333-333333333333'
)
ON CONFLICT (wamid) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------
INSERT INTO newsletter_subscribers (email, source)
VALUES ('maria.gomez@example.cw', 'checkout')
ON CONFLICT (email) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFY THE SEED
-- ============================================================================
-- Order total, lines and payment:
--   SELECT o.order_number, o.status, o.subtotal, o.discount, o.total,
--          count(i.id) AS lines, p.status AS payment
--   FROM orders o
--   JOIN order_items i ON i.order_id = o.id
--   JOIN payments p    ON p.order_id = o.id
--   WHERE o.order_number = 'UNI-260821-0001'
--   GROUP BY o.id, p.status;
--
-- The tracking timeline TrackOrder.jsx should render:
--   SELECT from_status, to_status, created_at
--   FROM order_status_history
--   WHERE order_id = '33333333-3333-4333-8333-333333333333'
--   ORDER BY created_at;
-- ============================================================================
