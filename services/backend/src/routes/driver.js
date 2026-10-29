// ===========================================
// DRIVER ROUTES — delivery operator app (/driver)
// Role 'driver' sees the stops assigned to them; 'admin' sees all.
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const db = require('../utils/db');
const { transition } = require('../services/orderOps');
const { LABELS } = require('../services/orderState');
const { curacaoParts } = require('../services/fulfillment');
const { sendOrderStatusUpdate } = require('../utils/notifications');

router.use(authenticate, requireRole('driver', 'admin'));

const FAIL_REASONS = ['not_home', 'wrong_address', 'refused', 'no_payment', 'other'];

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
        return false;
    }
    return true;
}

async function loadAssignedOrder(req, id) {
    const r = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    const order = r.rows[0];
    if (!order || order.fulfillment_method !== 'delivery') return null;
    if (req.user.role !== 'admin' && order.assigned_driver_id !== req.user.id) return null;
    return order;
}

// GET /api/driver/stops?date=YYYY-MM-DD
router.get('/stops', [query('date').optional().isISO8601()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const date = req.query.date || curacaoParts().date;
    const params = [date];
    let mine = '';
    if (req.user.role !== 'admin') {
        params.push(req.user.id);
        mine = `AND o.assigned_driver_id = $2`;
    }
    const r = await db.query(`
        SELECT o.*, (SELECT COUNT(*)::int FROM order_items i WHERE i.order_id = o.id) AS item_count
        FROM orders o
        WHERE o.fulfillment_method = 'delivery' AND o.delivery_date = $1
          AND o.status IN ('processing','out_for_delivery','delivery_failed','delivered')
          ${mine}
        ORDER BY o.delivery_time_slot, o.delivery_zone_name, o.created_at`, params);

    res.json({
        date,
        stops: r.rows.map(o => {
            const a = o.shipping_address || {};
            return {
                id: o.id,
                orderNumber: o.order_number,
                status: o.status,
                statusLabel: LABELS[o.status],
                slot: o.delivery_time_slot,
                zone: o.delivery_zone_name,
                customerName: o.guest_name,
                phone: o.guest_phone,
                street: a.street,
                area: a.area,
                landmark: a.landmark,
                lat: o.delivery_lat !== null ? parseFloat(o.delivery_lat) : null,
                lng: o.delivery_lng !== null ? parseFloat(o.delivery_lng) : null,
                itemCount: o.item_count,
                collectCash: o.payment_status === 'pending_delivery' ? parseFloat(o.total) : 0,
                paymentStatus: o.payment_status,
                notes: o.notes
            };
        })
    });
}));

// POST /api/driver/orders/:id/start — processing | delivery_failed → out_for_delivery
router.post('/orders/:id/start', [param('id').isUUID()], asyncHandler(async (req, res) => {
    if (!validate(req, res)) return;
    const order = await loadAssignedOrder(req, req.params.id);
    if (!order) return res.status(404).json({ error: 'Stop not found' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const updated = await transition(client, order.id, 'out_for_delivery', { userId: req.user.id, note: 'Driver started route' });
        await client.query('COMMIT');
        sendOrderStatusUpdate(updated, 'out_for_delivery').catch(() => {});
        res.json({ status: updated.status });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        throw err;
    } finally {
        client.release();
    }
}));

// POST /api/driver/orders/:id/delivered { recipientName, note, codCollected }
router.post('/orders/:id/delivered',
    [param('id').isUUID(), body('recipientName').trim().notEmpty().isLength({ max: 200 }).withMessage('Who received the package?'),
     body('note').optional().isString().isLength({ max: 500 }), body('codCollected').optional().isBoolean()],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const order = await loadAssignedOrder(req, req.params.id);
        if (!order) return res.status(404).json({ error: 'Stop not found' });
        if (order.payment_status === 'pending_delivery' && !req.body.codCollected) {
            return res.status(422).json({ error: `Collect XCG ${parseFloat(order.total).toFixed(2)} in cash before confirming` });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const updated = await transition(client, order.id, 'delivered', { userId: req.user.id, note: `Delivered to ${req.body.recipientName}` });
            await client.query(
                `INSERT INTO delivery_attempts (order_id, driver_id, outcome, recipient_name, note, cod_collected)
                 VALUES ($1, $2, 'delivered', $3, $4, $5)`,
                [order.id, req.user.id, req.body.recipientName, req.body.note || null, !!req.body.codCollected]);
            if (order.payment_status === 'pending_delivery') {
                await client.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1`, [order.id]);
                await client.query(`UPDATE payments SET status = 'paid', paid_at = NOW() WHERE order_id = $1 AND status <> 'paid'`, [order.id]);
            }
            await client.query('COMMIT');
            sendOrderStatusUpdate(updated, 'delivered').catch(() => {});
            res.json({ status: 'delivered' });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
            throw err;
        } finally {
            client.release();
        }
    })
);

// POST /api/driver/orders/:id/failed { reason, note }
router.post('/orders/:id/failed',
    [param('id').isUUID(), body('reason').isIn(FAIL_REASONS).withMessage('Choose a reason'), body('note').optional().isString().isLength({ max: 500 })],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const order = await loadAssignedOrder(req, req.params.id);
        if (!order) return res.status(404).json({ error: 'Stop not found' });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const updated = await transition(client, order.id, 'delivery_failed', { userId: req.user.id, note: `Failed: ${req.body.reason}${req.body.note ? ` — ${req.body.note}` : ''}` });
            await client.query(
                `INSERT INTO delivery_attempts (order_id, driver_id, outcome, reason, note) VALUES ($1, $2, 'failed', $3, $4)`,
                [order.id, req.user.id, req.body.reason, req.body.note || null]);
            await client.query('COMMIT');
            sendOrderStatusUpdate(updated, 'delivery_failed').catch(() => {});
            res.json({ status: 'delivery_failed' });
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
            throw err;
        } finally {
            client.release();
        }
    })
);

module.exports = router;
module.exports.FAIL_REASONS = FAIL_REASONS;
