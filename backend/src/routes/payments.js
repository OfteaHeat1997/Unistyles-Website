// ===========================================
// PAYMENTS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// ===========================================
// POST /api/payments/cod
// Process Cash on Delivery payment
// ===========================================
router.post('/cod', asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'Order ID required' });
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
// Initialize Sentoo payment
// ===========================================
router.post('/sentoo', asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'Order ID required' });
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

    // Generate Sentoo payment reference
    const paymentReference = `UNI-${order.order_number}`;

    // In production, you would call Sentoo API here
    // For now, we return payment instructions
    const sentooPaymentData = {
        reference: paymentReference,
        amount: parseFloat(order.total),
        currency: 'ANG',
        merchantId: process.env.SENTOO_MERCHANT_ID,
        // In production: QR code or deep link from Sentoo API
    };

    // Update payment record with reference
    await db.query(`
        UPDATE payments
        SET transaction_id = $1, updated_at = NOW()
        WHERE order_id = $2
    `, [paymentReference, orderId]);

    res.json({
        message: 'Sentoo payment initialized',
        orderNumber: order.order_number,
        paymentReference,
        amount: parseFloat(order.total),
        currency: 'ANG',
        instructions: [
            '1. Open Sentoo app on your phone',
            '2. Select "Pay"',
            `3. Enter reference: ${paymentReference}`,
            `4. Confirm amount: ANG ${order.total}`,
            '5. Complete payment'
        ]
    });
}));

// ===========================================
// POST /api/payments/sentoo/webhook
// Sentoo payment webhook (called by Sentoo)
// ===========================================
router.post('/sentoo/webhook', asyncHandler(async (req, res) => {
    const { transactionId, reference, status, amount } = req.body;

    // Verify webhook signature (in production)
    // const signature = req.headers['x-sentoo-signature'];
    // if (!verifySignature(signature, req.body)) {
    //     return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Find payment by reference
    const paymentResult = await db.query(
        'SELECT * FROM payments WHERE transaction_id = $1',
        [reference]
    );

    if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    if (status === 'completed' || status === 'success') {
        // Update payment
        await db.query(`
            UPDATE payments
            SET status = 'paid', provider_response = $1, updated_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(req.body), payment.id]);

        // Update order
        await db.query(`
            UPDATE orders
            SET status = 'confirmed', payment_status = 'paid', updated_at = NOW()
            WHERE id = $1
        `, [payment.order_id]);

        // TODO: Send confirmation email/WhatsApp
    } else if (status === 'failed' || status === 'cancelled') {
        await db.query(`
            UPDATE payments
            SET status = 'failed', provider_response = $1, updated_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(req.body), payment.id]);

        await db.query(`
            UPDATE orders
            SET payment_status = 'failed', updated_at = NOW()
            WHERE id = $1
        `, [payment.order_id]);
    }

    res.json({ received: true });
}));

// ===========================================
// POST /api/payments/bank-transfer
// Process bank transfer payment
// ===========================================
router.post('/bank-transfer', asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'Order ID required' });
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
        currency: 'ANG',
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
router.get('/:orderId/status', asyncHandler(async (req, res) => {
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
