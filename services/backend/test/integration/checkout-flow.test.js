// ===========================================
// END-TO-END API FLOW (needs the local demo stack running, PAYMENTS_MODE=mock)
//   TEST_API_URL=http://localhost:3000 \
//   TEST_DATABASE_URL=postgresql://unistyles:localdev@localhost:5433/unistyles_db \
//   npm run test:integration
// Skipped automatically when TEST_API_URL is not set.
// ===========================================
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const API = process.env.TEST_API_URL;
const DB = process.env.TEST_DATABASE_URL;
const skip = !API || !DB ? 'set TEST_API_URL and TEST_DATABASE_URL' : false;

let pool;
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);

async function call(method, path, body, { token, headers = {} } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

async function login(email) {
    const r = await call('POST', '/api/auth/login', { email, password: 'Demo1234!' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
}

const customer = { firstName: 'Test', lastName: 'Buyer', email: 'buyer@example.com', phone: '+5999 555 1234' };
let simple; let variant; let slots; let savedSettings;
// Delivery address matched by neighbourhood name (near zone, DEC-001); no map polygons yet (DEC-006)
const nearAddress = { street: 'Penstraat 1', area: 'Santa María' };

async function nextSlot(method) {
    const r = await call('GET', `/api/delivery/slots?method=${method}`);
    for (const d of r.data.days) {
        const s = d.slots.find(x => x.available);
        if (s) return { date: d.date, slotId: s.id };
    }
    throw new Error('no slot available');
}

test.describe('checkout → payment → fulfillment', { skip }, () => {
    test.before(async () => {
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: DB });
        // A simple product with stock 5 and a variant with stock 1 (reset each run)
        [simple] = await q(`SELECT id, price FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) ORDER BY id LIMIT 1`);
        await q('UPDATE products SET stock_quantity = 5, in_stock = true WHERE id = $1', [simple.id]);
        [variant] = await q(`SELECT v.id, v.product_id, p.price FROM product_variants v JOIN products p ON p.id = v.product_id ORDER BY v.sku LIMIT 1`);
        await q('UPDATE product_variants SET stock_quantity = 1 WHERE id = $1', [variant.id]);
        // The suite needs pickup and Sentoo switched on; the owner's launch settings
        // (DEC-004, DEC-013) hide them. Save them, override, and restore afterwards.
        savedSettings = await q(`SELECT key, value FROM settings WHERE key IN ('pickup_enabled','payment_methods')`);
        await q(`INSERT INTO settings (key, value) VALUES ('pickup_enabled','true'), ('payment_methods','["cod","sentoo","bank_transfer"]')
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
        slots = { pickup: await nextSlot('pickup'), delivery: await nextSlot('delivery') };
    });
    test.after(async () => {
        if (!pool) return;
        for (const row of savedSettings || []) {
            await q('UPDATE settings SET value = $2 WHERE key = $1', [row.key, JSON.stringify(row.value)]);
        }
        await pool.end();
    });

    test('quote: neighbourhood resolves the zone fee server-side; unknown address is "to confirm", not charged', async () => {
        const items = [{ productId: simple.id, quantity: 1 }];
        const inZone = await call('POST', '/api/checkout/quote', { items, fulfillment: { method: 'delivery', ...nearAddress } });
        assert.equal(inZone.status, 200);
        assert.equal(inZone.data.zone.slug, 'near');
        assert.equal(inZone.data.deliveryFee, inZone.data.subtotal >= 100 ? 0 : 10);
        const unknown = await call('POST', '/api/checkout/quote', { items, fulfillment: { method: 'delivery', lat: 11.9, lng: -68.9 } });
        assert.ok(unknown.data.issues.some(i => i.type === 'zone_to_confirm' && i.blocking === false));
        assert.equal(unknown.data.deliveryFee, 0);
        const pickup = await call('POST', '/api/checkout/quote', { items, fulfillment: { method: 'pickup' } });
        assert.equal(pickup.data.deliveryFee, 0);
    });

    test('variant product cannot be bought without choosing the variant', async () => {
        const r = await call('POST', '/api/checkout/quote', { items: [{ productId: variant.product_id, quantity: 1 }], fulfillment: { method: 'pickup' } });
        assert.ok(r.data.issues.some(i => i.type === 'variant_required'));
        assert.equal(r.data.canPlaceOrder, false);
    });

    test('pickup + cash: order created once even when submitted twice (idempotency)', async () => {
        const key = crypto.randomUUID();
        const body = { items: [{ productId: simple.id, quantity: 1 }], paymentMethod: 'cod', customer, fulfillment: { method: 'pickup', ...slots.pickup } };
        const [a, b] = await Promise.all([
            call('POST', '/api/orders', body, { headers: { 'Idempotency-Key': key } }),
            call('POST', '/api/orders', body, { headers: { 'Idempotency-Key': key } })
        ]);
        assert.ok([200, 201].includes(a.status) && [200, 201].includes(b.status), JSON.stringify([a.data, b.data]));
        assert.equal(a.data.order.orderNumber, b.data.order.orderNumber);
        assert.equal(a.data.order.deliveryFee, 0);
        assert.equal(a.data.order.status, 'pending');            // "Received": staff confirms it
        assert.equal(a.data.order.paymentStatus, 'pending_delivery');
        const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key = $1', [key]);
        assert.equal(n, 1);
        const [{ stock_quantity }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        assert.equal(stock_quantity, 5);                            // DEC-017: nothing reserved before confirmation
    });

    test('last unit of a variant: both buyers can order, exactly one confirmation wins (DEC-017)', async () => {
        const body = (email) => ({
            items: [{ productId: variant.product_id, variantId: variant.id, quantity: 1 }],
            paymentMethod: 'cod', customer: { ...customer, email },
            fulfillment: { method: 'pickup', ...slots.pickup }
        });
        const results = await Promise.all([
            call('POST', '/api/orders', body('a@example.com'), { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
            call('POST', '/api/orders', body('b@example.com'), { headers: { 'Idempotency-Key': crypto.randomUUID() } })
        ]);
        assert.deepEqual(results.map(r => r.status), [201, 201], JSON.stringify(results.map(r => r.data?.error)));
        const [{ stock_quantity: untouched }] = await q('SELECT stock_quantity FROM product_variants WHERE id = $1', [variant.id]);
        assert.equal(untouched, 1);

        const admin = await login('admin@example.com');
        const confirms = await Promise.all(results.map(r =>
            call('POST', `/api/admin/orders/${r.data.order.id}/transition`, { to: 'confirmed' }, { token: admin.token })));
        assert.deepEqual(confirms.map(c => c.status).sort(), [200, 409], JSON.stringify(confirms.map(c => c.data?.error)));
        const [{ stock_quantity }] = await q('SELECT stock_quantity FROM product_variants WHERE id = $1', [variant.id]);
        assert.equal(stock_quantity, 0);
    });

    test('online payment: decline then approve; replayed confirmation marks paid exactly once', async () => {
        const created = await call('POST', '/api/orders', {
            items: [{ productId: simple.id, quantity: 2 }], paymentMethod: 'sentoo', customer,
            fulfillment: { method: 'delivery', ...nearAddress, ...slots.delivery }
        }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
        assert.equal(created.status, 201, JSON.stringify(created.data));
        const [{ stock_quantity: stockBefore }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        const { id, trackingToken, total } = created.data.order;
        assert.equal(created.data.order.status, 'awaiting_payment');
        assert.equal(created.data.order.total, Number(simple.price) * 2 + created.data.order.deliveryFee);
        assert.equal(total, created.data.order.subtotal + created.data.order.deliveryFee - created.data.order.discount);

        const session = await call('POST', '/api/payments/sentoo', { orderId: id, trackingToken });
        assert.equal(session.data.mode, 'mock');

        const declined = await call('POST', `/api/payments/mock/${id}`, { outcome: 'decline', trackingToken });
        assert.equal(declined.data.result, 'mark_failed');

        await call('POST', '/api/payments/sentoo', { orderId: id, trackingToken }); // retry resets to pending
        const approvals = await Promise.all([1, 2, 3].map(() => call('POST', `/api/payments/mock/${id}`, { outcome: 'approve', trackingToken })));
        assert.equal(approvals.filter(a => a.data.result === 'mark_paid').length, 1, JSON.stringify(approvals.map(a => a.data)));

        const status = await call('GET', `/api/payments/${id}/sentoo-status`);
        assert.equal(status.data.paymentStatus, 'paid');
        assert.equal(status.data.orderStatus, 'confirmed');
        const history = await q(`SELECT to_status FROM order_status_history WHERE order_id = $1 ORDER BY id`, [id]);
        assert.deepEqual(history.map(h => h.to_status), ['awaiting_payment', 'confirmed']);
        const [{ stock_quantity: stockAfter }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        assert.equal(stockAfter, stockBefore - 2);                  // the verified payment is the deduction event
    });

    test('unpaid online order expires; its stock was never touched', async () => {
        const created = await call('POST', '/api/orders', {
            items: [{ productId: simple.id, quantity: 1 }], paymentMethod: 'sentoo', customer,
            fulfillment: { method: 'pickup', ...slots.pickup }
        }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
        const { id } = created.data.order;
        const [{ stock_quantity: before }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        await q(`UPDATE orders SET payment_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
        process.env.DATABASE_URL = DB;
        const { expireUnpaidOrders } = require('../../src/services/paymentConfirm');
        const expired = await expireUnpaidOrders();
        assert.ok(expired.includes(id));
        const [{ stock_quantity: after }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        assert.equal(after, before);
        const [order] = await q('SELECT status, payment_status FROM orders WHERE id = $1', [id]);
        assert.deepEqual(order, { status: 'expired', payment_status: 'expired' });
    });

    test('tracking needs the right phone; wrong phone looks like "not found"', async () => {
        const [o] = await q(`SELECT order_number FROM orders WHERE guest_phone = $1 ORDER BY created_at LIMIT 1`, [customer.phone]);
        const ok = await call('GET', `/api/orders/track/${o.order_number}?phone=1234`);
        assert.equal(ok.status, 200);
        assert.equal(ok.data.shippingAddress, undefined);
        const bad = await call('GET', `/api/orders/track/${o.order_number}?phone=9999`);
        assert.equal(bad.status, 404);
    });

    test('roles: customer is refused admin; admin runs the pickup lifecycle; driver delivers with cash', async () => {
        const cliente = await login('cliente@example.com');
        assert.equal((await call('GET', '/api/admin/stats', null, { token: cliente.token })).status, 403);
        assert.equal((await call('GET', '/api/driver/stops', null, { token: cliente.token })).status, 403);

        const admin = await login('admin@example.com');
        assert.equal(admin.user.role, 'admin');
        const me = await call('GET', '/api/auth/me', null, { token: admin.token });
        assert.equal(me.status, 200);
        assert.equal(me.data.user.role, 'admin');

        // Pickup order: received → confirmed → processing → ready → picked up (cash collected)
        const [pickupOrder] = await q(`SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
                                       WHERE o.fulfillment_method = 'pickup' AND o.status = 'pending' AND o.payment_method = 'cod'
                                         AND i.product_id = $1 ORDER BY o.created_at DESC LIMIT 1`, [simple.id]);
        for (const to of ['confirmed', 'processing', 'ready_for_pickup', 'picked_up']) {
            const r = await call('POST', `/api/admin/orders/${pickupOrder.id}/transition`, { to }, { token: admin.token });
            assert.equal(r.status, 200, `${to}: ${JSON.stringify(r.data)}`);
        }
        const [po] = await q('SELECT status, payment_status FROM orders WHERE id = $1', [pickupOrder.id]);
        assert.deepEqual(po, { status: 'picked_up', payment_status: 'paid' });

        // Impossible jump is refused by the state machine
        const bad = await call('POST', `/api/admin/orders/${pickupOrder.id}/transition`, { to: 'processing' }, { token: admin.token });
        assert.equal(bad.status, 422);

        // Delivery order with cash, assigned to the driver
        const created = await call('POST', '/api/orders', {
            items: [{ productId: simple.id, quantity: 1 }], paymentMethod: 'cod', customer,
            fulfillment: { method: 'delivery', ...nearAddress, ...slots.delivery }
        }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
        const orderId = created.data.order.id;
        assert.equal((await call('POST', `/api/admin/orders/${orderId}/transition`, { to: 'confirmed' }, { token: admin.token })).status, 200);
        const driver = await login('driver@example.com');
        await call('PUT', `/api/admin/orders/${orderId}`, { assignedDriverId: driver.user.id }, { token: admin.token });
        await call('POST', `/api/admin/orders/${orderId}/transition`, { to: 'processing' }, { token: admin.token });

        const stops = await call('GET', `/api/driver/stops?date=${slots.delivery.date}`, null, { token: driver.token });
        assert.ok(stops.data.stops.some(s => s.id === orderId));
        assert.equal((await call('POST', `/api/driver/orders/${orderId}/start`, {}, { token: driver.token })).status, 200);
        const noCash = await call('POST', `/api/driver/orders/${orderId}/delivered`, { recipientName: 'Test Buyer' }, { token: driver.token });
        assert.equal(noCash.status, 422);
        const done = await call('POST', `/api/driver/orders/${orderId}/delivered`, { recipientName: 'Test Buyer', codCollected: true }, { token: driver.token });
        assert.equal(done.status, 200);
        const [d] = await q('SELECT status, payment_status FROM orders WHERE id = $1', [orderId]);
        assert.deepEqual(d, { status: 'delivered', payment_status: 'paid' });
    });

    test('inventory adjustment from a WhatsApp sale is logged and moves stock', async () => {
        const admin = await login('admin@example.com');
        const [{ stock_quantity: before }] = await q('SELECT stock_quantity FROM products WHERE id = $1', [simple.id]);
        const r = await call('POST', '/api/admin/inventory/adjust', { productId: simple.id, delta: -1, reason: 'whatsapp_sale' }, { token: admin.token });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        assert.equal(r.data.stock, before - 1);
        const [m] = await q(`SELECT reason, delta FROM inventory_movements WHERE product_id = $1 ORDER BY id DESC LIMIT 1`, [simple.id]);
        assert.deepEqual(m, { reason: 'whatsapp_sale', delta: -1 });
    });
});
