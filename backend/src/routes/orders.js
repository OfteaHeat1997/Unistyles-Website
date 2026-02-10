// ===========================================
// ORDERS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, authenticate } = require('../middleware/auth');
const db = require('../utils/db');
const { sendOrderConfirmation, sendWhatsAppNotification } = require('../utils/notifications');

// ===========================================
// POST /api/orders
// Create new order
// ===========================================
router.post('/',
    optionalAuth,
    [
        body('items').isArray({ min: 1 }).withMessage('At least one item required'),
        body('paymentMethod').isIn(['cod', 'sentoo', 'bank_transfer', 'card']),
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
            guestName
        } = req.body;

        // Verify items and calculate totals
        const productIds = items.map(item => item.productId);
        const products = await db.query(
            'SELECT id, sku, name, price, stock, images FROM products WHERE id = ANY($1)',
            [productIds]
        );

        const productMap = {};
        products.rows.forEach(p => {
            productMap[p.id] = p;
        });

        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = productMap[item.productId];
            if (!product) {
                return res.status(400).json({ error: `Product not found: ${item.productId}` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for: ${product.name}` });
            }

            const itemPrice = parseFloat(product.price);
            subtotal += itemPrice * item.quantity;

            orderItems.push({
                productId: product.id,
                variantId: item.variantId || null,
                productName: product.name,
                productSku: product.sku,
                quantity: item.quantity,
                price: itemPrice,
                size: item.size || null,
                color: item.color || null,
                imageUrl: product.images?.[0] || null
            });
        }

        // Get delivery fee
        const settingsResult = await db.query(
            "SELECT value FROM settings WHERE key = 'free_delivery_threshold'"
        );
        const freeDeliveryThreshold = parseFloat(settingsResult.rows[0]?.value || 80);
        const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : 10;

        const total = subtotal + deliveryFee;

        // Create order
        const orderResult = await db.query(`
            INSERT INTO orders (
                user_id, guest_email, guest_phone, guest_name,
                payment_method, subtotal, delivery_fee, total,
                shipping_address, delivery_date, delivery_time_slot, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            req.user?.id || null,
            guestEmail || null,
            guestPhone || shippingAddress.phone,
            guestName || shippingAddress.name,
            paymentMethod,
            subtotal,
            deliveryFee,
            total,
            JSON.stringify(shippingAddress),
            deliveryDate || null,
            deliveryTimeSlot || null,
            notes || null
        ]);

        const order = orderResult.rows[0];

        // Insert order items
        for (const item of orderItems) {
            await db.query(`
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

            // Update stock
            await db.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.productId]
            );
        }

        // Create initial payment record
        await db.query(`
            INSERT INTO payments (order_id, method, amount)
            VALUES ($1, $2, $3)
        `, [order.id, paymentMethod, total]);

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
                shippingAddress: JSON.parse(order.shipping_address),
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
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await db.query(
        'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
        [req.user.id]
    );

    const result = await db.query(`
        SELECT * FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), offset]);

    const orders = await Promise.all(result.rows.map(async order => {
        const items = await db.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [order.id]
        );

        return {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            paymentMethod: order.payment_method,
            paymentStatus: order.payment_status,
            subtotal: parseFloat(order.subtotal),
            deliveryFee: parseFloat(order.delivery_fee),
            total: parseFloat(order.total),
            itemCount: items.rows.length,
            createdAt: order.created_at
        };
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
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // Check authorization
    if (req.user && order.user_id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
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
        shippingAddress: JSON.parse(order.shipping_address),
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
router.get('/track/:orderNumber', asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;

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

module.exports = router;
