// ===========================================
// USER ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// All routes require authentication (applied in index.js)

// ===========================================
// GET /api/users/profile
// Get user profile
// ===========================================
router.get('/profile', asyncHandler(async (req, res) => {
    const result = await db.query(`
        SELECT id, email, first_name, last_name, phone, created_at
        FROM users WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get addresses
    const addresses = await db.query(
        'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
        [req.user.id]
    );

    res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
        addresses: addresses.rows.map(a => ({
            id: a.id,
            label: a.label,
            street: a.street,
            area: a.area,
            city: a.city,
            country: a.country,
            landmark: a.landmark,
            isDefault: a.is_default
        }))
    });
}));

// ===========================================
// PUT /api/users/profile
// Update user profile
// ===========================================
router.put('/profile',
    [
        body('firstName').optional().trim().notEmpty(),
        body('lastName').optional().trim().notEmpty(),
        body('phone').optional().trim()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, phone } = req.body;

        const result = await db.query(`
            UPDATE users
            SET first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                phone = COALESCE($3, phone),
                updated_at = NOW()
            WHERE id = $4
            RETURNING id, email, first_name, last_name, phone
        `, [firstName, lastName, phone, req.user.id]);

        const user = result.rows[0];

        res.json({
            message: 'Profile updated',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone
            }
        });
    })
);

// ===========================================
// PUT /api/users/password
// Change password
// ===========================================
router.put('/password',
    [
        body('currentPassword').notEmpty(),
        body('newPassword').isLength({ min: 8 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current password hash
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 12);

        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, req.user.id]
        );

        res.json({ message: 'Password updated successfully' });
    })
);

// ===========================================
// POST /api/users/addresses
// Add new address
// ===========================================
router.post('/addresses',
    [
        body('street').notEmpty(),
        body('city').notEmpty()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { label, street, area, city, country, landmark, isDefault } = req.body;

        // If this is default, unset other defaults
        if (isDefault) {
            await db.query(
                'UPDATE addresses SET is_default = false WHERE user_id = $1',
                [req.user.id]
            );
        }

        const result = await db.query(`
            INSERT INTO addresses (user_id, label, street, area, city, country, landmark, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [req.user.id, label || 'Home', street, area, city || 'Willemstad', country || 'Curacao', landmark, isDefault || false]);

        const address = result.rows[0];

        res.status(201).json({
            message: 'Address added',
            address: {
                id: address.id,
                label: address.label,
                street: address.street,
                area: address.area,
                city: address.city,
                country: address.country,
                landmark: address.landmark,
                isDefault: address.is_default
            }
        });
    })
);

// ===========================================
// PUT /api/users/addresses/:id
// Update address
// ===========================================
router.put('/addresses/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { label, street, area, city, country, landmark, isDefault } = req.body;

    // Verify ownership
    const existing = await db.query(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );

    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Address not found' });
    }

    // If setting as default, unset others
    if (isDefault) {
        await db.query(
            'UPDATE addresses SET is_default = false WHERE user_id = $1',
            [req.user.id]
        );
    }

    const result = await db.query(`
        UPDATE addresses
        SET label = COALESCE($1, label),
            street = COALESCE($2, street),
            area = COALESCE($3, area),
            city = COALESCE($4, city),
            country = COALESCE($5, country),
            landmark = COALESCE($6, landmark),
            is_default = COALESCE($7, is_default)
        WHERE id = $8
        RETURNING *
    `, [label, street, area, city, country, landmark, isDefault, id]);

    res.json({
        message: 'Address updated',
        address: result.rows[0]
    });
}));

// ===========================================
// DELETE /api/users/addresses/:id
// Delete address
// ===========================================
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query(
        'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address deleted' });
}));

// ===========================================
// GET /api/users/orders
// Get user's orders
// ===========================================
router.get('/orders', asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
        SELECT
            o.*,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), offset]);

    const countResult = await db.query(
        'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
        [req.user.id]
    );

    res.json({
        orders: result.rows.map(o => ({
            id: o.id,
            orderNumber: o.order_number,
            status: o.status,
            paymentStatus: o.payment_status,
            total: parseFloat(o.total),
            itemCount: parseInt(o.item_count),
            createdAt: o.created_at
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total)
        }
    });
}));

module.exports = router;
