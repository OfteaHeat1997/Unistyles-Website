// ===========================================
// NEWSLETTER ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// ===========================================
// POST /api/newsletter/subscribe
// ===========================================
router.post('/subscribe',
    [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        // Check if already subscribed
        const existing = await db.query(
            'SELECT id FROM newsletter_subscribers WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.json({ message: 'You are already subscribed!' });
        }

        await db.query(
            'INSERT INTO newsletter_subscribers (email) VALUES ($1)',
            [email]
        );

        res.status(201).json({ message: 'Successfully subscribed! Thank you.' });
    })
);

module.exports = router;
