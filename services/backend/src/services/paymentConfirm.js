// ===========================================
// PAYMENT CONFIRMATION — marks an order paid EXACTLY ONCE.
// Webhook, status polling, admin "re-check" and mock mode all call
// applyProviderStatus(); nothing else may set payment_status = 'paid'
// for an online payment.
// ===========================================

const { setAuditContext, releaseStock, deductOrderStock } = require('./orderOps');

const getDb = () => require('../utils/db');

/**
 * Decide what a provider status means for our payment. Pure (unit-tested).
 * @param {object} p
 * @param {string} p.providerStatus  - issued | pending | failed | cancelled | expired | success
 * @param {object} p.payment         - payments row (status, amount, currency)
 * @param {object} p.order           - orders row (status, total, currency)
 * @param {object} [p.providerData]  - { amount (cents), currency }
 * @returns {{ action: 'mark_paid'|'mark_failed'|'ignore'|'flag_late_payment'|'amount_mismatch', reason?: string }}
 */
function decide({ providerStatus, payment, order, providerData }) {
    if (payment.status === 'paid' || order.payment_status === 'paid') {
        return { action: 'ignore', reason: 'already_paid' };
    }
    if (providerStatus === 'success') {
        if (providerData && providerData.amount !== undefined && providerData.amount !== null) {
            const expected = Math.round(Number(order.total) * 100);
            if (Number(providerData.amount) !== expected) {
                return { action: 'amount_mismatch', reason: `expected ${expected} got ${providerData.amount}` };
            }
        }
        if (providerData?.currency && String(providerData.currency).toUpperCase() !== String(order.currency || 'XCG').toUpperCase()) {
            return { action: 'amount_mismatch', reason: `currency ${providerData.currency}` };
        }
        if (['cancelled', 'expired'].includes(order.status)) {
            // Money arrived after we gave up on the order: keep it, but a human must decide.
            return { action: 'flag_late_payment' };
        }
        return { action: 'mark_paid' };
    }
    if (['cancelled', 'expired', 'failed'].includes(providerStatus)) {
        if (payment.status === 'failed' || ['cancelled', 'expired'].includes(order.status)) {
            return { action: 'ignore', reason: 'already_closed' };
        }
        // Sentoo 'failed' is non-terminal (customer may retry); cancelled/expired are terminal.
        return providerStatus === 'failed' ? { action: 'ignore', reason: 'non_terminal_failure' } : { action: 'mark_failed' };
    }
    return { action: 'ignore', reason: 'pending' };
}

/**
 * Apply a provider status inside one transaction with the payment row locked.
 * @param {object} p
 * @param {string} p.transactionId
 * @param {string} p.providerStatus
 * @param {object} [p.providerData]
 * @param {'webhook'|'poll'|'admin'|'mock'} p.source
 * @param {object} [p.io] - socket.io server for real-time updates
 * @returns {{ result: string, orderId?: string, order?: object }}
 */
async function applyProviderStatus({ transactionId, providerStatus, providerData = null, source, io = null, userId = null }) {
    const client = await getDb().getClient();
    let outcome = { result: 'not_found' };
    try {
        await client.query('BEGIN');
        const paymentRes = await client.query(
            'SELECT * FROM payments WHERE transaction_id = $1 FOR UPDATE',
            [transactionId]
        );
        if (paymentRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return outcome;
        }
        const payment = paymentRes.rows[0];
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [payment.order_id]);
        const order = orderRes.rows[0];

        const decision = decide({ providerStatus, payment, order, providerData });
        await setAuditContext(client, { userId, note: `Payment ${providerStatus} (${source})` });

        if (decision.action === 'mark_paid') {
            await client.query(
                `UPDATE payments SET status = 'paid', paid_at = NOW(), provider_response = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ status: providerStatus, data: providerData }), payment.id]
            );
            await client.query(
                `UPDATE orders SET payment_status = 'paid',
                        status = CASE WHEN status IN ('pending','awaiting_payment') THEN 'confirmed' ELSE status END,
                        payment_expires_at = NULL, updated_at = NOW()
                 WHERE id = $1`,
                [order.id]
            );
            // DEC-017: the verified payment is the confirmation event
            await deductOrderStock(client, order.id, { strict: false });
        } else if (decision.action === 'flag_late_payment') {
            await client.query(
                `UPDATE payments SET status = 'paid', paid_at = NOW(), provider_response = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ status: providerStatus, data: providerData }), payment.id]
            );
            await client.query(
                `UPDATE orders SET payment_status = 'paid', needs_review = true,
                        admin_notes = COALESCE(admin_notes || E'\\n', '') || 'Payment received after the order was closed — refund or re-open.',
                        updated_at = NOW()
                 WHERE id = $1`,
                [order.id]
            );
        } else if (decision.action === 'amount_mismatch') {
            await client.query(
                `UPDATE payments SET failure_reason = $1, provider_response = $2, updated_at = NOW() WHERE id = $3`,
                [`amount_mismatch: ${decision.reason}`, JSON.stringify({ status: providerStatus, data: providerData }), payment.id]
            );
            await client.query('UPDATE orders SET needs_review = true, updated_at = NOW() WHERE id = $1', [order.id]);
        } else if (decision.action === 'mark_failed') {
            await client.query(
                `UPDATE payments SET status = $1, failure_reason = $2, provider_response = $3, updated_at = NOW() WHERE id = $4`,
                [providerStatus === 'expired' ? 'expired' : 'failed', providerStatus, JSON.stringify({ status: providerStatus, data: providerData }), payment.id]
            );
            // The order itself stays awaiting_payment so the customer can retry
            // until the expiry job closes it and releases the stock.
            await client.query(`UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`, [order.id]);
        }

        await client.query(
            `INSERT INTO payment_events (payment_id, order_id, source, provider_status, result, payload)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [payment.id, order.id, source, providerStatus, decision.action + (decision.reason ? `:${decision.reason}` : ''), providerData ? JSON.stringify(providerData) : null]
        );

        await client.query('COMMIT');
        outcome = { result: decision.action, orderId: order.id };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }

    if (outcome.result === 'mark_paid' || outcome.result === 'mark_failed') {
        const db = getDb();
        const [orderRes, itemsRes] = await Promise.all([
            db.query('SELECT * FROM orders WHERE id = $1', [outcome.orderId]),
            db.query('SELECT * FROM order_items WHERE order_id = $1', [outcome.orderId])
        ]);
        outcome.order = orderRes.rows[0];
        if (io) {
            io.to(`order:${outcome.orderId}`).emit('payment-update', {
                orderId: outcome.orderId,
                status: outcome.result === 'mark_paid' ? 'paid' : 'failed',
                orderStatus: outcome.order?.status
            });
        }
        if (outcome.result === 'mark_paid' && outcome.order) {
            const { sendOrderConfirmation, sendWhatsAppNotification } = require('../utils/notifications');
            sendOrderConfirmation(outcome.order, itemsRes.rows).catch(err => console.error('[payments] email failed:', err.message));
            sendWhatsAppNotification(outcome.order, itemsRes.rows).catch(err => console.error('[payments] whatsapp failed:', err.message));
        }
    }
    return outcome;
}

/**
 * Close unpaid online orders whose payment window has passed and release their stock.
 * Uses an advisory lock so two backend instances never run it at the same time.
 */
async function expireUnpaidOrders({ sentoo = null } = {}) {
    const client = await getDb().getClient();
    let expired = [];
    try {
        const lock = await client.query('SELECT pg_try_advisory_lock(424242) AS ok');
        if (!lock.rows[0].ok) return [];
        try {
            const due = await client.query(
                `SELECT o.id, p.transaction_id, p.method
                 FROM orders o LEFT JOIN payments p ON p.order_id = o.id
                 WHERE o.status = 'awaiting_payment' AND o.payment_status <> 'paid'
                   AND o.payment_expires_at IS NOT NULL AND o.payment_expires_at < NOW()
                 LIMIT 50`
            );
            const { cancelOrder } = require('./orderOps');
            for (const row of due.rows) {
                try {
                    await client.query('BEGIN');
                    await cancelOrder(client, row.id, { note: 'Payment window expired', expired: true });
                    await client.query(
                        `INSERT INTO payment_events (order_id, source, provider_status, result) VALUES ($1, 'system', 'expired', 'order_expired')`,
                        [row.id]
                    );
                    await client.query('COMMIT');
                    expired.push(row.id);
                    if (sentoo && row.method === 'sentoo' && row.transaction_id && sentoo.isConfigured()) {
                        sentoo.cancelTransaction(row.transaction_id).catch(() => {});
                    }
                } catch (err) {
                    await client.query('ROLLBACK').catch(() => {});
                    console.error('[expire] failed for order', row.id, err.message || err);
                }
            }
        } finally {
            await client.query('SELECT pg_advisory_unlock(424242)');
        }
    } finally {
        client.release();
    }
    return expired;
}

module.exports = { decide, applyProviderStatus, expireUnpaidOrders, releaseStock };
