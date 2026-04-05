// ===========================================
// PRODUCT VARIANTS ROUTES
// Admin management of product sizes/colors/stock
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

// ===========================================
// GET /api/variants/product/:productId
// Get all variants for a product
// ===========================================
router.get('/product/:productId',
    [param('productId').isInt().withMessage('Valid product ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const result = await db.query(
            'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY size, color',
            [req.params.productId]
        );

        res.json({
            variants: result.rows.map(v => ({
                id: v.id,
                productId: v.product_id,
                size: v.size,
                color: v.color,
                sku: v.sku,
                stockQuantity: v.stock_quantity,
                priceAdjustment: v.price_adjustment ? parseFloat(v.price_adjustment) : 0,
                isActive: v.is_active
            }))
        });
    })
);

// ===========================================
// POST /api/variants
// Create a variant (admin only)
// ===========================================
router.post('/',
    authenticate,
    adminOnly,
    [
        body('productId').isInt(),
        body('size').optional().isString().isLength({ max: 20 }),
        body('color').optional().isString().isLength({ max: 50 }),
        body('sku').optional().isString().isLength({ max: 50 }),
        body('stockQuantity').optional().isInt({ min: 0 }),
        body('priceAdjustment').optional().isFloat()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { productId, size, color, sku, stockQuantity, priceAdjustment } = req.body;

        const result = await db.query(`
            INSERT INTO product_variants (product_id, size, color, sku, stock_quantity, price_adjustment)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [productId, size || null, color || null, sku || null, stockQuantity || 0, priceAdjustment || 0]);

        res.status(201).json({ message: 'Variant created', variant: result.rows[0] });
    })
);

// ===========================================
// PUT /api/variants/:id
// Update a variant (admin only)
// ===========================================
router.put('/:id',
    authenticate,
    adminOnly,
    [
        param('id').isUUID(),
        body('size').optional().isString().isLength({ max: 20 }),
        body('color').optional().isString().isLength({ max: 50 }),
        body('sku').optional().isString().isLength({ max: 50 }),
        body('stockQuantity').optional().isInt({ min: 0 }),
        body('priceAdjustment').optional().isFloat(),
        body('isActive').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { size, color, sku, stockQuantity, priceAdjustment, isActive } = req.body;

        const result = await db.query(`
            UPDATE product_variants
            SET size = COALESCE($1, size),
                color = COALESCE($2, color),
                sku = COALESCE($3, sku),
                stock_quantity = COALESCE($4, stock_quantity),
                price_adjustment = COALESCE($5, price_adjustment),
                is_active = COALESCE($6, is_active),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [size, color, sku, stockQuantity, priceAdjustment, isActive, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ message: 'Variant updated', variant: result.rows[0] });
    })
);

// ===========================================
// DELETE /api/variants/:id
// Delete a variant (admin only)
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

        const result = await db.query('DELETE FROM product_variants WHERE id = $1 RETURNING id', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ message: 'Variant deleted' });
    })
);

module.exports = router;
