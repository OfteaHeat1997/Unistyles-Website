// ===========================================
// DELIVERY ROUTES — single source of truth for zones, fees, ETA.
// ===========================================

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// Internal helpers ---------------------------------------------------------

async function getFreeShippingThreshold() {
    const result = await db.query(
        "SELECT value FROM settings WHERE key = 'free_delivery_threshold'"
    );
    return parseFloat(result.rows[0]?.value ?? 80);
}

async function getZoneByArea(area) {
    if (!area) return null;
    const result = await db.query(
        `SELECT id, slug, name, fee, free_threshold, estimated_days, color
         FROM delivery_zones
         WHERE is_active = true
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(neighborhoods) n
             WHERE LOWER(n->>'name') = LOWER($1)
           )
         LIMIT 1`,
        [area]
    );
    return result.rows[0] || null;
}

// Exported for orders.js
router.getZoneByArea = getZoneByArea;
router.getFreeShippingThreshold = getFreeShippingThreshold;

// ===========================================
// GET /api/delivery/zones
// Returns every active zone + the global free-shipping threshold.
// ===========================================
router.get('/zones', asyncHandler(async (req, res) => {
    const [zonesResult, threshold] = await Promise.all([
        db.query(
            `SELECT id, slug, name, fee, free_threshold, estimated_days, color, sort_order, neighborhoods
             FROM delivery_zones
             WHERE is_active = true
             ORDER BY sort_order ASC, id ASC`
        ),
        getFreeShippingThreshold()
    ]);

    res.json({
        freeShippingThreshold: threshold,
        zones: zonesResult.rows.map(z => ({
            id: z.id,
            slug: z.slug,
            name: z.name,
            fee: parseFloat(z.fee),
            freeThreshold: z.free_threshold !== null ? parseFloat(z.free_threshold) : threshold,
            estimatedDays: z.estimated_days,
            color: z.color,
            sortOrder: z.sort_order,
            neighborhoods: z.neighborhoods || []
        }))
    });
}));

// ===========================================
// GET /api/delivery/calculate?area=Willemstad&subtotal=120
// Returns the actual fee a customer would pay.
// ===========================================
router.get('/calculate',
    [
        query('area').isString().trim().notEmpty().withMessage('area is required'),
        query('subtotal').isFloat({ min: 0 }).withMessage('subtotal must be a positive number')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const area = req.query.area;
        const subtotal = parseFloat(req.query.subtotal);

        const [zone, threshold] = await Promise.all([
            getZoneByArea(area),
            getFreeShippingThreshold()
        ]);

        if (!zone) {
            return res.status(404).json({
                error: `No delivery zone found for area "${area}"`,
                area
            });
        }

        const baseFee = parseFloat(zone.fee);
        const effectiveThreshold = zone.free_threshold !== null
            ? parseFloat(zone.free_threshold)
            : threshold;
        const qualifiesForFreeShipping = subtotal >= effectiveThreshold;
        const fee = qualifiesForFreeShipping ? 0 : baseFee;

        res.json({
            area,
            zone: {
                id: zone.id,
                slug: zone.slug,
                name: zone.name,
                color: zone.color,
                estimatedDays: zone.estimated_days
            },
            baseFee,
            fee,
            freeShippingThreshold: effectiveThreshold,
            qualifiesForFreeShipping
        });
    })
);

module.exports = router;
