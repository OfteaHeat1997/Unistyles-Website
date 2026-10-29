// ===========================================
// ORDERS ROUTES
// Order creation reuses the checkout quote (services/pricing.js) inside a
// transaction with the product/variant/slot rows locked, so the total the
// customer saw is the total charged and the last unit cannot be sold twice.
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, authenticate } = require('../middleware/auth');
const db = require('../utils/db');
const { getSettings } = require('../services/settings');
const { buildQuote, fromCents } = require('../services/pricing');
const { newTrackingToken, setAuditContext, cancelOrder } = require('../services/orderOps');
const { LABELS, CUSTOMER_CANCELLABLE } = require('../services/orderState');
const sentoo = require('../services/sentoo');
const { sendOrderConfirmation, sendWhatsAppNotification, sendOrderStatusUpdate } = require('../utils/notifications');

const ORDER_NUMBER_RE = /^UNI-\d{6}-\d{4}$/;

// -------------------------------------------
// Serialization
// -------------------------------------------
function parseJson(v) {
    if (v === null || v === undefined) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
}

function serializeOrder(order, { items = [], payment = null, history = [], pickupLocation = null, includeContact = true } = {}) {
    return {
        id: order.id,
        orderNumber: order.order_number,
        trackingToken: includeContact ? order.tracking_token : undefined,
        status: order.status,
        statusLabel: LABELS[order.status] || order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        paymentExpiresAt: order.payment_expires_at,
        fulfillmentMethod: order.fulfillment_method || 'delivery',
        currency: order.currency || 'XCG',
        subtotal: parseFloat(order.subtotal),
        discount: parseFloat(order.discount || 0),
        deliveryFee: parseFloat(order.delivery_fee || 0),
        total: parseFloat(order.total),
        couponCode: order.coupon_code || null,
        deliveryZoneName: order.delivery_zone_name || null,
        fulfillmentDate: order.delivery_date,
        fulfillmentSlot: order.delivery_time_slot,
        pickupLocation,
        shippingAddress: includeContact ? parseJson(order.shipping_address) : undefined,
        customer: includeContact ? {
            name: order.guest_name,
            email: order.guest_email,
            phone: order.guest_phone
        } : undefined,
        notes: includeContact ? order.notes : undefined,
        items: items.map(i => ({
            productId: i.product_id,
            variantId: i.variant_id,
            name: i.product_name,
            sku: i.product_sku,
            quantity: i.quantity,
            price: parseFloat(i.price),
            lineTotal: parseFloat(i.price) * i.quantity,
            size: i.size,
            color: i.color,
            imageUrl: i.image_url
        })),
        payment: payment ? {
            method: payment.method,
            status: payment.status,
            amount: parseFloat(payment.amount),
            paidAt: payment.paid_at,
            hasOnlineSession: !!payment.transaction_id && payment.method === 'sentoo'
        } : null,
        timeline: history.map(h => ({
            status: h.to_status,
            label: LABELS[h.to_status] || h.to_status,
            note: h.note,
            at: h.created_at
        })),
        createdAt: order.created_at,
        updatedAt: order.updated_at
    };
}

async function loadOrderBundle(order, { includeContact = true } = {}) {
    const [items, payment, history, pickup] = await Promise.all([
        db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at', [order.id]),
        db.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [order.id]),
        db.query('SELECT to_status, note, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at, id', [order.id]),
        order.pickup_location_id
            ? db.query('SELECT id, name, address, latitude, longitude, hours, instructions FROM pickup_locations WHERE id = $1', [order.pickup_location_id])
            : Promise.resolve({ rows: [] })
    ]);
    const loc = pickup.rows[0];
    return serializeOrder(order, {
        items: items.rows,
        payment: payment.rows[0] || null,
        history: history.rows,
        includeContact,
        pickupLocation: loc ? {
            id: loc.id, name: loc.name, address: loc.address, hours: loc.hours, instructions: loc.instructions,
            lat: loc.latitude !== null ? parseFloat(loc.latitude) : null,
            lng: loc.longitude !== null ? parseFloat(loc.longitude) : null
        } : null
    });
}

async function isAdminUser(userId) {
    if (!userId) return false;
    const r = await db.query("SELECT role FROM users WHERE id = $1", [userId]);
    return r.rows[0]?.role === 'admin';
}

/** Owner, admin, or the holder of the tracking token may see/act on an order. */
async function canAccess(req, order) {
    const token = req.query.t || req.body?.trackingToken;
    if (token && order.tracking_token && token === order.tracking_token) return true;
    if (req.user && order.user_id && req.user.id === order.user_id) return true;
    return isAdminUser(req.user?.id);
}

// ===========================================
// POST /api/orders
// ===========================================
router.post('/',
    optionalAuth,
    [
        body('items').isArray({ min: 1, max: 50 }).withMessage('At least one item required'),
        body('items.*.productId').isInt({ min: 1 }).toInt(),
        body('items.*.variantId').optional({ nullable: true }).isUUID(),
        body('items.*.quantity').isInt({ min: 1, max: 99 }).toInt(),
        body('paymentMethod').isIn(['cod', 'sentoo', 'bank_transfer', 'whatsapp']).withMessage('Choose a payment method'),
        body('customer.firstName').trim().notEmpty().isLength({ max: 100 }).withMessage('First name is required'),
        body('customer.lastName').trim().notEmpty().isLength({ max: 100 }).withMessage('Last name is required'),
        body('customer.phone').trim().matches(/^\+?[0-9 ()-]{7,20}$/).withMessage('A valid phone number is required'),
        body('customer.email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Invalid email'),
        body('fulfillment.method').isIn(['pickup', 'delivery']).withMessage('Choose pickup or delivery'),
        body('fulfillment.street').if(body('fulfillment.method').equals('delivery')).trim().notEmpty().isLength({ max: 255 }).withMessage('Street address is required'),
        body('fulfillment.landmark').optional({ nullable: true }).isString().isLength({ max: 255 }),
        body('fulfillment.lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
        body('fulfillment.lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
        body('fulfillment.date').isISO8601().withMessage('Choose a date'),
        body('fulfillment.slotId').isInt().withMessage('Choose a time window'),
        body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
        body('couponCode').optional({ nullable: true }).isString().isLength({ max: 50 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
        }

        const { items, paymentMethod, customer, fulfillment, notes, couponCode } = req.body;
        const idempotencyKey = (req.get('Idempotency-Key') || '').slice(0, 64) || null;
        const userId = req.user?.id || null;

        if (!userId && !customer.email) {
            return res.status(400).json({ error: 'Email is required for guest checkout' });
        }

        const settings = await getSettings();
        if (!(settings.payment_methods || []).includes(paymentMethod)) {
            return res.status(422).json({ error: 'This payment method is not available' });
        }
        if (paymentMethod === 'sentoo' && process.env.PAYMENTS_MODE !== 'mock' && !sentoo.isConfigured()) {
            return res.status(503).json({ error: 'Online payment is temporarily unavailable. Choose another method.' });
        }

        const client = await db.getClient();
        let order;
        let quote;
        let replayed = false;

        try {
            await client.query('BEGIN');

            // Idempotency: the same checkout submitted twice returns the first order.
            if (idempotencyKey) {
                const existing = await client.query('SELECT * FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
                if (existing.rowCount > 0) {
                    order = existing.rows[0];
                    replayed = true;
                }
            }

            if (!replayed) {
                // Serialize bookings of the same slot so capacity cannot be exceeded.
                await client.query('SELECT id FROM fulfillment_slots WHERE id = $1 FOR UPDATE', [fulfillment.slotId]);

                quote = await buildQuote(client, {
                    items,
                    fulfillment,
                    couponCode,
                    email: customer.email
                }, { settings, userId, lock: true, requireComplete: true });

                const blocking = quote.issues.filter(i => i.blocking !== false);
                if (blocking.length > 0 || !quote.canPlaceOrder) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        error: blocking[0]?.message || 'Your order could not be placed',
                        issues: quote.issues,
                        quote: { subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, discount: quote.discount, total: quote.total }
                    });
                }
                if (couponCode && !quote.coupon?.valid) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: quote.coupon?.error || 'Invalid coupon', issues: quote.issues });
                }

                const { totals, zone, coupon, couponResult, lines } = quote._internal;
                if (paymentMethod === 'sentoo' && totals.totalCents < 100) {
                    await client.query('ROLLBACK');
                    return res.status(422).json({ error: 'Online payment requires a total of at least XCG 1.00' });
                }

                // DEC-017: every order starts unconfirmed; stock is deducted when staff
                // confirms it (cash) or the payment arrives (transfer, Sentoo).
                let status = 'pending';
                let paymentStatus = 'pending';
                let expiresSql = null;
                if (paymentMethod === 'cod') {
                    paymentStatus = 'pending_delivery';
                } else if (paymentMethod === 'sentoo') {
                    status = 'awaiting_payment';
                    expiresSql = `${settings.payment_expiry_minutes} minutes`;
                } else if (paymentMethod === 'bank_transfer') {
                    status = 'awaiting_payment';
                    expiresSql = `${settings.bank_transfer_expiry_hours} hours`;
                }

                const name = `${customer.firstName} ${customer.lastName}`.trim();
                const shippingAddress = fulfillment.method === 'delivery' ? {
                    name,
                    phone: customer.phone,
                    street: fulfillment.street,
                    area: fulfillment.area || zone?.name || null,
                    city: fulfillment.area || 'Curaçao',
                    landmark: fulfillment.landmark || null,
                    lat: fulfillment.lat ?? null,
                    lng: fulfillment.lng ?? null
                } : null;

                await setAuditContext(client, { userId, note: 'Order placed online' });
                const inserted = await client.query(`
                    INSERT INTO orders (
                        user_id, guest_email, guest_phone, guest_name,
                        status, payment_method, payment_status,
                        subtotal, delivery_fee, discount, total, currency,
                        coupon_id, coupon_code,
                        fulfillment_method, pickup_location_id, fulfillment_slot_id,
                        shipping_address, delivery_zone_id, delivery_zone_name, delivery_lat, delivery_lng,
                        delivery_date, delivery_time_slot, notes,
                        tracking_token, idempotency_key, payment_expires_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                        CASE WHEN $28::text IS NULL THEN NULL ELSE NOW() + ($28::text)::interval END
                    ) RETURNING *`,
                    [
                        userId, customer.email || null, customer.phone, name,
                        status, paymentMethod, paymentStatus,
                        fromCents(totals.subtotalCents), fromCents(totals.deliveryFeeCents),
                        fromCents(totals.discountCents), fromCents(totals.totalCents), quote.currency,
                        couponResult?.valid ? coupon.id : null, couponResult?.valid ? coupon.code : null,
                        fulfillment.method, quote.pickupLocation?.id || null, quote.slot.id,
                        shippingAddress ? JSON.stringify(shippingAddress) : null,
                        zone?.id || null, zone?.name || null,
                        fulfillment.lat ?? null, fulfillment.lng ?? null,
                        quote.slot.date, quote.slot.label, notes || null,
                        newTrackingToken(), idempotencyKey, expiresSql
                    ]
                );
                order = inserted.rows[0];

                for (const line of lines) {
                    await client.query(`
                        INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_sku,
                                                 quantity, price, size, color, image_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [order.id, line.productId, line.variantId, line.name, line.sku || '',
                         line.quantity, fromCents(line.unitPriceCents), line.size, line.color, line.image]
                    );
                }

                if (totals.deliveryFeeToConfirm) {
                    await client.query(
                        `UPDATE orders SET needs_review = true,
                                admin_notes = 'Delivery zone unknown — confirm the fee with the customer on WhatsApp (DEC-001).'
                         WHERE id = $1`, [order.id]);
                }

                if (couponResult?.valid) {
                    await client.query('UPDATE coupons SET times_used = times_used + 1 WHERE id = $1', [coupon.id]);
                    await client.query(
                        `INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, guest_email, amount_saved)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [coupon.id, order.id, userId, userId ? null : customer.email, fromCents(couponResult.discountCents)]
                    );
                }

                await client.query(
                    `INSERT INTO payments (order_id, method, provider, status, amount, currency)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [order.id, paymentMethod, paymentMethod === 'sentoo' ? 'sentoo' : 'manual',
                     paymentStatus, fromCents(totals.totalCents), quote.currency]
                );
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
            // Two identical submits racing: the unique index tells us the other one won.
            if (err.code === '23505' && String(err.constraint || '').includes('idempotency')) {
                const existing = await db.query('SELECT * FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
                if (existing.rowCount > 0) {
                    order = existing.rows[0];
                    replayed = true;
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        } finally {
            client.release();
        }

        const payload = await loadOrderBundle(order);

        if (!replayed && paymentMethod !== 'sentoo') {
            // Online payments notify after the payment is confirmed (services/paymentConfirm.js)
            const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            sendOrderConfirmation(order, itemsRes.rows).catch(e => console.error('[orders] email failed:', e.message));
            sendWhatsAppNotification(order, itemsRes.rows).catch(e => console.error('[orders] whatsapp failed:', e.message));
        }

        let next = { type: 'confirmation' };
        if (order.payment_method === 'sentoo') next = { type: 'pay_online' };
        if (order.payment_method === 'bank_transfer') {
            next = { type: 'bank_transfer', reference: order.order_number, bankDetails: settings.bank_details, expiresAt: order.payment_expires_at };
        }
        if (order.payment_method === 'whatsapp') next = { type: 'whatsapp', supportWhatsapp: settings.support_whatsapp };

        res.status(replayed ? 200 : 201).json({ message: replayed ? 'Order already placed' : 'Order created', replayed, order: payload, next });
    })
);

// ===========================================
// GET /api/orders  — the logged-in customer's orders
// ===========================================
router.get('/',
    authenticate,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
    ],
    asyncHandler(async (req, res) => {
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const offset = (page - 1) * limit;

        const [countResult, result] = await Promise.all([
            db.query('SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1', [req.user.id]),
            db.query(`
                SELECT o.*, COUNT(oi.id)::int AS item_count
                FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = $1
                GROUP BY o.id ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
                [req.user.id, limit, offset])
        ]);

        res.json({
            orders: result.rows.map(o => ({ ...serializeOrder(o), itemCount: o.item_count })),
            pagination: {
                page, limit,
                total: countResult.rows[0].total,
                totalPages: Math.ceil(countResult.rows[0].total / limit)
            }
        });
    })
);

// ===========================================
// GET /api/orders/track/:orderNumber?t=TOKEN | ?phone=LAST4
// Public, privacy-safe: no address, email or names.
// ===========================================
router.get('/track/:orderNumber',
    [
        param('orderNumber').customSanitizer(v => String(v).trim().toUpperCase()).matches(ORDER_NUMBER_RE).withMessage('Order numbers look like UNI-261025-0001'),
        query('t').optional().isString().isLength({ max: 64 }),
        query('phone').optional().isString().isLength({ max: 20 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const result = await db.query('SELECT * FROM orders WHERE order_number = $1', [req.params.orderNumber]);
        const order = result.rows[0];
        const digits = String(req.query.phone || '').replace(/\D/g, '');
        const phoneOk = order && digits.length >= 4 && String(order.guest_phone || '').replace(/\D/g, '').endsWith(digits.slice(-4));
        const tokenOk = order && req.query.t && req.query.t === order.tracking_token;

        // Same answer for "does not exist" and "wrong phone" so numbers cannot be probed.
        if (!order || !(phoneOk || tokenOk)) {
            return res.status(404).json({ error: 'We could not find an order with that number and phone.' });
        }

        const bundle = await loadOrderBundle(order, { includeContact: false });
        res.json({ ...bundle, trackingToken: order.tracking_token });
    })
);

// ===========================================
// GET /api/orders/by-number/:orderNumber?t=TOKEN — confirmation page
// ===========================================
router.get('/by-number/:orderNumber',
    optionalAuth,
    [param('orderNumber').customSanitizer(v => String(v).trim().toUpperCase()).matches(ORDER_NUMBER_RE)],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid order number' });

        const result = await db.query('SELECT * FROM orders WHERE order_number = $1', [req.params.orderNumber]);
        const order = result.rows[0];
        if (!order || !(await canAccess(req, order))) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const settings = await getSettings();
        const bundle = await loadOrderBundle(order);
        res.json({
            ...bundle,
            bankDetails: order.payment_method === 'bank_transfer' ? settings.bank_details : undefined,
            supportWhatsapp: settings.support_whatsapp,
            canCancel: CUSTOMER_CANCELLABLE.has(order.status)
        });
    })
);

// ===========================================
// GET /api/orders/:id — owner, admin or tracking token
// ===========================================
router.get('/:id',
    optionalAuth,
    [param('id').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        const order = result.rows[0];
        if (!order || !(await canAccess(req, order))) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(await loadOrderBundle(order));
    })
);

// ===========================================
// PUT /api/orders/:id/cancel — customer cancellation before preparation
// ===========================================
router.put('/:id/cancel',
    optionalAuth,
    [param('id').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const found = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        const order = found.rows[0];
        if (!order || !(await canAccess(req, order))) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (!CUSTOMER_CANCELLABLE.has(order.status)) {
            return res.status(422).json({
                error: `This order is "${LABELS[order.status]}" and can no longer be cancelled online. Contact us on WhatsApp.`
            });
        }

        const client = await db.getClient();
        let cancelled;
        try {
            await client.query('BEGIN');
            cancelled = await cancelOrder(client, order.id, { userId: req.user?.id || null, note: 'Cancelled by customer' });
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
            throw err;
        } finally {
            client.release();
        }

        if (order.payment_method === 'sentoo') {
            const p = await db.query("SELECT transaction_id FROM payments WHERE order_id = $1 AND transaction_id IS NOT NULL LIMIT 1", [order.id]);
            if (p.rows[0] && sentoo.isConfigured()) sentoo.cancelTransaction(p.rows[0].transaction_id).catch(() => {});
        }
        sendOrderStatusUpdate(cancelled, 'cancelled').catch(e => console.error('[orders] notify failed:', e.message));

        res.json({
            message: cancelled.needs_review
                ? 'Order cancelled. Your payment will be refunded — we will contact you.'
                : 'Order cancelled',
            orderNumber: order.order_number,
            status: 'cancelled'
        });
    })
);

module.exports = router;
module.exports.loadOrderBundle = loadOrderBundle;
module.exports.serializeOrder = serializeOrder;
