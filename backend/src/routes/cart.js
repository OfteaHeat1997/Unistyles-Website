// ===========================================
// CART ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const redis = require('../utils/redis');
const db = require('../utils/db');

// Cart stored in Redis for guests, DB for logged-in users
const CART_TTL = 60 * 60 * 24 * 7; // 7 days

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
router.post('/add', optionalAuth, asyncHandler(async (req, res) => {
    const { productId, variantId, quantity = 1, size, color } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
    }

    // Verify product exists
    const product = await db.query(
        'SELECT id, name, price, stock, images FROM products WHERE id = $1 AND is_active = true',
        [productId]
    );

    if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
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
router.put('/update', optionalAuth, asyncHandler(async (req, res) => {
    const { productId, variantId, quantity, size, color } = req.body;

    if (!productId || quantity === undefined) {
        return res.status(400).json({ error: 'Product ID and quantity required' });
    }

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
// Helper function to enrich cart items
// ===========================================
async function enrichCartItems(cartItems) {
    if (!cartItems || cartItems.length === 0) {
        return [];
    }

    const productIds = [...new Set(cartItems.map(item => item.productId))];
    const products = await db.query(`
        SELECT id, sku, name, slug, price, images, stock
        FROM products
        WHERE id = ANY($1) AND is_active = true
    `, [productIds]);

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
                sku: product.sku,
                name: product.name,
                slug: product.slug,
                price: parseFloat(product.price),
                quantity: item.quantity,
                size: item.size,
                color: item.color,
                image: product.images?.[0] || null,
                stock: product.stock,
                subtotal: parseFloat(product.price) * item.quantity
            };
        });
}

module.exports = router;
