// ===========================================
// DELIVERY ROUTES — single source of truth for zones, fees, slots, pickup.
// ===========================================

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { getSettings } = require('../services/settings');
const { computeTotals, toCents } = require('../services/pricing');
const fulfillment = require('../services/fulfillment');

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
        return false;
    }
    return true;
}

function zoneDto(z, threshold) {
    return {
        id: z.id,
        slug: z.slug,
        name: z.name,
        fee: parseFloat(z.fee),
        freeThreshold: z.free_threshold !== null ? parseFloat(z.free_threshold) : threshold,
        estimatedDays: z.estimated_days,
        color: z.color,
        sortOrder: z.sort_order,
        neighborhoods: z.neighborhoods || [],
        polygon: z.polygon || null
    };
}

// GET /api/delivery/zones
router.get('/zones', asyncHandler(async (req, res) => {
    const [zones, settings] = await Promise.all([fulfillment.loadZones(), getSettings()]);
    res.json({
        freeShippingThreshold: settings.free_delivery_threshold,
        freeDeliveryRule: settings.free_delivery_rule,
        zones: zones.map(z => zoneDto(z, settings.free_delivery_threshold))
    });
}));

// GET /api/delivery/resolve?lat=&lng=  |  ?area=
router.get('/resolve',
    [
        query('lat').optional().isFloat({ min: -90, max: 90 }).toFloat(),
        query('lng').optional().isFloat({ min: -180, max: 180 }).toFloat(),
        query('area').optional().isString().trim().isLength({ max: 100 })
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const zones = await fulfillment.loadZones();
        const settings = await getSettings();
        const hasPin = Number.isFinite(req.query.lat) && Number.isFinite(req.query.lng);
        const zone = hasPin
            ? fulfillment.findZoneByPoint(zones, req.query.lat, req.query.lng)
            : fulfillment.findZoneByArea(zones, req.query.area);
        res.json({
            covered: !!zone,
            source: hasPin ? 'pin' : 'area',
            zone: zone ? zoneDto(zone, settings.free_delivery_threshold) : null
        });
    })
);

// GET /api/delivery/calculate?area=Willemstad&subtotal=120  (legacy helper, same math as checkout)
router.get('/calculate',
    [
        query('area').optional().isString().trim(),
        query('lat').optional().isFloat().toFloat(),
        query('lng').optional().isFloat().toFloat(),
        query('subtotal').isFloat({ min: 0 }).withMessage('subtotal must be a positive number').toFloat()
    ],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const [zones, settings] = await Promise.all([fulfillment.loadZones(), getSettings()]);
        const zone = Number.isFinite(req.query.lat) && Number.isFinite(req.query.lng)
            ? fulfillment.findZoneByPoint(zones, req.query.lat, req.query.lng)
            : fulfillment.findZoneByArea(zones, req.query.area);
        if (!zone) return res.status(404).json({ error: 'This location is outside our delivery zones', covered: false });

        const totals = computeTotals({
            lines: [{ unitPriceCents: toCents(req.query.subtotal), quantity: 1 }],
            method: 'delivery',
            zone,
            globalThreshold: settings.free_delivery_threshold,
            rule: settings.free_delivery_rule
        });
        res.json({
            zone: zoneDto(zone, settings.free_delivery_threshold),
            baseFee: parseFloat(zone.fee),
            fee: totals.deliveryFeeCents / 100,
            freeShippingThreshold: totals.freeDelivery.threshold,
            qualifiesForFreeShipping: totals.freeDelivery.qualifies,
            remainingForFree: totals.freeDelivery.remaining
        });
    })
);

// GET /api/delivery/slots?method=pickup|delivery
router.get('/slots', [query('method').isIn(['pickup', 'delivery']).withMessage('method must be pickup or delivery')],
    asyncHandler(async (req, res) => {
        if (!validate(req, res)) return;
        const settings = await getSettings();
        const calendar = await fulfillment.loadCalendar(req.query.method, {
            days: settings.booking_days_ahead,
            cutoffHour: settings.delivery_cutoff_hour
        });
        res.json({
            method: req.query.method,
            cutoffHour: settings.delivery_cutoff_hour,
            days: calendar
        });
    })
);

// GET /api/delivery/pickup-locations
router.get('/pickup-locations', asyncHandler(async (req, res) => {
    res.json({ locations: await fulfillment.loadPickupLocations() });
}));

module.exports = router;
