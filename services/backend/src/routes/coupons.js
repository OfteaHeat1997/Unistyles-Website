// ===========================================
// COUPONS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

// ===========================================
// POST /api/coupons/validate
// Validate a coupon code (public)
// ===========================================
router.post('/validate',
    [body('code').isString().trim().notEmpty().withMessage('Coupon code required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code } = req.body;

        const result = await db.query(
            'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid coupon code' });
        }

        const coupon = result.rows[0];
        const now = new Date();

        // Check date validity
        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return res.status(400).json({ error: 'Coupon is not yet active' });
        }
        if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            return res.status(400).json({ error: 'Coupon has expired' });
        }

        // Check usage limit
        if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
            return res.status(400).json({ error: 'Coupon has reached its usage limit' });
        }

        res.json({
            valid: true,
            coupon: {
                code: coupon.code,
                discountType: coupon.discount_type,
                discountValue: parseFloat(coupon.discount_value),
                minOrderAmount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null,
                description: coupon.description
            }
        });
    })
);

// ===========================================
// POST /api/coupons/apply
// Apply coupon to an order amount
// ===========================================
router.post('/apply',
    [
        body('code').isString().trim().notEmpty(),
        body('subtotal').isFloat({ min: 0 }).withMessage('Valid subtotal required')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code, subtotal } = req.body;

        const result = await db.query(
            'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid coupon code' });
        }

        const coupon = result.rows[0];
        const now = new Date();

        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return res.status(400).json({ error: 'Coupon is not yet active' });
        }
        if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            return res.status(400).json({ error: 'Coupon has expired' });
        }
        if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
            return res.status(400).json({ error: 'Coupon has reached its usage limit' });
        }

        // Check minimum order amount
        if (coupon.min_order_amount && subtotal < parseFloat(coupon.min_order_amount)) {
            return res.status(400).json({
                error: `Minimum order amount is XCG ${parseFloat(coupon.min_order_amount).toFixed(2)}`
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = subtotal * (parseFloat(coupon.discount_value) / 100);
            // Cap percentage discount if max_discount is set
            if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) {
                discount = parseFloat(coupon.max_discount);
            }
        } else {
            // Fixed amount
            discount = parseFloat(coupon.discount_value);
        }

        // Discount cannot exceed subtotal
        discount = Math.min(discount, subtotal);

        res.json({
            valid: true,
            discount: parseFloat(discount.toFixed(2)),
            couponCode: coupon.code,
            discountType: coupon.discount_type,
            discountValue: parseFloat(coupon.discount_value),
            newSubtotal: parseFloat((subtotal - discount).toFixed(2))
        });
    })
);

// ===========================================
// ADMIN: GET /api/coupons
// List all coupons
// ===========================================
router.get('/',
    authenticate,
    adminOnly,
    asyncHandler(async (req, res) => {
        const result = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');

        res.json({
            coupons: result.rows.map(c => ({
                id: c.id,
                code: c.code,
                description: c.description,
                discountType: c.discount_type,
                discountValue: parseFloat(c.discount_value),
                minOrderAmount: c.min_order_amount ? parseFloat(c.min_order_amount) : null,
                maxDiscount: c.max_discount ? parseFloat(c.max_discount) : null,
                maxUses: c.max_uses,
                timesUsed: c.times_used,
                validFrom: c.valid_from,
                validUntil: c.valid_until,
                isActive: c.is_active,
                createdAt: c.created_at
            }))
        });
    })
);

// ===========================================
// ADMIN: POST /api/coupons
// Create a coupon
// ===========================================
router.post('/',
    authenticate,
    adminOnly,
    [
        body('code').isString().trim().isLength({ min: 3, max: 50 }),
        body('discountType').isIn(['percentage', 'fixed']),
        body('discountValue').isFloat({ min: 0.01 }),
        body('description').optional().isString(),
        body('minOrderAmount').optional().isFloat({ min: 0 }),
        body('maxDiscount').optional().isFloat({ min: 0 }),
        body('maxUses').optional().isInt({ min: 1 }),
        body('validFrom').optional().isISO8601(),
        body('validUntil').optional().isISO8601()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code, discountType, discountValue, description, minOrderAmount, maxDiscount, maxUses, validFrom, validUntil } = req.body;

        // Check for duplicate code
        const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)', [code]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Coupon code already exists' });
        }

        const result = await db.query(`
            INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, max_uses, valid_from, valid_until)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [code.toUpperCase(), description || null, discountType, discountValue, minOrderAmount || null, maxDiscount || null, maxUses || null, validFrom || null, validUntil || null]);

        res.status(201).json({ message: 'Coupon created', coupon: result.rows[0] });
    })
);

// ===========================================
// ADMIN: DELETE /api/coupons/:id
// Deactivate a coupon
// ===========================================
router.delete('/:id',
    authenticate,
    adminOnly,
    [param('id').isUUID()],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        await db.query('UPDATE coupons SET is_active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Coupon deactivated' });
    })
);

module.exports = router;
