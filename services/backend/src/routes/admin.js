// ===========================================
// ADMIN ROUTES — owner back office
// Every route requires role 'admin' (re-checked against the DB).
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const db = require('../utils/db');
const { sendOrderStatusUpdate } = require('../utils/notifications');
const { transition, cancelOrder, releaseStock, setAuditContext, deductOrderStock } = require('../services/orderOps');
const { allowedNext, LABELS } = require('../services/orderState');
const { applyProviderStatus } = require('../services/paymentConfirm');
const { getSettings, updateSettings, EDITABLE_KEYS } = require('../services/settings');
const { loadOrderBundle } = require('./orders');
const sentoo = require('../services/sentoo');

router.use(authenticate, requireRole('admin'));

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
        return false;
    }
    return true;
}

/** Run fn(client) in a transaction; maps {statusCode} errors to HTTP. */
async function inTransaction(res, fn) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.statusCode) {
            res.status(err.statusCode).json({ error: err.message });
            return undefined;
        }
        throw err;
    } finally {
        client.release();
    }
}

// ===========================================
// DASHBOARD
// ===========================================
router.get('/stats', asyncHandler(async (req, res) => {
    const [kpis, byStatus, lowStock, users] = await Promise.all([
        db.query(`
            SELECT
              COUNT(*) FILTER (WHERE created_at::date = (NOW() AT TIME ZONE 'America/Curacao')::date)::int AS orders_today,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) AS revenue_paid,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'
                   AND created_at >= date_trunc('month', NOW())), 0) AS revenue_month,
              COUNT(*) FILTER (WHERE status = 'awaiting_payment')::int AS awaiting_payment,
              COUNT(*) FILTER (WHERE status = 'confirmed')::int AS to_prepare,
              COUNT(*) FILTER (WHERE needs_review)::int AS needs_review,
              COUNT(*) FILTER (WHERE fulfillment_method = 'delivery' AND delivery_date = (NOW() AT TIME ZONE 'America/Curacao')::date
                               AND status NOT IN ('cancelled','expired'))::int AS deliveries_today,
              COUNT(*) FILTER (WHERE fulfillment_method = 'pickup' AND delivery_date = (NOW() AT TIME ZONE 'America/Curacao')::date
                               AND status NOT IN ('cancelled','expired'))::int AS pickups_today,
              COUNT(*)::int AS total_orders
            FROM orders`),
        db.query('SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY count DESC'),
        db.query(`
            SELECT
              (SELECT COUNT(*) FROM product_variants WHERE is_active AND stock_quantity <= 2)::int +
              (SELECT COUNT(*) FROM products p WHERE COALESCE(p.stock_quantity, 0) <= 2
                 AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id))::int AS low_stock`),
        db.query("SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL")
    ]);
    const k = kpis.rows[0];
    res.json({
        ordersToday: k.orders_today,
        revenuePaid: parseFloat(k.revenue_paid),
        revenueMonth: parseFloat(k.revenue_month),
        awaitingPayment: k.awaiting_payment,
        toPrepare: k.to_prepare,
        needsReview: k.needs_review,
        deliveriesToday: k.deliveries_today,
        pickupsToday: k.pickups_today,
        totalOrders: k.total_orders,
        totalUsers: users.rows[0].count,
        lowStock: lowStock.rows[0].low_stock,
        ordersByStatus: byStatus.rows.map(r => ({ ...r, label: LABELS[r.status] || r.status }))
    });
}));

// ===========================================
// ORDERS
// ===========================================
router.get('/orders',
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('status').optional().isString(),
        query('paymentStatus').optional().isString(),
        query('fulfillment').optional().isIn(['pickup', 'delivery']),
        query('date').optional().isISO8601(),
        query('q').optional().isString().isLength({ max: 100 }),
        query('needsReview').optional().isBoolean().toBoolean()
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const page = req.query.page || 1;
        const limit = req.query.limit || 25;
        const where = [];
        const params = [];
        const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

        if (req.query.status) add('o.status = ANY(?::text[])', String(req.query.status).split(','));
        if (req.query.paymentStatus) add('o.payment_status = ANY(?::text[])', String(req.query.paymentStatus).split(','));
        if (req.query.fulfillment) add('o.fulfillment_method = ?', req.query.fulfillment);
        if (req.query.date) add('o.delivery_date = ?::date', req.query.date);
        if (req.query.needsReview) where.push('o.needs_review = true');
        if (req.query.q) add("(o.order_number ILIKE ? OR o.guest_name ILIKE $X OR o.guest_phone ILIKE $X OR o.guest_email ILIKE $X)", `%${req.query.q}%`);
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}`.replace(/\$X/g, `$${params.length}`) : '';

        const countParams = [...params];
        params.push(limit, (page - 1) * limit);
        const [rows, count] = await Promise.all([
            db.query(`
                SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method, o.fulfillment_method,
                       o.total, o.currency, o.guest_name, o.guest_phone, o.delivery_date, o.delivery_time_slot,
                       o.delivery_zone_name, o.needs_review, o.created_at, o.assigned_driver_id,
                       d.first_name AS driver_first_name
                FROM orders o LEFT JOIN users d ON d.id = o.assigned_driver_id
                ${whereSql}
                ORDER BY o.created_at DESC
                LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
            db.query(`SELECT COUNT(*)::int AS n FROM orders o ${whereSql}`, countParams)
        ]);

        res.json({
            orders: rows.rows.map(o => ({
                id: o.id,
                orderNumber: o.order_number,
                status: o.status,
                statusLabel: LABELS[o.status] || o.status,
                paymentStatus: o.payment_status,
                paymentMethod: o.payment_method,
                fulfillmentMethod: o.fulfillment_method,
                total: parseFloat(o.total),
                currency: o.currency,
                customerName: o.guest_name,
                customerPhone: o.guest_phone,
                date: o.delivery_date,
                slot: o.delivery_time_slot,
                zone: o.delivery_zone_name,
                needsReview: o.needs_review,
                driverName: o.driver_first_name,
                createdAt: o.created_at
            })),
            total: count.rows[0].n,
            page,
            limit,
            totalPages: Math.ceil(count.rows[0].n / limit)
        });
    })
);

async function adminOrderDetail(id) {
    const result = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    const order = result.rows[0];
    if (!order) return null;
    const [bundle, events, attempts, refunds, driver] = await Promise.all([
        loadOrderBundle(order),
        db.query('SELECT source, provider_status, result, created_at FROM payment_events WHERE order_id = $1 ORDER BY created_at', [id]),
        db.query(`SELECT a.*, u.first_name AS driver_name FROM delivery_attempts a LEFT JOIN users u ON u.id = a.driver_id
                  WHERE a.order_id = $1 ORDER BY a.created_at`, [id]),
        db.query('SELECT amount, reason, method, created_at FROM refunds WHERE order_id = $1 ORDER BY created_at', [id]),
        order.assigned_driver_id ? db.query('SELECT id, first_name, last_name, phone FROM users WHERE id = $1', [order.assigned_driver_id]) : { rows: [] }
    ]);
    return {
        ...bundle,
        adminNotes: order.admin_notes,
        needsReview: order.needs_review,
        allowedTransitions: allowedNext(order.status, {
            fulfillmentMethod: order.fulfillment_method,
            paymentStatus: order.payment_status
        }).map(s => ({ status: s, label: LABELS[s] })),
        paymentEvents: events.rows,
        deliveryAttempts: attempts.rows.map(a => ({
            outcome: a.outcome, reason: a.reason, recipientName: a.recipient_name, note: a.note,
            codCollected: a.cod_collected, driverName: a.driver_name, at: a.created_at
        })),
        refunds: refunds.rows.map(r => ({ ...r, amount: parseFloat(r.amount) })),
        driver: driver.rows[0] ? { id: driver.rows[0].id, name: `${driver.rows[0].first_name || ''} ${driver.rows[0].last_name || ''}`.trim(), phone: driver.rows[0].phone } : null
    };
}

router.get('/orders/:id', [param('id').isUUID()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const detail = await adminOrderDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Order not found' });
    res.json(detail);
}));

// POST /api/admin/orders/:id/transition  { to, note }
router.post('/orders/:id/transition',
    [param('id').isUUID(), body('to').isString().notEmpty(), body('note').optional().isString().isLength({ max: 500 })],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const { to, note } = req.body;
        const updated = await inTransaction(res, async (client) => {
            if (to === 'cancelled' || to === 'expired') {
                return cancelOrder(client, req.params.id, { userId: req.user.id, note: note || 'Cancelled by staff', expired: to === 'expired' });
            }
            const order = await transition(client, req.params.id, to, { userId: req.user.id, note });
            if (to === 'confirmed') await deductOrderStock(client, order.id, { strict: true });
            if (to === 'returned') await releaseStock(client, order.id, 'return', req.user.id);
            // Cash collected at handover
            if ((to === 'picked_up' || to === 'delivered') && order.payment_status === 'pending_delivery') {
                await client.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1`, [order.id]);
                await client.query(`UPDATE payments SET status = 'paid', paid_at = NOW() WHERE order_id = $1 AND status <> 'paid'`, [order.id]);
            }
            if (to === 'picked_up') {
                await client.query(
                    `INSERT INTO delivery_attempts (order_id, driver_id, outcome, note, cod_collected)
                     VALUES ($1, $2, 'picked_up', $3, $4)`,
                    [order.id, req.user.id, note || null, order.payment_status === 'pending_delivery']
                );
            }
            return order;
        });
        if (!updated) return;
        sendOrderStatusUpdate(updated, to).catch(e => console.error('[admin] notify failed:', e.message));
        res.json(await adminOrderDetail(req.params.id));
    })
);

// POST /api/admin/orders/:id/mark-paid  { note }  — bank transfer / WhatsApp / cash confirmed by staff
router.post('/orders/:id/mark-paid', [param('id').isUUID(), body('note').optional().isString()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const done = await inTransaction(res, async (client) => {
        const r = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
        const order = r.rows[0];
        if (!order) throw { statusCode: 404, message: 'Order not found' };
        if (order.payment_status === 'paid') throw { statusCode: 409, message: 'Order is already paid' };
        if (['cancelled', 'expired'].includes(order.status)) throw { statusCode: 422, message: 'Re-open is not supported; this order is closed' };
        if (order.payment_method === 'sentoo') throw { statusCode: 422, message: 'Online payments are confirmed by Sentoo. Use "Re-check payment".' };

        await setAuditContext(client, { userId: req.user.id, note: req.body.note || 'Payment confirmed by staff' });
        await client.query(
            `UPDATE orders SET payment_status = 'paid', payment_expires_at = NULL,
                    status = CASE WHEN status IN ('pending','awaiting_payment') THEN 'confirmed' ELSE status END
             WHERE id = $1`, [order.id]);
        // Money is in: deduct what exists and flag any shortfall instead of refusing (DEC-017)
        await deductOrderStock(client, order.id, { strict: false });
        const p = await client.query(`UPDATE payments SET status = 'paid', paid_at = NOW() WHERE order_id = $1 RETURNING id`, [order.id]);
        await client.query(
            `INSERT INTO payment_events (payment_id, order_id, source, provider_status, result, payload)
             VALUES ($1, $2, 'admin', 'manual', 'mark_paid', $3)`,
            [p.rows[0]?.id || null, order.id, JSON.stringify({ by: req.user.id, note: req.body.note || null })]
        );
        return true;
    });
    if (!done) return;
    res.json(await adminOrderDetail(req.params.id));
}));

// POST /api/admin/orders/:id/recheck-payment — asks Sentoo again
router.post('/orders/:id/recheck-payment', [param('id').isUUID()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const p = await db.query(
        `SELECT transaction_id FROM payments WHERE order_id = $1 AND method = 'sentoo' AND transaction_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`, [req.params.id]);
    if (!p.rows[0]) return res.status(404).json({ error: 'No online payment session for this order' });
    if (!sentoo.isConfigured()) return res.status(503).json({ error: 'Sentoo is not configured' });
    const status = await sentoo.fetchStatus(p.rows[0].transaction_id);
    const { providerDataFrom } = require('./payments');
    const outcome = await applyProviderStatus({
        transactionId: p.rows[0].transaction_id, providerStatus: status.status,
        providerData: providerDataFrom(status), source: 'admin', io: req.app.get('io'), userId: req.user.id
    });
    res.json({ sentooStatus: status.status, result: outcome.result, order: await adminOrderDetail(req.params.id) });
}));

// POST /api/admin/orders/:id/refund { amount, reason, method }
router.post('/orders/:id/refund',
    [
        param('id').isUUID(),
        body('amount').isFloat({ gt: 0 }).toFloat(),
        body('reason').isString().trim().notEmpty().isLength({ max: 500 }),
        body('method').isIn(['sentoo_dashboard', 'cash', 'bank_transfer'])
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const done = await inTransaction(res, async (client) => {
            const r = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
            const order = r.rows[0];
            if (!order) throw { statusCode: 404, message: 'Order not found' };
            if (!['paid', 'partially_refunded'].includes(order.payment_status)) throw { statusCode: 422, message: 'Only paid orders can be refunded' };
            const prev = await client.query('SELECT COALESCE(SUM(amount),0) AS s FROM refunds WHERE order_id = $1', [order.id]);
            const already = Math.round(parseFloat(prev.rows[0].s) * 100);
            const amount = Math.round(req.body.amount * 100);
            const total = Math.round(parseFloat(order.total) * 100);
            if (already + amount > total) throw { statusCode: 422, message: `Refund exceeds the paid total (already refunded XCG ${(already / 100).toFixed(2)})` };
            const pay = await client.query('SELECT id FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [order.id]);
            await client.query(
                `INSERT INTO refunds (order_id, payment_id, amount, reason, method, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.id, pay.rows[0]?.id || null, amount / 100, req.body.reason, req.body.method, req.user.id]
            );
            const newStatus = already + amount === total ? 'refunded' : 'partially_refunded';
            await client.query('UPDATE orders SET payment_status = $1, needs_review = false WHERE id = $2', [newStatus, order.id]);
            await client.query('UPDATE payments SET status = $1 WHERE id = $2', [newStatus, pay.rows[0]?.id]);
            await client.query(
                `INSERT INTO payment_events (payment_id, order_id, source, provider_status, result, payload)
                 VALUES ($1, $2, 'admin', 'refund', $3, $4)`,
                [pay.rows[0]?.id || null, order.id, newStatus, JSON.stringify({ amount: amount / 100, method: req.body.method })]
            );
            return true;
        });
        if (!done) return;
        res.json(await adminOrderDetail(req.params.id));
    })
);

// PUT /api/admin/orders/:id  { adminNotes, assignedDriverId, needsReview }
router.put('/orders/:id',
    [
        param('id').isUUID(),
        body('adminNotes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
        body('assignedDriverId').optional({ nullable: true }).custom(v => v === null || /^[0-9a-f-]{36}$/i.test(v)),
        body('needsReview').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const { adminNotes, assignedDriverId, needsReview } = req.body;
        if (assignedDriverId) {
            const d = await db.query("SELECT 1 FROM users WHERE id = $1 AND role IN ('driver','admin')", [assignedDriverId]);
            if (d.rowCount === 0) return res.status(422).json({ error: 'That user is not a driver' });
        }
        const r = await db.query(
            `UPDATE orders SET
                admin_notes = CASE WHEN $1::boolean THEN $2 ELSE admin_notes END,
                assigned_driver_id = CASE WHEN $3::boolean THEN $4::uuid ELSE assigned_driver_id END,
                needs_review = COALESCE($5, needs_review),
                updated_at = NOW()
             WHERE id = $6 RETURNING id`,
            [adminNotes !== undefined, adminNotes ?? null, assignedDriverId !== undefined, assignedDriverId ?? null, needsReview ?? null, req.params.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
        res.json(await adminOrderDetail(req.params.id));
    })
);

// ===========================================
// SCHEDULE — what has to happen on a given day
// ===========================================
router.get('/schedule', [query('date').optional().isISO8601()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const date = req.query.date || new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const [slots, orders, blocked] = await Promise.all([
        db.query('SELECT * FROM fulfillment_slots WHERE weekday = $1 AND is_active ORDER BY method, start_time', [weekday]),
        db.query(`
            SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method, o.fulfillment_method,
                   o.fulfillment_slot_id, o.delivery_time_slot, o.guest_name, o.guest_phone, o.total,
                   o.delivery_zone_name, o.shipping_address, o.assigned_driver_id, u.first_name AS driver_name
            FROM orders o LEFT JOIN users u ON u.id = o.assigned_driver_id
            WHERE o.delivery_date = $1 AND o.status NOT IN ('cancelled','expired')
            ORDER BY o.delivery_time_slot, o.created_at`, [date]),
        db.query('SELECT method, reason FROM blocked_dates WHERE date = $1', [date])
    ]);
    const bySlot = (slotId) => orders.rows.filter(o => o.fulfillment_slot_id === slotId).map(o => ({
        id: o.id, orderNumber: o.order_number, status: o.status, statusLabel: LABELS[o.status],
        paymentStatus: o.payment_status, paymentMethod: o.payment_method,
        customerName: o.guest_name, customerPhone: o.guest_phone, total: parseFloat(o.total),
        zone: o.delivery_zone_name,
        address: o.shipping_address ? [o.shipping_address.street, o.shipping_address.area].filter(Boolean).join(', ') : null,
        driverName: o.driver_name, assignedDriverId: o.assigned_driver_id
    }));
    res.json({
        date,
        blocked: blocked.rows,
        delivery: slots.rows.filter(s => s.method === 'delivery').map(s => ({
            slotId: s.id, label: `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`, capacity: s.capacity, orders: bySlot(s.id)
        })),
        pickup: slots.rows.filter(s => s.method === 'pickup').map(s => ({
            slotId: s.id, label: `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`, capacity: s.capacity, orders: bySlot(s.id)
        }))
    });
}));

// ===========================================
// INVENTORY
// ===========================================
router.get('/inventory',
    [query('q').optional().isString(), query('lowStock').optional().isBoolean().toBoolean(), query('limit').optional().isInt({ min: 1, max: 200 }).toInt()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const params = [];
        const where = [];
        if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(p.name ILIKE $${params.length} OR p.ref ILIKE $${params.length})`); }
        params.push(req.query.limit || 100);
        const products = await db.query(`
            SELECT p.id, p.name, p.ref, p.price, p.stock_quantity, p.in_stock, p.legacy_image
            FROM products p ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY p.name LIMIT $${params.length}`, params);
        const ids = products.rows.map(p => p.id);
        const variants = ids.length
            ? await db.query('SELECT * FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY size, color', [ids])
            : { rows: [] };
        let items = products.rows.map(p => {
            const vs = variants.rows.filter(v => v.product_id === p.id);
            return {
                id: p.id, name: p.name, ref: p.ref, price: parseFloat(p.price), image: p.legacy_image,
                hasVariants: vs.length > 0,
                stock: vs.length ? vs.reduce((s, v) => s + (v.is_active ? v.stock_quantity : 0), 0) : (p.stock_quantity ?? 0),
                inStock: p.in_stock,
                variants: vs.map(v => ({
                    id: v.id, size: v.size, color: v.color, sku: v.sku, stock: v.stock_quantity,
                    priceAdjustment: parseFloat(v.price_adjustment || 0), isActive: v.is_active
                }))
            };
        });
        if (req.query.lowStock) items = items.filter(i => i.hasVariants ? i.variants.some(v => v.isActive && v.stock <= 2) : i.stock <= 2);
        res.json({ items });
    })
);

// POST /api/admin/inventory/adjust { productId, variantId?, delta, reason, note }
router.post('/inventory/adjust',
    [
        body('productId').isInt({ min: 1 }).toInt(),
        body('variantId').optional({ nullable: true }).isUUID(),
        body('delta').isInt().toInt().custom(v => v !== 0).withMessage('Change cannot be zero'),
        body('reason').isIn(['restock', 'manual_sale', 'whatsapp_sale', 'correction', 'return']),
        body('note').optional({ nullable: true }).isString().isLength({ max: 500 })
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const { productId, variantId, delta, reason, note } = req.body;
        const result = await inTransaction(res, async (client) => {
            let stock;
            if (variantId) {
                const r = await client.query(
                    `UPDATE product_variants SET stock_quantity = stock_quantity + $1
                     WHERE id = $2 AND product_id = $3 AND stock_quantity + $1 >= 0 RETURNING stock_quantity`,
                    [delta, variantId, productId]);
                if (r.rowCount === 0) throw { statusCode: 422, message: 'Variant not found or stock would go below zero' };
                stock = r.rows[0].stock_quantity;
            } else {
                const r = await client.query(
                    `UPDATE products SET stock_quantity = COALESCE(stock_quantity,0) + $1,
                            in_stock = COALESCE(stock_quantity,0) + $1 > 0
                     WHERE id = $2 AND COALESCE(stock_quantity,0) + $1 >= 0 RETURNING stock_quantity`,
                    [delta, productId]);
                if (r.rowCount === 0) throw { statusCode: 422, message: 'Product not found or stock would go below zero' };
                stock = r.rows[0].stock_quantity;
            }
            await client.query(
                `INSERT INTO inventory_movements (product_id, variant_id, delta, reason, note, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [productId, variantId || null, delta, reason, note || null, req.user.id]);
            return { stock };
        });
        if (result) res.json(result);
    })
);

router.get('/inventory/movements',
    [query('productId').optional().isInt().toInt(), query('limit').optional().isInt({ min: 1, max: 200 }).toInt()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const params = [];
        let where = '';
        if (req.query.productId) { params.push(req.query.productId); where = 'WHERE m.product_id = $1'; }
        params.push(req.query.limit || 50);
        const r = await db.query(`
            SELECT m.*, p.name AS product_name, v.size, v.color, o.order_number, u.first_name AS user_name
            FROM inventory_movements m
            LEFT JOIN products p ON p.id = m.product_id
            LEFT JOIN product_variants v ON v.id = m.variant_id
            LEFT JOIN orders o ON o.id = m.order_id
            LEFT JOIN users u ON u.id = m.created_by
            ${where} ORDER BY m.created_at DESC LIMIT $${params.length}`, params);
        res.json({
            movements: r.rows.map(m => ({
                id: m.id, productId: m.product_id, productName: m.product_name, size: m.size, color: m.color,
                delta: m.delta, reason: m.reason, note: m.note, orderNumber: m.order_number, user: m.user_name, at: m.created_at
            }))
        });
    })
);

// ===========================================
// PAYMENTS — reconciliation
// ===========================================
router.get('/payments',
    [query('from').optional().isISO8601(), query('to').optional().isISO8601(), query('format').optional().isIn(['json', 'csv'])],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const r = await db.query(`
            SELECT o.order_number, o.created_at, o.payment_method, o.payment_status, o.status, o.total, o.currency,
                   p.transaction_id, p.paid_at, p.failure_reason,
                   COALESCE((SELECT SUM(amount) FROM refunds rf WHERE rf.order_id = o.id), 0) AS refunded
            FROM orders o LEFT JOIN payments p ON p.order_id = o.id
            WHERE o.created_at::date BETWEEN $1 AND $2
            ORDER BY o.created_at DESC`, [from, to]);
        const rows = r.rows.map(x => ({
            orderNumber: x.order_number, createdAt: x.created_at, method: x.payment_method,
            paymentStatus: x.payment_status, orderStatus: x.status, total: parseFloat(x.total),
            refunded: parseFloat(x.refunded), currency: x.currency, reference: x.transaction_id,
            paidAt: x.paid_at, failureReason: x.failure_reason
        }));
        const summary = {};
        for (const row of rows) {
            const key = row.method;
            summary[key] = summary[key] || { method: key, paid: 0, pending: 0, refunded: 0, count: 0 };
            summary[key].count++;
            if (['paid', 'partially_refunded', 'refunded'].includes(row.paymentStatus)) summary[key].paid += row.total;
            else if (!['cancelled', 'expired', 'failed'].includes(row.paymentStatus)) summary[key].pending += row.total;
            summary[key].refunded += row.refunded;
        }
        if (req.query.format === 'csv') {
            const header = 'order_number,created_at,method,payment_status,order_status,total,refunded,currency,reference,paid_at';
            const esc = (v) => v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
            const lines = rows.map(x => [x.orderNumber, x.createdAt?.toISOString?.() || x.createdAt, x.method, x.paymentStatus,
                x.orderStatus, x.total.toFixed(2), x.refunded.toFixed(2), x.currency, x.reference, x.paidAt?.toISOString?.() || ''].map(esc).join(','));
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="payments_${from}_${to}.csv"`);
            return res.send([header, ...lines].join('\n'));
        }
        res.json({ from, to, summary: Object.values(summary), payments: rows });
    })
);

// ===========================================
// SETTINGS & CONFIGURATION
// ===========================================
router.get('/settings', asyncHandler(async (req, res) => {
    const [settings, zones, slots, blocked, locations] = await Promise.all([
        getSettings(),
        db.query('SELECT id, slug, name, fee, free_threshold, estimated_days, color, sort_order, is_active, neighborhoods FROM delivery_zones ORDER BY sort_order, id'),
        db.query('SELECT * FROM fulfillment_slots ORDER BY method, weekday, start_time'),
        db.query("SELECT id, to_char(date, 'YYYY-MM-DD') AS date, method, reason FROM blocked_dates WHERE date >= CURRENT_DATE - 1 ORDER BY date"),
        db.query('SELECT * FROM pickup_locations ORDER BY id')
    ]);
    res.json({
        settings: Object.fromEntries(EDITABLE_KEYS.map(k => [k, settings[k]])),
        zones: zones.rows.map(z => ({ ...z, fee: parseFloat(z.fee), free_threshold: z.free_threshold === null ? null : parseFloat(z.free_threshold) })),
        slots: slots.rows,
        blockedDates: blocked.rows,
        pickupLocations: locations.rows
    });
}));

router.put('/settings', [body('settings').isObject()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const s = req.body.settings;
    if (s.free_delivery_threshold !== undefined && !(Number(s.free_delivery_threshold) >= 0)) {
        return res.status(400).json({ error: 'Threshold must be a positive number' });
    }
    if (s.free_delivery_rule !== undefined && !['gte', 'gt'].includes(s.free_delivery_rule)) {
        return res.status(400).json({ error: 'Rule must be gte or gt' });
    }
    if (s.payment_methods !== undefined && (!Array.isArray(s.payment_methods) || s.payment_methods.some(m => !['cod', 'sentoo', 'bank_transfer', 'whatsapp'].includes(m)))) {
        return res.status(400).json({ error: 'Invalid payment methods' });
    }
    const updated = await updateSettings(s);
    res.json({ updated });
}));

router.put('/zones/:id',
    [param('id').isInt().toInt(), body('fee').optional().isFloat({ min: 0 }), body('free_threshold').optional({ nullable: true }).isFloat({ min: 0 }),
     body('is_active').optional().isBoolean(), body('estimated_days').optional().isString().isLength({ max: 30 })],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const { fee, free_threshold, is_active, estimated_days } = req.body;
        const r = await db.query(
            `UPDATE delivery_zones SET fee = COALESCE($1, fee),
                    free_threshold = CASE WHEN $2::boolean THEN $3::numeric ELSE free_threshold END,
                    is_active = COALESCE($4, is_active), estimated_days = COALESCE($5, estimated_days)
             WHERE id = $6 RETURNING *`,
            [fee ?? null, free_threshold !== undefined, free_threshold ?? null, is_active ?? null, estimated_days ?? null, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Zone not found' });
        res.json({ zone: r.rows[0] });
    })
);

router.post('/slots',
    [body('method').isIn(['pickup', 'delivery']), body('weekday').isInt({ min: 0, max: 6 }).toInt(),
     body('start_time').matches(/^\d{2}:\d{2}$/), body('end_time').matches(/^\d{2}:\d{2}$/), body('capacity').isInt({ min: 0, max: 200 }).toInt()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const { method, weekday, start_time, end_time, capacity } = req.body;
        if (end_time <= start_time) return res.status(400).json({ error: 'End time must be after start time' });
        const r = await db.query(
            `INSERT INTO fulfillment_slots (method, weekday, start_time, end_time, capacity) VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (method, weekday, start_time) DO UPDATE SET end_time = EXCLUDED.end_time, capacity = EXCLUDED.capacity, is_active = true
             RETURNING *`, [method, weekday, start_time, end_time, capacity]);
        res.status(201).json({ slot: r.rows[0] });
    })
);

router.put('/slots/:id',
    [param('id').isInt().toInt(), body('capacity').optional().isInt({ min: 0, max: 200 }).toInt(), body('is_active').optional().isBoolean()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const r = await db.query(
            'UPDATE fulfillment_slots SET capacity = COALESCE($1, capacity), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *',
            [req.body.capacity ?? null, req.body.is_active ?? null, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Slot not found' });
        res.json({ slot: r.rows[0] });
    })
);

router.post('/blocked-dates',
    [body('date').isISO8601(), body('method').optional({ nullable: true }).isIn(['pickup', 'delivery']), body('reason').optional().isString().isLength({ max: 200 })],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const r = await db.query(
            `INSERT INTO blocked_dates (date, method, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`,
            [req.body.date, req.body.method || null, req.body.reason || null]);
        res.status(201).json({ blockedDate: r.rows[0] || null });
    })
);

router.delete('/blocked-dates/:id', [param('id').isInt().toInt()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    await db.query('DELETE FROM blocked_dates WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
}));

router.put('/pickup-locations/:id',
    [param('id').isInt().toInt(), body('name').optional().isString().isLength({ max: 100 }), body('address').optional().isString().isLength({ max: 255 }),
     body('hours').optional().isString().isLength({ max: 200 }), body('instructions').optional().isString(), body('is_active').optional().isBoolean(),
     body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }), body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 })],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const b = req.body;
        const r = await db.query(
            `UPDATE pickup_locations SET name = COALESCE($1,name), address = COALESCE($2,address), hours = COALESCE($3,hours),
                    instructions = COALESCE($4,instructions), is_active = COALESCE($5,is_active),
                    latitude = COALESCE($6,latitude), longitude = COALESCE($7,longitude), updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [b.name ?? null, b.address ?? null, b.hours ?? null, b.instructions ?? null, b.is_active ?? null, b.latitude ?? null, b.longitude ?? null, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Pickup location not found' });
        res.json({ pickupLocation: r.rows[0] });
    })
);

// ===========================================
// USERS
// ===========================================
router.get('/users', [query('page').optional().isInt({ min: 1 }).toInt(), query('search').optional().isString(), query('role').optional().isIn(['customer', 'admin', 'driver'])],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const page = req.query.page || 1;
        const limit = 25;
        const params = [];
        const where = ['deleted_at IS NULL'];
        if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`(email ILIKE $${params.length} OR first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`); }
        if (req.query.role) { params.push(req.query.role); where.push(`role = $${params.length}`); }
        const whereSql = `WHERE ${where.join(' AND ')}`;
        const countParams = [...params];
        params.push(limit, (page - 1) * limit);
        const [users, count] = await Promise.all([
            db.query(`SELECT id, email, first_name, last_name, phone, role, is_verified, created_at FROM users ${whereSql}
                      ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
            db.query(`SELECT COUNT(*)::int AS n FROM users ${whereSql}`, countParams)
        ]);
        res.json({ users: users.rows, total: count.rows[0].n, page, limit, totalPages: Math.ceil(count.rows[0].n / limit) });
    })
);

router.get('/users/:id', [param('id').isUUID()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const result = await db.query('SELECT id, email, first_name, last_name, phone, role, is_verified, created_at, updated_at FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    const orders = await db.query('SELECT id, order_number, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    res.json({ user: result.rows[0], orders: orders.rows });
}));

router.put('/users/:id',
    [param('id').isUUID(), body('role').optional().isIn(['customer', 'admin', 'driver']), body('firstName').optional().isString(), body('lastName').optional().isString(), body('phone').optional().isString()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        if (req.params.id === req.user.id && req.body.role && req.body.role !== 'admin') {
            return res.status(400).json({ error: 'You cannot remove your own admin role' });
        }
        const { firstName, lastName, phone, role } = req.body;
        const r = await db.query(
            `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
                    phone = COALESCE($3, phone), role = COALESCE($4, role), updated_at = NOW()
             WHERE id = $5 RETURNING id, email, first_name, last_name, phone, role`,
            [firstName ?? null, lastName ?? null, phone ?? null, role ?? null, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ user: r.rows[0], message: 'User updated' });
    })
);

router.delete('/users/:id', [param('id').isUUID()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    // Soft delete keeps order history intact
    const r = await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
}));

router.get('/drivers', asyncHandler(async (req, res) => {
    const r = await db.query("SELECT id, first_name, last_name, phone, role FROM users WHERE role IN ('driver','admin') AND deleted_at IS NULL ORDER BY role DESC, first_name");
    res.json({ drivers: r.rows.map(d => ({ id: d.id, name: `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Unnamed', phone: d.phone, role: d.role })) });
}));

module.exports = router;
