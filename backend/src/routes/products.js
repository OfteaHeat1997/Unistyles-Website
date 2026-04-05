// ===========================================
// PRODUCTS ROUTES
// Reads from Strapi's PostgreSQL tables directly
// ===========================================

const express = require('express');
const router = express.Router();
const { query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');
const { getUploadedImages, resolveImage } = require('../utils/images');

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
    let whereConditions = ['p.published_at IS NOT NULL'];
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

    // Valid sort columns
    const sortMap = {
        'sort_order': 'p.sort_order',
        'created_at': 'p.created_at',
        'price': 'p.price',
        'name': 'p.name'
    };
    const sortColumn = sortMap[sort] || 'p.sort_order';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN products_category_links pcl ON p.id = pcl.product_id
        LEFT JOIN categories c ON pcl.category_id = c.id
        LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
        LEFT JOIN brands b ON pbl.brand_id = b.id
        WHERE ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const query = `
        SELECT DISTINCT
            p.id, p.name, p.slug, p.ref, p.description,
            p.price, p.compare_at_price, p.legacy_image,
            p.color, p.size, p.style, p.material,
            p.badge, p.in_stock, p.stock_quantity, p.featured,
            p.sort_order, p.created_at,
            c.name as category_name, c.slug as category_slug,
            b.name as brand_name, b.slug as brand_slug
        FROM products p
        LEFT JOIN products_category_links pcl ON p.id = pcl.product_id
        LEFT JOIN categories c ON pcl.category_id = c.id
        LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
        LEFT JOIN brands b ON pbl.brand_id = b.id
        WHERE ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Get uploaded images for all products in this page
    const uploadMap = await getUploadedImages(result.rows.map(p => p.id));

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            ref: p.ref,
            description: p.description,
            price: parseFloat(p.price),
            compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
            image: resolveImage(p.id, p.legacy_image, uploadMap),
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
// Get featured products
// ===========================================
router.get('/featured',
    [query('limit').optional().isInt({ min: 1, max: 50 }).toInt()],
    asyncHandler(async (req, res) => {
    const { limit = 8 } = req.query;

    const result = await db.query(`
        SELECT
            p.id, p.name, p.slug, p.ref, p.price,
            p.compare_at_price, p.legacy_image, p.badge, p.featured,
            b.name as brand_name
        FROM products p
        LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
        LEFT JOIN brands b ON pbl.brand_id = b.id
        WHERE p.published_at IS NOT NULL AND p.featured = true
        ORDER BY p.sort_order ASC, p.created_at DESC
        LIMIT $1
    `, [parseInt(limit)]);

    const uploadMap = await getUploadedImages(result.rows.map(p => p.id));

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            ref: p.ref,
            price: parseFloat(p.price),
            compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
            image: resolveImage(p.id, p.legacy_image, uploadMap),
            badge: p.badge,
            featured: p.featured,
            brand: p.brand_name || null
        }))
    });
}));

// ===========================================
// GET /api/products/search
// Search products (must be before /:slug)
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
        SELECT p.id, p.name, p.slug, p.price, p.legacy_image, p.ref,
               b.name as brand_name
        FROM products p
        LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
        LEFT JOIN brands b ON pbl.brand_id = b.id
        WHERE p.published_at IS NOT NULL
          AND (p.name ILIKE $1 OR p.ref ILIKE $1 OR b.name ILIKE $1)
        ORDER BY p.name
        LIMIT $2
    `, [`%${q}%`, parseInt(limit)]);

    const uploadMap = await getUploadedImages(result.rows.map(p => p.id));

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price),
            image: resolveImage(p.id, p.legacy_image, uploadMap),
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

    // Try by slug first, then by ID
    const isNumeric = /^\d+$/.test(slug);
    const whereClause = isNumeric ? 'p.id = $1' : '(p.slug = $1 OR p.legacy_id = $1)';

    const result = await db.query(`
        SELECT
            p.*,
            c.name as category_name, c.slug as category_slug,
            b.name as brand_name, b.slug as brand_slug
        FROM products p
        LEFT JOIN products_category_links pcl ON p.id = pcl.product_id
        LEFT JOIN categories c ON pcl.category_id = c.id
        LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
        LEFT JOIN brands b ON pbl.brand_id = b.id
        WHERE ${whereClause} AND p.published_at IS NOT NULL
    `, [slug]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const p = result.rows[0];
    const uploadMap = await getUploadedImages([p.id]);

    // Also get gallery images
    let gallery = [];
    try {
        const galleryResult = await db.query(`
            SELECT f.url
            FROM files f
            JOIN files_related_morphs frm ON f.id = frm.file_id
            WHERE frm.related_id = $1
              AND frm.related_type = 'api::product.product'
              AND frm.field = 'gallery'
            ORDER BY frm."order" ASC
        `, [p.id]);
        gallery = galleryResult.rows.map(r => r.url);
    } catch { /* ignore */ }

    res.json({
        id: p.id,
        name: p.name,
        slug: p.slug,
        ref: p.ref,
        description: p.description,
        price: parseFloat(p.price),
        compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
        image: resolveImage(p.id, p.legacy_image, uploadMap),
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
        // Perfume fields
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
