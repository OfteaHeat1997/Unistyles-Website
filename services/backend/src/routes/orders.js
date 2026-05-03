// ===========================================
// ORDERS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, authenticate } = require('../middleware/auth');
const db = require('../utils/db');
const { sendOrderConfirmation, sendWhatsAppNotification, sendOrderStatusUpdate } = require('../utils/notifications');

// ===========================================
// POST /api/orders
// Create new order
// ===========================================
router.post('/',
    optionalAuth,
    [
        body('items').isArray({ min: 1 }).withMessage('At least one item required'),
        body('paymentMethod').isIn(['cod', 'sentoo', 'bank_transfer', 'card', 'whatsapp']),
        body('shippingAddress.name').notEmpty(),
        body('shippingAddress.phone').notEmpty(),
        body('shippingAddress.street').notEmpty(),
        body('shippingAddress.city').notEmpty(),
        body('deliveryTimeSlot').optional()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            items,
            paymentMethod,
            shippingAddress,
            deliveryDate,
            deliveryTimeSlot,
            notes,
            guestEmail,
            guestPhone,
            guestName,
            couponCode
        } = req.body;

        // ===========================================
        // Use a DB transaction with row-level locking
        // to prevent two customers from buying the last item
        // ===========================================
        const client = await db.getClient();

        let order;
        const orderItems = [];

        try {
            await client.query('BEGIN');

            // Lock the product rows we need (SELECT FOR UPDATE)
            // This makes other checkout requests wait until we're done
            const productIds = items.map(item => item.productId);
            const products = await client.query(
                'SELECT id, ref, name, price, in_stock, stock_quantity, image, legacy_image FROM products WHERE id = ANY($1) FOR UPDATE',
                [productIds]
            );

            const productMap = {};
            products.rows.forEach(p => {
                productMap[p.id] = p;
            });

            let subtotal = 0;

            for (const item of items) {
                const product = productMap[item.productId];
                if (!product) {
                    throw { statusCode: 400, message: `Product not found: ${item.productId}` };
                }
                if (!product.in_stock) {
                    throw { statusCode: 400, message: `Out of stock: ${product.name}` };
                }
                if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
                    throw { statusCode: 400, message: `Not enough stock for ${product.name}. Available: ${product.stock_quantity}` };
                }

                const itemPrice = parseFloat(product.price);
                subtotal += itemPrice * item.quantity;

                orderItems.push({
                    productId: product.id,
                    variantId: item.variantId || null,
                    productName: product.name,
                    productSku: product.ref || '',
                    quantity: item.quantity,
                    price: itemPrice,
                    size: item.size || null,
                    color: item.color || null,
                    imageUrl: product.legacy_image || null
                });
            }

            // Resolve delivery fee from the zone matching shippingAddress.area.
            // Each zone may override the global free-shipping threshold.
            const thresholdResult = await client.query(
                "SELECT value FROM settings WHERE key = 'free_delivery_threshold'"
            );
            const globalThreshold = parseFloat(thresholdResult.rows[0]?.value || 0);

            const areaName = shippingAddress.area || shippingAddress.city || null;
            let zoneId = null;
            let zoneFee = 0;
            let zoneThreshold = globalThreshold;

            if (areaName) {
                const zoneResult = await client.query(
                    `SELECT id, fee, free_threshold FROM delivery_zones
                     WHERE is_active = true
                       AND EXISTS (
                         SELECT 1 FROM jsonb_array_elements(neighborhoods) n
                         WHERE LOWER(n->>'name') = LOWER($1)
                       )
                     LIMIT 1`,
                    [areaName]
                );
                if (zoneResult.rows.length > 0) {
                    zoneId = zoneResult.rows[0].id;
                    zoneFee = parseFloat(zoneResult.rows[0].fee);
                    if (zoneResult.rows[0].free_threshold !== null) {
                        zoneThreshold = parseFloat(zoneResult.rows[0].free_threshold);
                    }
                } else {
                    // Unknown area — reject so we never undercharge silently
                    throw {
                        statusCode: 400,
                        message: `Delivery area "${areaName}" is not covered. Please contact us via WhatsApp.`
                    };
                }
            }

            const deliveryFee = subtotal >= zoneThreshold ? 0 : zoneFee;

            // Apply coupon discount if provided (atomic with FOR UPDATE to prevent race conditions)
            let discount = 0;
            if (couponCode) {
                const couponResult = await client.query(
                    'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true FOR UPDATE',
                    [couponCode]
                );

                if (couponResult.rows.length > 0) {
                    const coupon = couponResult.rows[0];
                    const now = new Date();
                    const isValid = (!coupon.valid_from || new Date(coupon.valid_from) <= now) &&
                                    (!coupon.valid_until || new Date(coupon.valid_until) >= now) &&
                                    (!coupon.max_uses || coupon.times_used < coupon.max_uses) &&
                                    (!coupon.min_order_amount || subtotal >= parseFloat(coupon.min_order_amount));

                    if (isValid) {
                        if (coupon.discount_type === 'percentage') {
                            discount = subtotal * (parseFloat(coupon.discount_value) / 100);
                            if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) {
                                discount = parseFloat(coupon.max_discount);
                            }
                        } else {
                            discount = parseFloat(coupon.discount_value);
                        }
                        discount = Math.min(discount, subtotal);

                        // Atomically increment usage (already locked by FOR UPDATE)
                        await client.query(
                            'UPDATE coupons SET times_used = times_used + 1 WHERE id = $1',
                            [coupon.id]
                        );
                    }
                }
            }

            const total = subtotal + deliveryFee - discount;

            // Create order
            const orderResult = await client.query(`
                INSERT INTO orders (
                    user_id, guest_email, guest_phone, guest_name,
                    payment_method, subtotal, delivery_fee, discount, total,
                    shipping_address, delivery_date, delivery_time_slot, notes,
                    delivery_zone_id, delivery_lat, delivery_lng
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                req.user?.id || null,
                guestEmail || null,
                guestPhone || shippingAddress.phone,
                guestName || shippingAddress.name,
                paymentMethod,
                subtotal,
                deliveryFee,
                discount,
                total,
                JSON.stringify(shippingAddress),
                deliveryDate || null,
                deliveryTimeSlot || null,
                notes || null,
                zoneId,
                shippingAddress.lat || null,
                shippingAddress.lng || null
            ]);

            order = orderResult.rows[0];

            // Insert order items and deduct stock (inside same transaction)
            for (const item of orderItems) {
                await client.query(`
                    INSERT INTO order_items (
                        order_id, product_id, variant_id, product_name,
                        product_sku, quantity, price, size, color, image_url
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    order.id,
                    item.productId,
                    item.variantId,
                    item.productName,
                    item.productSku,
                    item.quantity,
                    item.price,
                    item.size,
                    item.color,
                    item.imageUrl
                ]);

                // Deduct stock and verify it doesn't go negative
                const stockResult = await client.query(`
                    UPDATE products
                    SET stock_quantity = stock_quantity - $1,
                        in_stock = CASE WHEN stock_quantity - $1 <= 0 THEN false ELSE in_stock END
                    WHERE id = $2 AND (stock_quantity IS NULL OR stock_quantity >= $1)
                    RETURNING stock_quantity
                `, [item.quantity, item.productId]);

                if (stockResult.rows.length === 0) {
                    throw { statusCode: 400, message: `Not enough stock for ${item.productName}` };
                }
            }

            // Create initial payment record
            await client.query(`
                INSERT INTO payments (order_id, method, amount)
                VALUES ($1, $2, $3)
            `, [order.id, paymentMethod, total]);

            // All good — commit the transaction
            await client.query('COMMIT');

        } catch (err) {
            // Something failed — roll back everything (order, items, stock changes)
            await client.query('ROLLBACK');

            if (err.statusCode) {
                return res.status(err.statusCode).json({ error: err.message });
            }
            throw err; // Re-throw unexpected errors to asyncHandler
        } finally {
            client.release();
        }

        // Send notifications (async, don't wait)
        sendOrderConfirmation(order, orderItems).catch(console.error);
        sendWhatsAppNotification(order, orderItems).catch(console.error);

        res.status(201).json({
            message: 'Order created successfully',
            order: {
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                subtotal: parseFloat(order.subtotal),
                deliveryFee: parseFloat(order.delivery_fee),
                total: parseFloat(order.total),
                items: orderItems,
                shippingAddress: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address,
                deliveryDate: order.delivery_date,
                deliveryTimeSlot: order.delivery_time_slot,
                createdAt: order.created_at
            }
        });
    })
);

// ===========================================
// GET /api/orders
// Get user's orders
// ===========================================
router.get('/',
    authenticate,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
    ],
    asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await db.query(
        'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
        [req.user.id]
    );

    // Single query with item count (no N+1)
    const result = await db.query(`
        SELECT o.*, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), offset]);

    const orders = result.rows.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        subtotal: parseFloat(order.subtotal),
        deliveryFee: parseFloat(order.delivery_fee),
        discount: parseFloat(order.discount || 0),
        total: parseFloat(order.total),
        itemCount: parseInt(order.item_count),
        createdAt: order.created_at
    }));

    res.json({
        orders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total),
            totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
    });
}));

// ===========================================
// GET /api/orders/:id
// Get order details
// ===========================================
router.get('/:id',
    optionalAuth,
    [param('id').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;

    const result = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // Check authorization — re-verify admin from DB (don't trust JWT claim)
    if (req.user && order.user_id !== req.user.id) {
        const adminCheck = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
        if (!adminCheck.rows[0]?.is_admin) {
            return res.status(403).json({ error: 'Not authorized' });
        }
    }

    // Get items
    const items = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
    );

    // Get payment info
    const payment = await db.query(
        'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
        [order.id]
    );

    res.json({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        subtotal: parseFloat(order.subtotal),
        deliveryFee: parseFloat(order.delivery_fee),
        total: parseFloat(order.total),
        items: items.rows.map(item => ({
            productId: item.product_id,
            name: item.product_name,
            sku: item.product_sku,
            quantity: item.quantity,
            price: parseFloat(item.price),
            size: item.size,
            color: item.color,
            imageUrl: item.image_url
        })),
        shippingAddress: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address,
        deliveryDate: order.delivery_date,
        deliveryTimeSlot: order.delivery_time_slot,
        notes: order.notes,
        payment: payment.rows[0] ? {
            method: payment.rows[0].method,
            status: payment.rows[0].status,
            transactionId: payment.rows[0].transaction_id
        } : null,
        createdAt: order.created_at,
        updatedAt: order.updated_at
    });
}));

// ===========================================
// GET /api/orders/track/:orderNumber
// Track order by order number (public)
// ===========================================
router.get('/track/:orderNumber',
    [param('orderNumber').matches(/^UNI-\d{6}-\d{4}$/).withMessage('Invalid order number format')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderNumber } = req.params;

    // Use exact match (=) NOT LIKE to prevent wildcard attacks
    const result = await db.query(
        'SELECT id, order_number, status, payment_status, delivery_date, delivery_time_slot, created_at FROM orders WHERE order_number = $1',
        [orderNumber]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    res.json({
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        deliveryDate: order.delivery_date,
        deliveryTimeSlot: order.delivery_time_slot,
        createdAt: order.created_at
    });
}));

// ===========================================
// PUT /api/orders/:id/cancel
// Cancel an order and restore stock
// ===========================================
router.put('/:id/cancel',
    optionalAuth,
    [param('id').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;

    // Get the order
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check authorization
    if (req.user && order.user_id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    // Only allow cancellation of pending/confirmed orders (not shipped/delivered)
    const cancellableStatuses = ['pending', 'confirmed', 'awaiting_payment'];
    if (!cancellableStatuses.includes(order.status)) {
        return res.status(400).json({
            error: `Cannot cancel order with status "${order.status}". Only pending, confirmed, or awaiting payment orders can be cancelled.`
        });
    }

    // Use a transaction to cancel + restore stock atomically
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Update order status
        await client.query(
            'UPDATE orders SET status = $1, payment_status = $2, updated_at = NOW() WHERE id = $3',
            ['cancelled', 'refunded', id]
        );

        // Update payment status
        await client.query(
            'UPDATE payments SET status = $1, updated_at = NOW() WHERE order_id = $2',
            ['refunded', id]
        );

        // Restore stock for each order item
        const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [id]);
        for (const item of items.rows) {
            await client.query(`
                UPDATE products
                SET stock_quantity = stock_quantity + $1,
                    in_stock = true
                WHERE id = $2
            `, [item.quantity, item.product_id]);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    // Send cancellation notification (non-blocking)
    sendOrderStatusUpdate(order, 'cancelled').catch(console.error);

    res.json({
        message: 'Order cancelled successfully',
        orderNumber: order.order_number,
        status: 'cancelled'
    });
}));

module.exports = router;
