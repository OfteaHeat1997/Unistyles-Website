// ===========================================
// AUTHENTICATION ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { generateToken, generateRefreshToken, authenticate, blacklistToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// Sync user to Strapi Customer collection
async function syncUserToStrapi(user) {
    try {
        const strapiUrl = process.env.STRAPI_URL || 'http://strapi:1337';
        const response = await fetch(`${strapiUrl}/api/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    phone: user.phone || '',
                    role: user.role || 'customer',
                    postgresId: user.id
                }
            })
        });
        if (!response.ok) {
            console.error('Failed to sync user to Strapi:', await response.text());
        }
    } catch (err) {
        console.error('Error syncing user to Strapi:', err.message);
    }
}

// ===========================================
// POST /api/auth/register
// ===========================================
router.post('/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number'),
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
        user.role = 'customer';

        // Sync user to Strapi (non-blocking)
        syncUserToStrapi(user).catch(err => console.error('Strapi sync error:', err));

        // Send verification email (non-blocking, don't fail registration)
        try {
            const jwt = require('jsonwebtoken');
            const verifyToken = jwt.sign(
                { id: user.id, purpose: 'email-verification' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
            const verifyUrl = `${siteUrl}/verify-email?token=${verifyToken}`;

            const { sendVerificationEmail } = require('../utils/notifications');
            if (typeof sendVerificationEmail === 'function') {
                sendVerificationEmail(user, verifyUrl).catch(err =>
                    console.error('Verification email failed:', err.message)
                );
            }
            console.log(`Verification email requested for ${user.email}`);
        } catch (err) {
            console.error('Failed to send verification email:', err.message);
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.status(201).json({
            message: 'Registration successful. Please check your email to verify your account.',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: 'customer'
            },
            token,
            refreshToken
        });
    })
);

// ===========================================
// POST /api/auth/verify-email
// Verifies user email with token from email link
// ===========================================
router.post('/verify-email',
    [body('token').notEmpty().withMessage('Verification token required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.body;

        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.purpose !== 'email-verification') {
                return res.status(400).json({ error: 'Invalid verification token' });
            }

            // Mark user as verified
            const result = await db.query(
                'UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1 RETURNING email',
                [decoded.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Blacklist the token so it can't be reused
            await blacklistToken(token);

            res.json({ message: 'Email verified successfully! You can now log in.' });
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(400).json({ error: 'Verification link has expired. Please register again.' });
            }
            return res.status(400).json({ error: 'Invalid verification token' });
        }
    })
);

// ===========================================
// POST /api/auth/resend-verification
// Resend email verification link
// ===========================================
router.post('/resend-verification',
    [body('email').isEmail().normalizeEmail()],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;
        const result = await db.query(
            'SELECT id, email, first_name, is_verified FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length > 0 && !result.rows[0].is_verified) {
            const user = result.rows[0];
            const jwt = require('jsonwebtoken');
            const verifyToken = jwt.sign(
                { id: user.id, purpose: 'email-verification' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
            const verifyUrl = `${siteUrl}/verify-email?token=${verifyToken}`;

            const { sendVerificationEmail } = require('../utils/notifications');
            if (typeof sendVerificationEmail === 'function') {
                sendVerificationEmail(user, verifyUrl).catch(err =>
                    console.error('Verification email failed:', err.message)
                );
            }
        }

        // Always return success to prevent email enumeration
        res.json({ message: 'If the account exists and is unverified, a new verification email has been sent.' });
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

        // Check email verification
        if (!user.is_verified) {
            return res.status(403).json({
                error: 'Please verify your email before logging in. Check your inbox for the verification link.',
                needsVerification: true,
                email: user.email
            });
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
                role: user.role || 'customer'
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
        const { isTokenBlacklisted } = require('../middleware/auth');

        // Reject blacklisted refresh tokens (user logged out)
        if (await isTokenBlacklisted(refreshToken)) {
            return res.status(401).json({ error: 'Refresh token has been revoked' });
        }

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
        'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = $1',
        [req.user.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
        user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            role: user.role || 'customer',
            createdAt: user.created_at
        }
    });
}));

// ===========================================
// POST /api/auth/logout
// Blacklists the current token so it can't be reused
// ===========================================
router.post('/logout', authenticate, async (req, res) => {
    // Blacklist the current access token in Redis until it expires
    await blacklistToken(req.token);

    // Also blacklist the refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
        await blacklistToken(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
});

// ===========================================
// POST /api/auth/forgot-password
// Sends a password reset link via email
// ===========================================
router.post('/forgot-password',
    [body('email').isEmail().normalizeEmail()],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        // Find user (always return success to prevent email enumeration)
        const result = await db.query('SELECT id, email, first_name FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const jwt = require('jsonwebtoken');

            // Generate a short-lived reset token (15 minutes)
            const resetToken = jwt.sign(
                { id: user.id, purpose: 'password-reset' },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            // Build reset URL
            const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
            const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

            // Send email (best-effort, don't fail the request)
            try {
                const { sendPasswordResetEmail } = require('../utils/notifications');
                if (typeof sendPasswordResetEmail === 'function') {
                    await sendPasswordResetEmail(user, resetUrl);
                }
            } catch (err) {
                console.error('Failed to send password reset email:', err.message);
            }

            console.log(`Password reset requested for ${email}`);
        }

        // Always return success (security: don't reveal if email exists)
        res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    })
);

// ===========================================
// POST /api/auth/reset-password
// Resets password using the reset token
// ===========================================
router.post('/reset-password',
    [
        body('token').notEmpty().withMessage('Reset token required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, password } = req.body;

        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.purpose !== 'password-reset') {
                return res.status(400).json({ error: 'Invalid reset token' });
            }

            // Hash new password
            const passwordHash = await bcrypt.hash(password, 12);

            // Update user password
            const result = await db.query(
                'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING email',
                [passwordHash, decoded.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Blacklist the reset token so it can't be reused
            const { blacklistToken } = require('../middleware/auth');
            await blacklistToken(token);

            res.json({ message: 'Password has been reset successfully. You can now log in.' });
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
            }
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
    })
);

module.exports = router;
