// ===========================================
// PAYMENTS ROUTES
// Online payments (Sentoo, or the mock provider for demos) are confirmed
// only by services/paymentConfirm.js#applyProviderStatus — exactly once,
// with the payment row locked and the amount verified.
// COD / bank transfer / WhatsApp are confirmed by staff in the admin panel.
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const db = require('../utils/db');
const sentoo = require('../services/sentoo');
const { applyProviderStatus } = require('../services/paymentConfirm');

const isMock = () => process.env.PAYMENTS_MODE === 'mock';

/** Normalize Sentoo's status data to { amount (cents), currency } when present. */
function providerDataFrom(statusResult) {
    const data = statusResult?.data;
    if (!data || typeof data !== 'object') return null;
    const rawAmount = data.amount ?? data.sentoo_amount;
    let amount;
    if (rawAmount !== undefined && rawAmount !== null && process.env.SENTOO_VERIFY_AMOUNT !== 'false') {
        amount = String(rawAmount).includes('.') ? Math.round(parseFloat(rawAmount) * 100) : parseInt(rawAmount, 10);
        if (!Number.isFinite(amount)) amount = undefined;
    }
    return { amount, currency: data.currency ?? data.sentoo_currency, raw: data };
}

async function findAccessibleOrder(req, orderId) {
    const result = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = result.rows[0];
    if (!order) return null;
    const token = req.body?.trackingToken || req.query?.t;
    if (token && token === order.tracking_token) return order;
    if (req.user && req.user.id === order.user_id) return order;
    return null;
}

// ===========================================
// POST /api/payments/sentoo  — create (or reuse) the online payment session
// body: { orderId, trackingToken }
// ===========================================
router.post('/sentoo',
    optionalAuth,
    [body('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const order = await findAccessibleOrder(req, req.body.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.payment_method !== 'sentoo') return res.status(400).json({ error: 'This order is not paid online' });
        if (order.payment_status === 'paid') return res.status(409).json({ error: 'This order is already paid', code: 'already_paid' });
        if (order.status !== 'awaiting_payment') {
            return res.status(409).json({ error: 'The payment window for this order has closed', code: 'closed' });
        }

        const siteUrl = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');

        if (isMock()) {
            const transactionId = `mock_${order.id}`;
            await db.query(
                `UPDATE payments SET transaction_id = $1, provider = 'mock', updated_at = NOW()
                 WHERE order_id = $2 AND transaction_id IS NULL`,
                [transactionId, order.id]
            );
            await db.query(`UPDATE orders SET payment_status = 'pending', updated_at = NOW() WHERE id = $1 AND payment_status = 'failed'`, [order.id]);
            await db.query(`UPDATE payments SET status = 'pending', updated_at = NOW() WHERE order_id = $1 AND status = 'failed'`, [order.id]);
            return res.json({
                transactionId,
                paymentUrl: `${siteUrl}/payment/mock?orderId=${order.id}&t=${order.tracking_token}`,
                qrCodeUrl: null,
                amount: parseFloat(order.total),
                currency: order.currency || 'XCG',
                mode: 'mock'
            });
        }

        if (!sentoo.isConfigured()) return res.status(503).json({ error: 'Online payments are not configured' });

        // Reuse a still-open Sentoo transaction (retries, page refresh)
        const existing = await db.query(
            'SELECT transaction_id, provider_response FROM payments WHERE order_id = $1 AND transaction_id IS NOT NULL ORDER BY created_at DESC LIMIT 1',
            [order.id]
        );
        if (existing.rows[0]) {
            const providerData = existing.rows[0].provider_response || {};
            try {
                const status = await sentoo.fetchStatus(existing.rows[0].transaction_id);
                if (status.status === 'success') {
                    await applyProviderStatus({
                        transactionId: existing.rows[0].transaction_id, providerStatus: 'success',
                        providerData: providerDataFrom(status), source: 'poll', io: req.app.get('io')
                    });
                    return res.status(409).json({ error: 'This order is already paid', code: 'already_paid' });
                }
                if (!['cancelled', 'expired'].includes(status.status)) {
                    return res.json({
                        transactionId: existing.rows[0].transaction_id,
                        paymentUrl: providerData.paymentUrl || `${sentoo.PAY_BASE}/p/${existing.rows[0].transaction_id}`,
                        qrCodeUrl: providerData.qrCodeUrl || `${sentoo.PAY_BASE}/qr/${existing.rows[0].transaction_id}`,
                        amount: parseFloat(order.total),
                        currency: order.currency || 'XCG'
                    });
                }
            } catch (err) {
                console.warn('[payments] could not check existing Sentoo transaction:', err.message);
            }
        }

        const amountInCents = Math.round(parseFloat(order.total) * 100);
        const result = await sentoo.createTransaction({
            amount: amountInCents,
            description: `Order ${order.order_number}`,
            currency: order.currency || 'XCG',
            returnUrl: `${siteUrl}/payment/callback?orderId=${order.id}&t=${order.tracking_token}&attempt=`,
            customer: order.order_number,
            expires: order.payment_expires_at ? new Date(order.payment_expires_at).toISOString() : undefined
        });

        // A new transaction replaces the previous (closed) one on the same payment row.
        await db.query(
            `UPDATE payments SET transaction_id = $1, provider = 'sentoo', provider_response = $2, status = 'pending', updated_at = NOW()
             WHERE id = (SELECT id FROM payments WHERE order_id = $3 ORDER BY created_at DESC LIMIT 1)`,
            [result.transactionId, JSON.stringify({ paymentUrl: result.paymentUrl, qrCodeUrl: result.qrCodeUrl }), order.id]
        );
        await db.query(`UPDATE orders SET payment_status = 'pending', updated_at = NOW() WHERE id = $1 AND payment_status = 'failed'`, [order.id]);

        res.json({
            transactionId: result.transactionId,
            paymentUrl: result.paymentUrl,
            qrCodeUrl: result.qrCodeUrl,
            amount: parseFloat(order.total),
            currency: order.currency || 'XCG'
        });
    })
);

// ===========================================
// POST /api/payments/sentoo/webhook
// Sentoo posts transaction_id only. We ALWAYS answer 200 {"success":true}
// (a non-200 makes Sentoo retry) and always re-fetch the real status.
// ===========================================
router.post('/sentoo/webhook', async (req, res) => {
    try {
        const transactionId = req.body?.transaction_id;
        if (transactionId && sentoo.isConfigured()) {
            const status = await sentoo.fetchStatus(transactionId);
            const outcome = await applyProviderStatus({
                transactionId,
                providerStatus: status.status,
                providerData: providerDataFrom(status),
                source: 'webhook',
                io: req.app.get('io')
            });
            console.log('[sentoo webhook]', { transactionId, status: status.status, result: outcome.result });
        } else {
            console.warn('[sentoo webhook] ignored', { hasId: !!transactionId, configured: sentoo.isConfigured() });
        }
    } catch (err) {
        console.error('[sentoo webhook] error:', err.message);
    }
    return res.status(200).json({ success: true });
});

// ===========================================
// GET /api/payments/:orderId/sentoo-status — polled by the callback page
// ===========================================
router.get('/:orderId/sentoo-status',
    [param('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const result = await db.query(`
            SELECT p.*, o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
                   o.tracking_token, o.payment_expires_at, o.total
            FROM payments p JOIN orders o ON p.order_id = o.id
            WHERE p.order_id = $1 AND p.method = 'sentoo'
            ORDER BY p.created_at DESC LIMIT 1`, [req.params.orderId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });

        let payment = result.rows[0];
        let providerStatus = null;

        // Ask Sentoo at most every 30 s per transaction (their limit is 10 calls / hour)
        const lastTouch = payment.updated_at ? new Date(payment.updated_at).getTime() : 0;
        if (payment.order_payment_status !== 'paid' && payment.transaction_id && !isMock()
            && sentoo.isConfigured() && Date.now() - lastTouch > 30000) {
            try {
                const status = await sentoo.fetchStatus(payment.transaction_id);
                providerStatus = status.status;
                await applyProviderStatus({
                    transactionId: payment.transaction_id, providerStatus, providerData: providerDataFrom(status),
                    source: 'poll', io: req.app.get('io')
                });
                await db.query('UPDATE payments SET updated_at = NOW() WHERE id = $1', [payment.id]);
                const fresh = await db.query(
                    `SELECT o.status AS order_status, o.payment_status AS order_payment_status FROM orders o WHERE o.id = $1`,
                    [payment.order_id]
                );
                payment = { ...payment, ...fresh.rows[0] };
            } catch (err) {
                console.warn('[payments] status poll failed:', err.message);
            }
        }

        const providerData = payment.provider_response || {};
        res.json({
            orderNumber: payment.order_number,
            orderStatus: payment.order_status,
            paymentStatus: payment.order_payment_status,
            sentooStatus: providerStatus,
            expiresAt: payment.payment_expires_at,
            amount: parseFloat(payment.total),
            paymentUrl: providerData.paymentUrl || null,
            qrCodeUrl: providerData.qrCodeUrl || null
        });
    })
);

// ===========================================
// POST /api/payments/mock/:orderId — demo provider (PAYMENTS_MODE=mock only)
// body: { outcome: 'approve'|'decline'|'abandon', trackingToken }
// ===========================================
router.post('/mock/:orderId',
    optionalAuth,
    [
        param('orderId').isUUID(),
        body('outcome').isIn(['approve', 'decline', 'abandon'])
    ],
    asyncHandler(async (req, res) => {
        if (!isMock()) return res.status(404).json({ error: 'Endpoint not found' });
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const order = await findAccessibleOrder(req, req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const transactionId = `mock_${order.id}`;
        const providerStatus = { approve: 'success', decline: 'cancelled', abandon: 'pending' }[req.body.outcome];
        const outcome = await applyProviderStatus({
            transactionId,
            providerStatus,
            providerData: { amount: Math.round(parseFloat(order.total) * 100), currency: order.currency || 'XCG' },
            source: 'mock',
            io: req.app.get('io')
        });
        res.json({ result: outcome.result, orderNumber: order.order_number, trackingToken: order.tracking_token });
    })
);

// ===========================================
// GET /api/payments/:orderId/status — generic status (any method)
// ===========================================
router.get('/:orderId/status',
    [param('orderId').isUUID().withMessage('Valid order ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const result = await db.query(`
            SELECT p.method, p.status, p.amount, p.created_at, p.updated_at,
                   o.order_number, o.status AS order_status, o.payment_status
            FROM payments p JOIN orders o ON p.order_id = o.id
            WHERE p.order_id = $1 ORDER BY p.created_at DESC LIMIT 1`, [req.params.orderId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });

        const p = result.rows[0];
        res.json({
            orderNumber: p.order_number,
            orderStatus: p.order_status,
            paymentStatus: p.payment_status,
            method: p.method,
            amount: parseFloat(p.amount),
            createdAt: p.created_at,
            updatedAt: p.updated_at
        });
    })
);

module.exports = router;
module.exports.providerDataFrom = providerDataFrom;
