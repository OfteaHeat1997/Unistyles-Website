// ===========================================
// ORDER OPERATIONS — status changes, stock deduction on confirmation and release.
// Every function takes a pg client that is ALREADY inside a transaction.
// ===========================================

const crypto = require('crypto');
const { checkTransition } = require('./orderState');

function newTrackingToken() {
    return crypto.randomBytes(18).toString('base64url'); // 24 chars, URL safe
}

/** Make the status-history trigger record who changed it and why. */
async function setAuditContext(client, { userId = null, note = null } = {}) {
    await client.query(`SELECT set_config('app.user_id', $1, true), set_config('app.status_note', $2, true)`, [
        userId || '',
        note || ''
    ]);
}

/**
 * Deduct stock for one line and record the movement.
 * Throws {statusCode:409} if there is not enough stock (rows must be locked by the caller).
 */
async function reserveLine(client, line, orderId) {
    if (line.variantId) {
        const r = await client.query(
            `UPDATE product_variants SET stock_quantity = stock_quantity - $1
             WHERE id = $2 AND stock_quantity >= $1 RETURNING stock_quantity`,
            [line.quantity, line.variantId]
        );
        if (r.rowCount === 0) throw { statusCode: 409, message: `Not enough stock for ${line.name}` };
    } else {
        const r = await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity - $1,
                 in_stock = CASE WHEN stock_quantity - $1 <= 0 THEN false ELSE in_stock END
             WHERE id = $2 AND (stock_quantity IS NULL OR stock_quantity >= $1)
             RETURNING stock_quantity`,
            [line.quantity, line.productId]
        );
        if (r.rowCount === 0) throw { statusCode: 409, message: `Not enough stock for ${line.name}` };
    }
    await client.query(
        `INSERT INTO inventory_movements (product_id, variant_id, delta, reason, order_id)
         VALUES ($1, $2, $3, 'order', $4)`,
        [line.productId, line.variantId, -line.quantity, orderId]
    );
}

/**
 * DEC-017: stock is deducted only when the order is confirmed (staff confirms a
 * cash order, a transfer is received, an online payment is verified) — never
 * when the cart is filled or an unconfirmed order is placed. Runs once per order.
 *
 * @param {object} opts
 * @param {boolean} [opts.strict=true] - true: throw 409 if a line is short (staff can
 *   call the customer first). false: deduct what exists and flag the order for review
 *   (used when money was already received and cannot be refused).
 * @returns {{ alreadyDeducted: boolean, short: string[] }}
 */
async function deductOrderStock(client, orderId, { strict = true } = {}) {
    const done = await client.query(
        `SELECT 1 FROM inventory_movements WHERE order_id = $1 AND reason = 'order' LIMIT 1`, [orderId]);
    if (done.rowCount > 0) return { alreadyDeducted: true, short: [] };

    const items = await client.query(
        `SELECT product_id AS "productId", variant_id AS "variantId", product_name AS name, quantity
         FROM order_items WHERE order_id = $1 ORDER BY id`, [orderId]);
    // Same lock order everywhere avoids deadlocks between two confirmations
    const lockKey = (l) => (l.variantId ? `v:${l.variantId}` : `p:${l.productId}`);
    for (const line of [...items.rows].sort((a, b) => lockKey(a).localeCompare(lockKey(b)))) {
        if (line.variantId) await client.query('SELECT id FROM product_variants WHERE id = $1 FOR UPDATE', [line.variantId]);
        else await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [line.productId]);
    }

    const short = [];
    for (const line of items.rows) {
        try {
            await reserveLine(client, line, orderId);
        } catch (err) {
            if (err.statusCode !== 409) throw err;
            if (strict) throw { statusCode: 409, message: `${err.message}. Contact the customer before confirming.` };
            short.push(line.name);
        }
    }
    if (short.length > 0) {
        await client.query(
            `UPDATE orders SET needs_review = true,
                    admin_notes = COALESCE(admin_notes || E'\\n', '') || $2
             WHERE id = $1`,
            [orderId, `Confirmed without enough stock for: ${short.join(', ')}`]
        );
    }
    return { alreadyDeducted: false, short };
}

/**
 * Put the stock of an order back exactly once (guarded by the movements log).
 * @param {'order_cancelled'|'payment_expired'|'return'} reason
 */
async function releaseStock(client, orderId, reason, userId = null) {
    const already = await client.query(
        `SELECT 1 FROM inventory_movements
         WHERE order_id = $1 AND reason IN ('order_cancelled','payment_expired','return') LIMIT 1`,
        [orderId]
    );
    if (already.rowCount > 0) return 0;

    const reserved = await client.query(
        `SELECT product_id, variant_id, -SUM(delta)::int AS qty
         FROM inventory_movements WHERE order_id = $1 AND reason = 'order'
         GROUP BY product_id, variant_id`,
        [orderId]
    );
    for (const row of reserved.rows) {
        if (row.qty <= 0) continue;
        if (row.variant_id) {
            await client.query('UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2', [row.qty, row.variant_id]);
        } else {
            await client.query(
                'UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + $1, in_stock = true WHERE id = $2',
                [row.qty, row.product_id]
            );
        }
        await client.query(
            `INSERT INTO inventory_movements (product_id, variant_id, delta, reason, order_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [row.product_id, row.variant_id, row.qty, reason, orderId, userId]
        );
    }
    return reserved.rowCount;
}

/**
 * Validated status change. Locks the order row.
 * @returns the updated order row
 */
async function transition(client, orderId, to, { userId = null, note = null, force = false } = {}) {
    const current = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (current.rowCount === 0) throw { statusCode: 404, message: 'Order not found' };
    const order = current.rows[0];

    if (!force) {
        const check = checkTransition(order.status, to, {
            fulfillmentMethod: order.fulfillment_method,
            paymentStatus: order.payment_status
        });
        if (!check.ok) throw { statusCode: 422, message: check.reason };
    }

    await setAuditContext(client, { userId, note });
    const updated = await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [to, orderId]
    );
    return updated.rows[0];
}

/**
 * Cancel (or expire) an order: status, payment status, stock.
 * Paid orders are flagged needs_review so the owner issues the refund.
 */
async function cancelOrder(client, orderId, { userId = null, note = null, expired = false } = {}) {
    const to = expired ? 'expired' : 'cancelled';
    const order = await transition(client, orderId, to, { userId, note });
    const wasPaid = order.payment_status === 'paid';
    const newPaymentStatus = wasPaid ? 'paid' : (expired ? 'expired' : 'cancelled');

    await client.query(
        `UPDATE orders SET payment_status = $1, needs_review = (needs_review OR $2), updated_at = NOW() WHERE id = $3`,
        [newPaymentStatus, wasPaid, orderId]
    );
    await client.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE order_id = $2 AND status NOT IN ('paid','refunded')`,
        [expired ? 'expired' : 'cancelled', orderId]
    );
    await releaseStock(client, orderId, expired ? 'payment_expired' : 'order_cancelled', userId);

    return { ...order, payment_status: newPaymentStatus, needs_review: order.needs_review || wasPaid };
}

module.exports = { newTrackingToken, setAuditContext, reserveLine, deductOrderStock, releaseStock, transition, cancelOrder };
