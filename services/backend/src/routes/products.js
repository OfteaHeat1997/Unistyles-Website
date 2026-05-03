// ===========================================
// PRODUCTS ROUTES
// Reads from the Directus-managed `products` / `categories` / `brands`
// tables (snake_case columns, direct FK relations).
// ===========================================

const express = require('express');
const router = express.Router();
const { query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');
const { assetUrl } = require('../utils/images');

// ===========================================
// GET /api/products
// List all products with pagination and filters
// ===========================================
router.get('/',
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
        query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
        query('sort').optional().isIn(['sort_order', 'created_at', 'price', 'name']),
        query('order').optional().isIn(['asc', 'desc']),
        query('category').optional().trim().isSlug(),
        query('brand').optional().trim().isSlug(),
        query('search').optional().trim().isLength({ min: 1, max: 100 }),
        query('featured').optional().isIn(['true', 'false'])
    ],
    asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const {
        page = 1,
        limit = 20,
        category,
        brand,
        minPrice,
        maxPrice,
        sort = 'sort_order',
        order = 'asc',
        search,
        featured
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (category) {
        paramCount++;
        whereConditions.push(`c.slug = $${paramCount}`);
        params.push(category);
    }

    if (brand) {
        paramCount++;
        whereConditions.push(`b.slug = $${paramCount}`);
        params.push(brand);
    }

    if (minPrice) {
        paramCount++;
        whereConditions.push(`p.price >= $${paramCount}`);
        params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
        paramCount++;
        whereConditions.push(`p.price <= $${paramCount}`);
        params.push(parseFloat(maxPrice));
    }

    if (search) {
        paramCount++;
        whereConditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.ref ILIKE $${paramCount})`);
        params.push(`%${search}%`);
    }

    if (featured === 'true') {
        whereConditions.push('p.featured = true');
    }

    const whereClause = whereConditions.join(' AND ');

    const sortMap = {
        'sort_order': 'p.sort_order',
        'created_at': 'p.date_created',
        'price': 'p.price',
        'name': 'p.name'
    };
    const sortColumn = sortMap[sort] || 'p.sort_order';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const productsQuery = `
        SELECT
            p.id, p.name, p.slug, p.ref, p.description,
            p.price, p.compare_at_price, p.image, p.legacy_image,
            p.color, p.size, p.style, p.material,
            p.badge, p.in_stock, p.stock_quantity, p.featured,
            p.sort_order,
            c.name AS category_name, c.slug AS category_slug,
            b.name AS brand_name, b.slug AS brand_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(productsQuery, params);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            ref: p.ref,
            description: p.description,
            price: parseFloat(p.price),
            compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
            image: assetUrl(p.image) || p.legacy_image || null,
            color: p.color,
            size: p.size,
            style: p.style,
            material: p.material,
            badge: p.badge,
            inStock: p.in_stock !== false,
            stockQuantity: p.stock_quantity || 0,
            featured: p.featured,
            brand: p.brand_name ? { name: p.brand_name, slug: p.brand_slug } : null,
            category: p.category_name ? { name: p.category_name, slug: p.category_slug } : null
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}));

// ===========================================
// GET /api/products/featured
// ===========================================
router.get('/featured',
    [query('limit').optional().isInt({ min: 1, max: 50 }).toInt()],
    asyncHandler(async (req, res) => {
    const { limit = 8 } = req.query;

    const result = await db.query(`
        SELECT
            p.id, p.name, p.slug, p.ref, p.price,
            p.compare_at_price, p.image, p.legacy_image, p.badge, p.featured,
            b.name AS brand_name
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.featured = true
        ORDER BY p.sort_order ASC
        LIMIT $1
    `, [parseInt(limit)]);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            ref: p.ref,
            price: parseFloat(p.price),
            compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
            image: assetUrl(p.image) || p.legacy_image || null,
            badge: p.badge,
            featured: p.featured,
            brand: p.brand_name || null
        }))
    });
}));

// ===========================================
// GET /api/products/search
// ===========================================
router.get('/search',
    [
        query('q').optional().trim().isLength({ max: 200 }),
        query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
    ],
    asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
        return res.json({ products: [] });
    }

    const result = await db.query(`
        SELECT p.id, p.name, p.slug, p.price, p.image, p.legacy_image, p.ref,
               b.name AS brand_name
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE (p.name ILIKE $1 OR p.ref ILIKE $1 OR b.name ILIKE $1)
        ORDER BY p.name
        LIMIT $2
    `, [`%${q}%`, parseInt(limit)]);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price),
            image: assetUrl(p.image) || p.legacy_image || null,
            ref: p.ref,
            brand: p.brand_name || null
        }))
    });
}));

// ===========================================
// GET /api/products/:slug
// Get single product by slug or ID
// ===========================================
router.get('/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const isNumeric = /^\d+$/.test(slug);
    const whereClause = isNumeric ? 'p.id = $1' : '(p.slug = $1 OR p.legacy_id = $1)';

    const result = await db.query(`
        SELECT
            p.*,
            c.name AS category_name, c.slug AS category_slug,
            b.name AS brand_name, b.slug AS brand_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE ${whereClause}
    `, [slug]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const p = result.rows[0];

    // Gallery is a JSON array of Directus file UUIDs.
    const gallery = Array.isArray(p.gallery)
        ? p.gallery.map(id => assetUrl(id)).filter(Boolean)
        : [];

    res.json({
        id: p.id,
        name: p.name,
        slug: p.slug,
        ref: p.ref,
        description: p.description,
        price: parseFloat(p.price),
        compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
        image: assetUrl(p.image) || p.legacy_image || null,
        gallery,
        color: p.color,
        size: p.size,
        style: p.style,
        material: p.material,
        compression: p.compression,
        badge: p.badge,
        inStock: p.in_stock !== false,
        stockQuantity: p.stock_quantity || 0,
        featured: p.featured,
        brand: p.brand_name ? { name: p.brand_name, slug: p.brand_slug } : null,
        category: p.category_name ? { name: p.category_name, slug: p.category_slug } : null,
        gender: p.gender,
        fragranceFamily: p.fragrance_family,
        scentProfile: p.scent_profile,
        intensity: p.intensity,
        occasion: p.occasion,
        season: p.season,
        notes: (p.top_notes || p.middle_notes || p.base_notes) ? {
            top: p.top_notes,
            middle: p.middle_notes,
            base: p.base_notes
        } : null,
        volume: p.volume,
        concentration: p.concentration
    });
}));

module.exports = router;
