// ===========================================
// AUTHENTICATION ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { generateToken, generateRefreshToken, authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// ===========================================
// POST /api/auth/register
// ===========================================
router.post('/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
        body('firstName').trim().notEmpty(),
        body('lastName').trim().notEmpty(),
        body('phone').optional().trim()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName, phone } = req.body;

        // Check if user exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = await db.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, first_name, last_name, phone, created_at`,
            [email, passwordHash, firstName, lastName, phone]
        );

        const user = result.rows[0];
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token,
            refreshToken
        });
    })
);

// ===========================================
// POST /api/auth/login
// ===========================================
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isAdmin: user.is_admin
            },
            token,
            refreshToken
        });
    })
);

// ===========================================
// POST /api/auth/refresh
// ===========================================
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        const result = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
}));

// ===========================================
// GET /api/auth/me
// ===========================================
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const result = await db.query(
        'SELECT id, email, first_name, last_name, phone, is_admin, created_at FROM users WHERE id = $1',
        [req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isAdmin: user.is_admin,
        createdAt: user.created_at
    });
}));

// ===========================================
// POST /api/auth/logout
// ===========================================
router.post('/logout', authenticate, (req, res) => {
    // In a more complete implementation, you would blacklist the token
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
