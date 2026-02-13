// ===========================================
// ADMIN ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const db = require('../utils/db');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin role
    const result = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};

// ===========================================
// GET /api/admin/users
// List all users (admin only)
// ===========================================
router.get('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT id, email, first_name, last_name, phone, role, created_at, updated_at
        FROM users
    `;
    let countQuery = 'SELECT COUNT(*) FROM users';
    let params = [];
    let countParams = [];

    if (search) {
        query += ` WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`;
        countQuery += ` WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [users, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
    ]);

    res.json({
        users: users.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
}));

// ===========================================
// GET /api/admin/users/:id
// Get single user details (admin only)
// ===========================================
router.get('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query(
        `SELECT id, email, first_name, last_name, phone, role, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Get user's orders
    const orders = await db.query(
        `SELECT id, order_number, status, total, created_at
         FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [id]
    );

    res.json({
        user: result.rows[0],
        orders: orders.rows
    });
}));

// ===========================================
// PUT /api/admin/users/:id
// Update user (admin only)
// ===========================================
router.put('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, phone, role } = req.body;

    const result = await db.query(
        `UPDATE users
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             role = COALESCE($4, role),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, email, first_name, last_name, phone, role, updated_at`,
        [firstName, lastName, phone, role, id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0], message: 'User updated successfully' });
}));

// ===========================================
// DELETE /api/admin/users/:id
// Delete user (admin only)
// ===========================================
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (id === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
}));

// ===========================================
// GET /api/admin/orders
// List all orders (admin only)
// ===========================================
router.get('/orders', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT o.id, o.order_number, o.status, o.total, o.payment_method,
               o.shipping_address, o.created_at,
               u.email, u.first_name, u.last_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM orders';
    let params = [];
    let countParams = [];

    if (status) {
        query += ` WHERE o.status = $1`;
        countQuery += ` WHERE status = $1`;
        params.push(status);
        countParams.push(status);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [orders, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
    ]);

    res.json({
        orders: orders.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
}));

// ===========================================
// PUT /api/admin/orders/:id
// Update order status (admin only)
// ===========================================
router.put('/orders/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
        `UPDATE orders
         SET status = COALESCE($1, status),
             notes = COALESCE($2, notes),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, notes, id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0], message: 'Order updated successfully' });
}));

// ===========================================
// GET /api/admin/stats
// Dashboard statistics (admin only)
// ===========================================
router.get('/stats', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const [usersCount, ordersCount, recentOrders, revenue] = await Promise.all([
        db.query('SELECT COUNT(*) FROM users'),
        db.query('SELECT COUNT(*) FROM orders'),
        db.query(`
            SELECT COUNT(*) as count, status
            FROM orders
            GROUP BY status
        `),
        db.query(`
            SELECT COALESCE(SUM(total), 0) as total_revenue
            FROM orders
            WHERE status NOT IN ('cancelled')
        `)
    ]);

    res.json({
        totalUsers: parseInt(usersCount.rows[0].count),
        totalOrders: parseInt(ordersCount.rows[0].count),
        ordersByStatus: recentOrders.rows,
        totalRevenue: parseFloat(revenue.rows[0].total_revenue || 0)
    });
}));

module.exports = router;
