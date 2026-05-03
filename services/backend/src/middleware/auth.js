// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

const jwt = require('jsonwebtoken');
const redis = require('../utils/redis');
const db = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
    process.exit(1);
}

// ===========================================
// Token Blacklist (Redis-backed)
// Stores logged-out tokens until they would naturally expire
// ===========================================

/**
 * Add a token to the blacklist.
 * TTL = time remaining until the token's own expiry, so Redis auto-cleans.
 */
const blacklistToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return;

        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await redis.setex(`blacklist:${token}`, ttl, '1');
        }
    } catch (err) {
        console.error('Failed to blacklist token:', err.message);
    }
};

/**
 * Check if a token has been blacklisted (user logged out).
 */
const isTokenBlacklisted = async (token) => {
    try {
        const result = await redis.get(`blacklist:${token}`);
        return result !== null;
    } catch (err) {
        // If Redis is down, allow the request (fail-open for availability)
        console.error('Redis blacklist check failed:', err.message);
        return false;
    }
};

/**
 * Verify JWT token and attach user to request.
 * Rejects blacklisted (logged-out) tokens.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];

        // Check blacklist before verifying (fast rejection)
        if (await isTokenBlacklisted(token)) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.token = token; // Store token for logout blacklisting
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Optional authentication - doesn't fail if no token.
 * Also checks blacklist for consistency.
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            if (await isTokenBlacklisted(token)) {
                // Token revoked — treat as no user
                return next();
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            req.token = token;
        }
        next();
    } catch (error) {
        // Continue without user
        next();
    }
};

/**
 * Admin only middleware.
 * Re-checks is_admin from database (not just JWT) for security.
 */
const adminOnly = async (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    // Re-verify admin status from DB (JWT could be stale)
    try {
        const result = await db.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0 || !result.rows[0].is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (err) {
        console.error('Admin check DB error:', err.message);
        return res.status(500).json({ error: 'Authorization check failed' });
    }
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            isAdmin: user.is_admin || false
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.id },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = {
    authenticate,
    optionalAuth,
    adminOnly,
    generateToken,
    generateRefreshToken,
    blacklistToken,
    isTokenBlacklisted
};
