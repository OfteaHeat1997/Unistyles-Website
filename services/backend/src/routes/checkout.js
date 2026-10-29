// ===========================================
// CHECKOUT ROUTES — options + server-side quote.
// The browser shows exactly what the quote returns; POST /api/orders
// recomputes the same quote inside a transaction before charging.
// ===========================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const db = require('../utils/db');
const { getSettings } = require('../services/settings');
const { buildQuote, publicQuote } = require('../services/pricing');
const { loadPickupLocations, loadZones } = require('../services/fulfillment');
const sentoo = require('../services/sentoo');

const PAYMENT_LABELS = {
    cod: { name: 'Cash on delivery', pickupName: 'Pay at pickup', description: 'Pay cash when you receive your order', icon: 'fa-money-bill-wave' },
    sentoo: { name: 'Sentoo (online)', description: 'Pay by bank or card through Sentoo', icon: 'fa-credit-card' },
    bank_transfer: { name: 'Bank transfer', description: 'Transfer the total; we prepare your order once it arrives', icon: 'fa-university' },
    whatsapp: { name: 'Confirm via WhatsApp', description: 'We confirm availability and payment with you on WhatsApp', icon: 'fa-whatsapp' }
};

function paymentsEnabled() {
    return process.env.PAYMENTS_MODE === 'mock' || sentoo.isConfigured();
}

// ===========================================
// GET /api/checkout/options
// ===========================================
router.get('/options', asyncHandler(async (req, res) => {
    const [settings, pickupLocations, zones] = await Promise.all([getSettings(), loadPickupLocations(), loadZones()]);
    const methods = (settings.payment_methods || [])
        .filter(id => PAYMENT_LABELS[id])
        .filter(id => id !== 'sentoo' || paymentsEnabled())
        .map(id => ({ id, ...PAYMENT_LABELS[id] }));

    res.json({
        currency: settings.store_currency || 'XCG',
        freeDeliveryThreshold: settings.free_delivery_threshold,
        freeDeliveryRule: settings.free_delivery_rule,
        pickupEnabled: settings.pickup_enabled !== false && pickupLocations.length > 0,
        deliveryEnabled: settings.delivery_enabled !== false,
        pickupLocations,
        // Neighbourhoods the customer can pick when there is no map pin (DEC-006: editable list)
        deliveryZones: zones.map(z => ({
            name: z.name,
            fee: Number(z.fee),
            estimatedDays: z.estimated_days,
            neighborhoods: (z.neighborhoods || []).map(n => n.name).filter(Boolean)
        })),
        paymentMethods: methods,
        paymentsMode: process.env.PAYMENTS_MODE === 'mock' ? 'mock' : 'live',
        paymentExpiryMinutes: settings.payment_expiry_minutes,
        supportWhatsapp: settings.support_whatsapp,
        returnPolicy: settings.return_policy,
        pendingApproval: settings.pending_approval || []
    });
}));

const quoteValidators = [
    body('items').isArray({ min: 0, max: 50 }),
    body('items.*.productId').isInt({ min: 1 }).toInt(),
    body('items.*.variantId').optional({ nullable: true }).isUUID(),
    body('items.*.quantity').isInt({ min: 1, max: 99 }).toInt(),
    body('fulfillment.method').optional().isIn(['pickup', 'delivery']),
    body('fulfillment.lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('fulfillment.lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    body('fulfillment.area').optional({ nullable: true }).isString().isLength({ max: 100 }),
    body('fulfillment.date').optional({ nullable: true }).isISO8601(),
    body('fulfillment.slotId').optional({ nullable: true }).isInt(),
    body('couponCode').optional({ nullable: true }).isString().isLength({ max: 50 })
];

// ===========================================
// POST /api/checkout/quote
// ===========================================
router.post('/quote', optionalAuth, quoteValidators, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid checkout data', errors: errors.array() });
    }
    const settings = await getSettings();
    const quote = await buildQuote(db, req.body, { settings, userId: req.user?.id || null });
    res.json(publicQuote(quote));
}));

module.exports = router;
module.exports.quoteValidators = quoteValidators;
