// ===========================================
// REVIEWS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, optionalAuth } = require('../middleware/auth');
const db = require('../utils/db');
const { DEFAULT_PAGE, DEFAULT_LIMIT } = require('../constants');

// ===========================================
// GET /api/reviews/product/:productId
// Get reviews for a product (public)
// ===========================================
router.get('/product/:productId',
    [
        param('productId').isInt().withMessage('Valid product ID required'),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { productId } = req.params;
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
        const offset = (page - 1) * limit;

        // Only show approved reviews publicly
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM reviews WHERE product_id = $1 AND is_approved = true',
            [productId]
        );

        const result = await db.query(`
            SELECT r.id, r.rating, r.title, r.comment, r.is_verified, r.created_at,
                   u.first_name, u.last_name
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1 AND r.is_approved = true
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3
        `, [productId, limit, offset]);

        // Calculate average rating
        const avgResult = await db.query(
            'SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE product_id = $1 AND is_approved = true',
            [productId]
        );

        // Rating distribution
        const distResult = await db.query(
            'SELECT rating, COUNT(*) as count FROM reviews WHERE product_id = $1 AND is_approved = true GROUP BY rating ORDER BY rating DESC',
            [productId]
        );

        const distribution = {};
        for (let i = 5; i >= 1; i--) {
            const found = distResult.rows.find(r => r.rating === i);
            distribution[i] = parseInt(found?.count || 0);
        }

        res.json({
            reviews: result.rows.map(r => ({
                id: r.id,
                rating: r.rating,
                title: r.title,
                comment: r.comment,
                isVerified: r.is_verified,
                author: r.first_name ? `${r.first_name} ${r.last_name?.charAt(0) || ''}.` : 'Anonymous',
                createdAt: r.created_at
            })),
            summary: {
                averageRating: parseFloat(avgResult.rows[0].avg_rating) || 0,
                totalReviews: parseInt(avgResult.rows[0].total_reviews),
                distribution
            },
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total),
                totalPages: Math.ceil(countResult.rows[0].total / limit)
            }
        });
    })
);

// ===========================================
// POST /api/reviews
// Submit a review (authenticated)
// ===========================================
router.post('/',
    authenticate,
    [
        body('productId').isInt().withMessage('Product ID required'),
        body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
        body('title').optional().isString().isLength({ max: 200 }),
        body('comment').optional().isString().isLength({ max: 2000 }),
        body('orderId').optional().isUUID()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { productId, rating, title, comment, orderId } = req.body;

        // Check if user already reviewed this product
        const existing = await db.query(
            'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
            [productId, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this product' });
        }

        // Check if this is a verified purchase
        let isVerified = false;
        if (orderId) {
            const orderCheck = await db.query(
                `SELECT o.id FROM orders o
                 JOIN order_items oi ON o.id = oi.order_id
                 WHERE o.id = $1 AND o.user_id = $2 AND oi.product_id = $3 AND o.status = 'delivered'`,
                [orderId, req.user.id, productId]
            );
            isVerified = orderCheck.rows.length > 0;
        } else {
            // Check any delivered order with this product
            const purchaseCheck = await db.query(
                `SELECT o.id FROM orders o
                 JOIN order_items oi ON o.id = oi.order_id
                 WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'delivered'
                 LIMIT 1`,
                [req.user.id, productId]
            );
            isVerified = purchaseCheck.rows.length > 0;
        }

        const result = await db.query(`
            INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, is_verified, is_approved)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [productId, req.user.id, orderId || null, rating, title || null, comment || null, isVerified, true]);

        const review = result.rows[0];

        res.status(201).json({
            message: 'Review submitted successfully',
            review: {
                id: review.id,
                rating: review.rating,
                title: review.title,
                comment: review.comment,
                isVerified: review.is_verified,
                createdAt: review.created_at
            }
        });
    })
);

// ===========================================
// DELETE /api/reviews/:id
// Delete own review (authenticated)
// ===========================================
router.delete('/:id',
    authenticate,
    [param('id').isUUID().withMessage('Valid review ID required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const result = await db.query(
            'DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found or not authorized' });
        }

        res.json({ message: 'Review deleted' });
    })
);

module.exports = router;
