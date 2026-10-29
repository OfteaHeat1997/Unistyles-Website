// ===========================================
// ORDER STATE MACHINE
// The only place that decides which status changes are legal.
// Diagram: docs/PROMPT-FULL-IMPLEMENTATION.md §5.7
// ===========================================

const STATUS = {
    PENDING: 'pending',
    AWAITING_PAYMENT: 'awaiting_payment',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    READY_FOR_PICKUP: 'ready_for_pickup',
    PICKED_UP: 'picked_up',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    DELIVERY_FAILED: 'delivery_failed',
    RETURNED: 'returned',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
};

const TRANSITIONS = {
    pending:          ['awaiting_payment', 'confirmed', 'cancelled'],
    awaiting_payment: ['confirmed', 'cancelled', 'expired'],
    confirmed:        ['processing', 'cancelled'],
    processing:       ['ready_for_pickup', 'out_for_delivery', 'cancelled'],
    ready_for_pickup: ['picked_up', 'cancelled'],
    out_for_delivery: ['delivered', 'delivery_failed'],
    delivery_failed:  ['out_for_delivery', 'returned', 'cancelled'],
    picked_up:        [],
    delivered:        ['returned'],
    returned:         [],
    cancelled:        [],
    expired:          []
};

const PICKUP_ONLY = new Set(['ready_for_pickup', 'picked_up']);
const DELIVERY_ONLY = new Set(['out_for_delivery', 'delivered', 'delivery_failed']);

// Preparing the package requires money confirmed, or an approved pay-on-handover method.
const NEEDS_PAYMENT_OK = new Set(['processing', 'ready_for_pickup', 'out_for_delivery']);
const PAYMENT_OK = new Set(['paid', 'pending_delivery']);

// Customers may cancel their own order only before it is being prepared.
const CUSTOMER_CANCELLABLE = new Set(['pending', 'awaiting_payment', 'confirmed']);

const TERMINAL = new Set(['picked_up', 'returned', 'cancelled', 'expired']);

// Customer-facing names follow the 8 statuses of DEC-012 (Received, Pending payment, Paid,
// Preparing, Out for delivery, Delivered, Cancelled, Returned); the extra internal states
// (pickup, failed attempt, expired) only appear when they apply.
const LABELS = {
    pending: 'Received',
    awaiting_payment: 'Pending payment',
    confirmed: 'Confirmed',
    processing: 'Preparing',
    ready_for_pickup: 'Ready for pickup',
    picked_up: 'Picked up',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    delivery_failed: 'Delivery attempt failed',
    returned: 'Returned',
    cancelled: 'Cancelled',
    expired: 'Payment expired'
};

/**
 * @param {string} from
 * @param {string} to
 * @param {{ fulfillmentMethod?: string, paymentStatus?: string }} ctx
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkTransition(from, to, ctx = {}) {
    if (!TRANSITIONS[from]) return { ok: false, reason: `Unknown current status "${from}"` };
    if (!TRANSITIONS[to]) return { ok: false, reason: `Unknown status "${to}"` };
    if (from === to) return { ok: false, reason: `Order is already "${to}"` };
    if (!TRANSITIONS[from].includes(to)) {
        return { ok: false, reason: `Cannot move an order from "${LABELS[from]}" to "${LABELS[to]}"` };
    }
    const method = ctx.fulfillmentMethod || 'delivery';
    if (PICKUP_ONLY.has(to) && method !== 'pickup') {
        return { ok: false, reason: `"${LABELS[to]}" only applies to pickup orders` };
    }
    if (DELIVERY_ONLY.has(to) && method !== 'delivery') {
        return { ok: false, reason: `"${LABELS[to]}" only applies to delivery orders` };
    }
    if (NEEDS_PAYMENT_OK.has(to) && !PAYMENT_OK.has(ctx.paymentStatus)) {
        return { ok: false, reason: 'Payment must be confirmed before the order is prepared' };
    }
    return { ok: true };
}

function allowedNext(from, ctx = {}) {
    return (TRANSITIONS[from] || []).filter(to => checkTransition(from, to, ctx).ok);
}

module.exports = {
    STATUS,
    TRANSITIONS,
    LABELS,
    TERMINAL,
    CUSTOMER_CANCELLABLE,
    checkTransition,
    allowedNext
};
