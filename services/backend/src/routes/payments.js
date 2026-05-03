// ===========================================
// PAYMENTS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');
const sentoo = require('../services/sentoo');
const { sendOrderConfirmation, sendWhatsAppNotification } = require('../utils/notifications');

// ===========================================
// POST /api/payments/cod
// Process Cash on Delivery payment
// ===========================================
router.post('/cod',
    [body('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.body;

    // Get order
    const orderResult = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
    );

    if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.payment_method !== 'cod') {
        return res.status(400).json({ error: 'This order is not Cash on Delivery' });
    }

    // Update order status
    await db.query(`
        UPDATE orders
        SET status = 'confirmed', payment_status = 'pending_delivery', updated_at = NOW()
        WHERE id = $1
    `, [orderId]);

    // Update payment record
    await db.query(`
        UPDATE payments
        SET status = 'pending_delivery', updated_at = NOW()
        WHERE order_id = $1
    `, [orderId]);

    res.json({
        message: 'Order confirmed for Cash on Delivery',
        orderNumber: order.order_number,
        paymentStatus: 'pending_delivery',
        instructions: 'Payment will be collected upon delivery. Please have exact amount ready.'
    });
}));

// ===========================================
// POST /api/payments/sentoo
// Create Sentoo transaction via Merchant API
// ===========================================
router.post('/sentoo',
    [body('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.body;

    if (!sentoo.isConfigured()) {
        return res.status(503).json({ error: 'Sentoo payments are not configured' });
    }

    // Get order
    const orderResult = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
    );

    if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.payment_method !== 'sentoo') {
        return res.status(400).json({ error: 'This order is not using Sentoo payment' });
    }

    // Check if transaction already exists (reuse for retries)
    const existingPayment = await db.query(
        'SELECT transaction_id, provider_response FROM payments WHERE order_id = $1 AND transaction_id IS NOT NULL ORDER BY created_at DESC LIMIT 1',
        [orderId]
    );

    if (existingPayment.rows.length > 0 && existingPayment.rows[0].transaction_id) {
        const existing = existingPayment.rows[0];
        const providerData = existing.provider_response || {};

        // Check if existing transaction is still usable (not in final status)
        try {
            const statusResult = await sentoo.fetchStatus(existing.transaction_id);
            if (!['cancelled', 'expired'].includes(statusResult.status)) {
                // Reuse existing transaction
                return res.json({
                    message: 'Sentoo payment ready',
                    orderNumber: order.order_number,
                    transactionId: existing.transaction_id,
                    paymentUrl: providerData.paymentUrl || `${sentoo.PAY_BASE}/p/${existing.transaction_id}`,
                    qrCodeUrl: providerData.qrCodeUrl || `${sentoo.PAY_BASE}/qr/${existing.transaction_id}`,
                    amount: parseFloat(order.total),
                    currency: 'XCG'
                });
            }
        } catch (err) {
            console.warn('Could not check existing Sentoo transaction, creating new one:', err.message);
        }
    }

    // Convert amount to cents (Sentoo requires integer cents, min 100)
    const amountInCents = Math.round(parseFloat(order.total) * 100);

    if (amountInCents < 100) {
        return res.status(400).json({ error: 'Order total too low for Sentoo payment (minimum XCG 1.00)' });
    }

    // Build return URL — Sentoo appends the payment attempt status
    const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
    const returnUrl = `${siteUrl}/payment/callback?orderId=${orderId}&attempt=`;

    // Create Sentoo transaction
    const result = await sentoo.createTransaction({
        amount: amountInCents,
        description: `Order ${order.order_number}`,
        currency: 'XCG',
        returnUrl,
        customer: order.guest_name || order.order_number
    });

    // Store transaction ID and Sentoo response
    await db.query(`
        UPDATE payments
        SET transaction_id = $1, provider_response = $2, updated_at = NOW()
        WHERE order_id = $3
    `, [
        result.transactionId,
        JSON.stringify({ paymentUrl: result.paymentUrl, qrCodeUrl: result.qrCodeUrl }),
        orderId
    ]);

    res.json({
        message: 'Sentoo payment created',
        orderNumber: order.order_number,
        transactionId: result.transactionId,
        paymentUrl: result.paymentUrl,
        qrCodeUrl: result.qrCodeUrl,
        amount: parseFloat(order.total),
        currency: 'XCG'
    });
}));

// ===========================================
// POST /api/payments/sentoo/webhook
// Sentoo transaction status webhook
// Receives: application/x-www-form-urlencoded with transaction_id only
// Must ALWAYS return 200 with {"success":true}
// ===========================================
// NOTE: NOT using asyncHandler — webhook must ALWAYS return 200 with {"success":true}
// If asyncHandler catches an error, the global errorHandler returns 500, which causes Sentoo retries
router.post('/sentoo/webhook', async (req, res) => {
    try {
        const transactionId = req.body.transaction_id;

        console.log('Sentoo webhook received:', { transaction_id: transactionId });

        if (!transactionId) {
            console.warn('Sentoo webhook: missing transaction_id');
            return res.status(200).json({ success: true });
        }

        // Find payment by Sentoo transaction ID
        const paymentResult = await db.query(
            'SELECT p.*, o.payment_status as order_payment_status FROM payments p JOIN orders o ON p.order_id = o.id WHERE p.transaction_id = $1',
            [transactionId]
        );

        if (paymentResult.rows.length === 0) {
            console.warn('Sentoo webhook: payment not found for transaction:', transactionId);
            return res.status(200).json({ success: true });
        }

        const payment = paymentResult.rows[0];

        // Idempotency: skip if already confirmed
        if (payment.order_payment_status === 'paid') {
            console.log('Sentoo webhook: order already paid, skipping:', transactionId);
            return res.status(200).json({ success: true });
        }

        // Fetch actual transaction status from Sentoo API (never trust webhook payload for status)
        try {
            const statusResult = await sentoo.fetchStatus(transactionId);
            const sentooStatus = statusResult.status;

            console.log('Sentoo transaction status:', { transactionId, status: sentooStatus });

            if (sentooStatus === 'success') {
                // Update payment to paid
                await db.query(`
                    UPDATE payments
                    SET status = 'paid', provider_response = $1, updated_at = NOW()
                    WHERE id = $2
                `, [JSON.stringify(statusResult), payment.id]);

                // Update order to confirmed
                await db.query(`
                    UPDATE orders
                    SET status = 'confirmed', payment_status = 'paid', updated_at = NOW()
                    WHERE id = $1
                `, [payment.order_id]);

                // Emit real-time payment update via WebSocket
                const io = req.app.get('io');
                if (io) {
                    io.to(`order:${payment.order_id}`).emit('payment-update', {
                        orderId: payment.order_id,
                        status: 'paid',
                        orderStatus: 'confirmed'
                    });
                }

                // Get order details for notifications
                const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [payment.order_id]);
                const orderItems = await db.query('SELECT * FROM order_items WHERE order_id = $1', [payment.order_id]);

                if (orderResult.rows.length > 0) {
                    sendOrderConfirmation(orderResult.rows[0], orderItems.rows).catch(console.error);
                    sendWhatsAppNotification(orderResult.rows[0], orderItems.rows).catch(console.error);
                }
            } else if (['cancelled', 'expired'].includes(sentooStatus)) {
                // Terminal failure statuses
                await db.query(`
                    UPDATE payments
                    SET status = 'failed', provider_response = $1, updated_at = NOW()
                    WHERE id = $2
                `, [JSON.stringify(statusResult), payment.id]);

                await db.query(`
                    UPDATE orders
                    SET payment_status = 'failed', updated_at = NOW()
                    WHERE id = $1
                `, [payment.order_id]);

                // Emit real-time failure via WebSocket
                const io = req.app.get('io');
                if (io) {
                    io.to(`order:${payment.order_id}`).emit('payment-update', {
                        orderId: payment.order_id,
                        status: 'failed',
                        sentooStatus
                    });
                }
            }
            // For 'issued', 'pending', 'failed' — non-terminal, do nothing and wait for next webhook

        } catch (err) {
            console.error('Sentoo webhook: failed to fetch status:', err.message);
        }

    } catch (err) {
        // Catch ALL errors — webhook must never return non-200
        console.error('Sentoo webhook unhandled error:', err);
    }

    return res.status(200).json({ success: true });
});

// ===========================================
// GET /api/payments/:orderId/sentoo-status
// Poll Sentoo payment status (for frontend callback page)
// ===========================================
router.get('/:orderId/sentoo-status',
    [param('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.params;

    const result = await db.query(`
        SELECT p.*, o.order_number, o.status as order_status, o.payment_status as order_payment_status
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.order_id = $1 AND p.method = 'sentoo'
        ORDER BY p.created_at DESC
        LIMIT 1
    `, [orderId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sentoo payment not found' });
    }

    const payment = result.rows[0];
    const providerData = payment.provider_response || {};

    let sentooStatus = null;
    let sentooData = null;

    // If order is already paid, return immediately without calling Sentoo API
    if (payment.order_payment_status === 'paid') {
        return res.json({
            orderNumber: payment.order_number,
            orderStatus: payment.order_status,
            paymentStatus: payment.order_payment_status,
            sentooStatus: 'success',
            transactionId: payment.transaction_id,
            paymentUrl: providerData.paymentUrl || null,
            qrCodeUrl: providerData.qrCodeUrl || null
        });
    }

    // Fetch latest status from Sentoo API (rate limited: 10 calls/60min per transaction)
    // Only call Sentoo API if we haven't polled recently (cache for 30 seconds)
    const lastPolled = payment.updated_at ? new Date(payment.updated_at).getTime() : 0;
    const shouldPollSentoo = (Date.now() - lastPolled) > 30000; // 30 second cache

    if (payment.transaction_id && sentoo.isConfigured() && shouldPollSentoo) {
        try {
            const statusResult = await sentoo.fetchStatus(payment.transaction_id);
            sentooStatus = statusResult.status;
            sentooData = statusResult.data;

            // If Sentoo says success but our DB hasn't updated yet (webhook race condition)
            if (sentooStatus === 'success' && payment.order_payment_status !== 'paid') {
                await db.query(`
                    UPDATE payments SET status = 'paid', provider_response = $1, updated_at = NOW() WHERE id = $2
                `, [JSON.stringify(statusResult), payment.id]);
                await db.query(`
                    UPDATE orders SET status = 'confirmed', payment_status = 'paid', updated_at = NOW() WHERE id = $1
                `, [payment.order_id]);

                // Send notifications
                const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [payment.order_id]);
                const orderItems = await db.query('SELECT * FROM order_items WHERE order_id = $1', [payment.order_id]);
                if (orderResult.rows.length > 0) {
                    sendOrderConfirmation(orderResult.rows[0], orderItems.rows).catch(console.error);
                    sendWhatsAppNotification(orderResult.rows[0], orderItems.rows).catch(console.error);
                }
            }
        } catch (err) {
            console.warn('Failed to fetch Sentoo status:', err.message);
        }
    }

    res.json({
        orderNumber: payment.order_number,
        orderStatus: sentooStatus === 'success' ? 'confirmed' : payment.order_status,
        paymentStatus: sentooStatus === 'success' ? 'paid' : payment.order_payment_status,
        sentooStatus,
        sentooData,
        transactionId: payment.transaction_id,
        paymentUrl: providerData.paymentUrl || (payment.transaction_id ? `${sentoo.PAY_BASE}/p/${payment.transaction_id}` : null),
        qrCodeUrl: providerData.qrCodeUrl || (payment.transaction_id ? `${sentoo.PAY_BASE}/qr/${payment.transaction_id}` : null)
    });
}));

// ===========================================
// POST /api/payments/bank-transfer
// Process bank transfer payment
// ===========================================
router.post('/bank-transfer',
    [body('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.body;

    // Get order
    const orderResult = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
    );

    if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.payment_method !== 'bank_transfer') {
        return res.status(400).json({ error: 'This order is not using bank transfer' });
    }

    // Generate payment reference
    const paymentReference = order.order_number;

    // Update order status to awaiting payment
    await db.query(`
        UPDATE orders
        SET status = 'awaiting_payment', updated_at = NOW()
        WHERE id = $1
    `, [orderId]);

    await db.query(`
        UPDATE payments
        SET transaction_id = $1, updated_at = NOW()
        WHERE order_id = $2
    `, [paymentReference, orderId]);

    res.json({
        message: 'Bank transfer instructions',
        orderNumber: order.order_number,
        paymentReference,
        amount: parseFloat(order.total),
        currency: 'XCG',
        bankDetails: {
            bankName: 'MCB Bank Curacao',
            accountName: 'Unistyles Curacao',
            accountNumber: 'XXXX-XXXX-XXXX', // Replace with actual
            swift: 'MCBKCWCU'
        },
        instructions: [
            '1. Transfer the exact amount to our bank account',
            `2. Use reference: ${paymentReference}`,
            '3. Send transfer confirmation via WhatsApp',
            '4. Order will be processed after payment verification'
        ]
    });
}));

// ===========================================
// GET /api/payments/:orderId/status
// Check payment status
// ===========================================
router.get('/:orderId/status',
    [param('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.params;

    const result = await db.query(`
        SELECT p.*, o.order_number, o.status as order_status
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.order_id = $1
        ORDER BY p.created_at DESC
        LIMIT 1
    `, [orderId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = result.rows[0];

    res.json({
        orderNumber: payment.order_number,
        orderStatus: payment.order_status,
        paymentStatus: payment.status,
        method: payment.method,
        amount: parseFloat(payment.amount),
        transactionId: payment.transaction_id,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
    });
}));

module.exports = router;
