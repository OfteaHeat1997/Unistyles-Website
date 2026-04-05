// ===========================================
// CART ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const redis = require('../utils/redis');
const db = require('../utils/db');
const { CART_TTL } = require('../constants');

// Reusable validation error handler
function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return true;
    }
    return false;
}

// Cart stored in Redis for guests, DB for logged-in users

// ===========================================
// GET /api/cart
// Get cart items
// ===========================================
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
    let cartItems = [];

    if (req.user) {
        // Logged-in user - get from database
        const result = await db.query(
            'SELECT items FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        cartItems = result.rows[0]?.items || [];
    } else {
        // Guest user - get from Redis
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            const cart = await redis.get(`cart:${cartId}`);
            cartItems = cart ? JSON.parse(cart) : [];
        }
    }

    // Enrich cart items with current product data
    const enrichedItems = await enrichCartItems(cartItems);

    res.json({
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
}));

// ===========================================
// POST /api/cart/add
// Add item to cart
// ===========================================
router.post('/add',
    optionalAuth,
    [
        body('productId').isInt({ min: 1 }).withMessage('Valid product ID required'),
        body('quantity').optional().isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99'),
        body('size').optional().trim().isLength({ max: 20 }).escape(),
        body('color').optional().trim().isLength({ max: 50 }).escape(),
        body('variantId').optional().isInt({ min: 1 })
    ],
    asyncHandler(async (req, res) => {
    if (handleValidationErrors(req, res)) return;
    const { productId, variantId, quantity = 1, size, color } = req.body;

    // Verify product exists (using Strapi schema)
    const product = await db.query(
        'SELECT id, name, price, in_stock, stock_quantity, legacy_image FROM products WHERE id = $1 AND published_at IS NOT NULL',
        [productId]
    );

    if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const productData = product.rows[0];

    // Check stock availability before adding to cart
    if (productData.in_stock === false) {
        return res.status(400).json({ error: `${productData.name} is out of stock` });
    }

    if (productData.stock_quantity !== null && productData.stock_quantity < parseInt(quantity)) {
        return res.status(400).json({
            error: `Not enough stock for ${productData.name}. Available: ${productData.stock_quantity}`
        });
    }

    const newItem = {
        productId,
        variantId: variantId || null,
        quantity: parseInt(quantity),
        size: size || null,
        color: color || null,
        addedAt: new Date().toISOString()
    };

    let cartItems = [];

    if (req.user) {
        // Logged-in user
        const result = await db.query(
            'SELECT items FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        cartItems = result.rows[0]?.items || [];

        // Check if item already exists
        const existingIndex = cartItems.findIndex(item =>
            item.productId === productId &&
            item.variantId === variantId &&
            item.size === size &&
            item.color === color
        );

        if (existingIndex > -1) {
            cartItems[existingIndex].quantity += parseInt(quantity);
        } else {
            cartItems.push(newItem);
        }

        // Save to database
        await db.query(`
            INSERT INTO carts (user_id, items)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET items = $2, updated_at = NOW()
        `, [req.user.id, JSON.stringify(cartItems)]);
    } else {
        // Guest user
        let cartId = req.headers['x-cart-id'];
        if (!cartId) {
            cartId = require('uuid').v4();
        }

        const cart = await redis.get(`cart:${cartId}`);
        cartItems = cart ? JSON.parse(cart) : [];

        const existingIndex = cartItems.findIndex(item =>
            item.productId === productId &&
            item.variantId === variantId &&
            item.size === size &&
            item.color === color
        );

        if (existingIndex > -1) {
            cartItems[existingIndex].quantity += parseInt(quantity);
        } else {
            cartItems.push(newItem);
        }

        await redis.setex(`cart:${cartId}`, CART_TTL, JSON.stringify(cartItems));

        res.setHeader('X-Cart-Id', cartId);
    }

    const enrichedItems = await enrichCartItems(cartItems);

    res.json({
        message: 'Item added to cart',
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
}));

// ===========================================
// PUT /api/cart/update
// Update item quantity
// ===========================================
router.put('/update',
    optionalAuth,
    [
        body('productId').isInt({ min: 1 }).withMessage('Valid product ID required'),
        body('quantity').isInt({ min: 0, max: 99 }).withMessage('Quantity must be between 0 and 99'),
        body('size').optional().trim().isLength({ max: 20 }).escape(),
        body('color').optional().trim().isLength({ max: 50 }).escape(),
        body('variantId').optional().isInt({ min: 1 })
    ],
    asyncHandler(async (req, res) => {
    if (handleValidationErrors(req, res)) return;
    const { productId, variantId, quantity, size, color } = req.body;

    let cartItems = [];

    if (req.user) {
        const result = await db.query(
            'SELECT items FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        cartItems = result.rows[0]?.items || [];
    } else {
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            const cart = await redis.get(`cart:${cartId}`);
            cartItems = cart ? JSON.parse(cart) : [];
        }
    }

    const itemIndex = cartItems.findIndex(item =>
        item.productId === productId &&
        item.variantId === (variantId || null) &&
        item.size === (size || null) &&
        item.color === (color || null)
    );

    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (parseInt(quantity) <= 0) {
        cartItems.splice(itemIndex, 1);
    } else {
        cartItems[itemIndex].quantity = parseInt(quantity);
    }

    // Save cart
    if (req.user) {
        await db.query(
            'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2',
            [JSON.stringify(cartItems), req.user.id]
        );
    } else {
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            await redis.setex(`cart:${cartId}`, CART_TTL, JSON.stringify(cartItems));
        }
    }

    const enrichedItems = await enrichCartItems(cartItems);

    res.json({
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
}));

// ===========================================
// DELETE /api/cart/remove/:productId
// Remove item from cart
// ===========================================
router.delete('/remove/:productId', optionalAuth, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { variantId, size, color } = req.query;

    let cartItems = [];

    if (req.user) {
        const result = await db.query(
            'SELECT items FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        cartItems = result.rows[0]?.items || [];
    } else {
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            const cart = await redis.get(`cart:${cartId}`);
            cartItems = cart ? JSON.parse(cart) : [];
        }
    }

    cartItems = cartItems.filter(item =>
        !(item.productId === productId &&
            item.variantId === (variantId || null) &&
            item.size === (size || null) &&
            item.color === (color || null))
    );

    // Save cart
    if (req.user) {
        await db.query(
            'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2',
            [JSON.stringify(cartItems), req.user.id]
        );
    } else {
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            await redis.setex(`cart:${cartId}`, CART_TTL, JSON.stringify(cartItems));
        }
    }

    const enrichedItems = await enrichCartItems(cartItems);

    res.json({
        message: 'Item removed',
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
}));

// ===========================================
// DELETE /api/cart/clear
// Clear entire cart
// ===========================================
router.delete('/clear', optionalAuth, asyncHandler(async (req, res) => {
    if (req.user) {
        await db.query(
            'UPDATE carts SET items = $1, updated_at = NOW() WHERE user_id = $2',
            ['[]', req.user.id]
        );
    } else {
        const cartId = req.headers['x-cart-id'];
        if (cartId) {
            await redis.del(`cart:${cartId}`);
        }
    }

    res.json({
        message: 'Cart cleared',
        items: [],
        itemCount: 0,
        subtotal: 0
    });
}));

// ===========================================
// POST /api/cart/merge
// Merge guest cart into user cart after login
// ===========================================
router.post('/merge',
    [
        body('guestCartId').trim().notEmpty().isUUID().withMessage('Valid guest cart ID required')
    ],
    asyncHandler(async (req, res) => {
    if (handleValidationErrors(req, res)) return;
    const { guestCartId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token and get user
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    let userId;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (!guestCartId) {
        return res.status(400).json({ error: 'Guest cart ID required' });
    }

    // Get guest cart from Redis
    const guestCart = await redis.get(`cart:${guestCartId}`);
    const guestItems = guestCart ? JSON.parse(guestCart) : [];

    if (guestItems.length === 0) {
        return res.json({
            message: 'No items to merge',
            items: [],
            itemCount: 0,
            subtotal: 0
        });
    }

    // Get user's current cart
    const result = await db.query(
        'SELECT items FROM carts WHERE user_id = $1',
        [userId]
    );
    let userItems = result.rows[0]?.items || [];

    // Merge guest items into user cart (cap quantities at MAX_ITEM_QUANTITY, cap total at MAX_CART_ITEMS)
    const { MAX_ITEM_QUANTITY, MAX_CART_ITEMS } = require('../constants');
    guestItems.forEach(guestItem => {
        const existingIndex = userItems.findIndex(item =>
            item.productId === guestItem.productId &&
            item.variantId === guestItem.variantId &&
            item.size === guestItem.size &&
            item.color === guestItem.color
        );

        if (existingIndex > -1) {
            // Add quantities, capped at max
            userItems[existingIndex].quantity = Math.min(
                userItems[existingIndex].quantity + guestItem.quantity,
                MAX_ITEM_QUANTITY
            );
        } else if (userItems.length < MAX_CART_ITEMS) {
            // Add new item only if cart isn't full
            userItems.push({ ...guestItem, quantity: Math.min(guestItem.quantity, MAX_ITEM_QUANTITY) });
        }
    });

    // Save merged cart to database
    await db.query(`
        INSERT INTO carts (user_id, items)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET items = $2, updated_at = NOW()
    `, [userId, JSON.stringify(userItems)]);

    // Delete guest cart from Redis
    await redis.del(`cart:${guestCartId}`);

    // Enrich and return merged cart
    const enrichedItems = await enrichCartItems(userItems);

    res.json({
        message: 'Cart merged successfully',
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
}));

// ===========================================
// Helper function to enrich cart items
// ===========================================
async function enrichCartItems(cartItems) {
    if (!cartItems || cartItems.length === 0) {
        return [];
    }

    const productIds = [...new Set(cartItems.map(item => item.productId))];
    const products = await db.query(`
        SELECT id, ref, name, slug, price, legacy_image, in_stock, stock_quantity
        FROM products
        WHERE id = ANY($1) AND published_at IS NOT NULL
    `, [productIds]);

    // Get uploaded images from Strapi's file system
    const uploadedImages = await db.query(`
        SELECT frm.related_id as product_id, f.url as upload_url
        FROM files f
        JOIN files_related_morphs frm ON f.id = frm.file_id
        WHERE frm.related_id = ANY($1)
          AND frm.related_type = 'api::product.product'
          AND frm.field = 'image'
        ORDER BY frm."order" ASC
    `, [productIds]).catch(() => ({ rows: [] }));

    const uploadMap = {};
    uploadedImages.rows.forEach(img => {
        if (!uploadMap[img.product_id]) {
            uploadMap[img.product_id] = img.upload_url;
        }
    });

    const productMap = {};
    products.rows.forEach(p => {
        productMap[p.id] = p;
    });

    return cartItems
        .filter(item => productMap[item.productId])
        .map(item => {
            const product = productMap[item.productId];
            return {
                productId: item.productId,
                variantId: item.variantId,
                ref: product.ref,
                name: product.name,
                slug: product.slug,
                price: parseFloat(product.price),
                quantity: item.quantity,
                size: item.size,
                color: item.color,
                image: uploadMap[item.productId]
                    || product.legacy_image || null,
                inStock: product.in_stock,
                stockQuantity: product.stock_quantity || 0,
                subtotal: parseFloat(product.price) * item.quantity
            };
        });
}

module.exports = router;
