// ===========================================
// PRODUCTS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, authenticate, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

// ===========================================
// GET /api/products
// List all products with pagination and filters
// ===========================================
router.get('/', asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        category,
        brand,
        minPrice,
        maxPrice,
        sort = 'created_at',
        order = 'desc',
        search,
        featured
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['p.is_active = true'];
    let params = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (category) {
        paramCount++;
        whereConditions.push(`(c.slug = $${paramCount} OR pc.slug = $${paramCount})`);
        params.push(category);
    }

    if (brand) {
        paramCount++;
        whereConditions.push(`p.brand = $${paramCount}`);
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
        whereConditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`);
        params.push(`%${search}%`);
    }

    if (featured === 'true') {
        whereConditions.push('p.is_featured = true');
    }

    const whereClause = whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

    // Valid sort columns
    const validSorts = ['created_at', 'price', 'name'];
    const sortColumn = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const query = `
        SELECT
            p.id, p.sku, p.name, p.slug, p.description,
            p.price, p.compare_price, p.brand, p.images,
            p.sizes, p.colors, p.stock, p.is_featured,
            c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        ${whereClause}
        ORDER BY p.${sortColumn} ${sortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            slug: p.slug,
            description: p.description,
            price: parseFloat(p.price),
            comparePrice: p.compare_price ? parseFloat(p.compare_price) : null,
            brand: p.brand,
            images: p.images || [],
            sizes: p.sizes || [],
            colors: p.colors || [],
            stock: p.stock,
            isFeatured: p.is_featured,
            category: {
                name: p.category_name,
                slug: p.category_slug
            }
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
router.get('/featured', asyncHandler(async (req, res) => {
    const { limit = 8 } = req.query;

    const result = await db.query(`
        SELECT
            p.id, p.sku, p.name, p.slug, p.price,
            p.compare_price, p.brand, p.images, p.is_featured
        FROM products p
        WHERE p.is_active = true AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT $1
    `, [parseInt(limit)]);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price),
            comparePrice: p.compare_price ? parseFloat(p.compare_price) : null,
            brand: p.brand,
            images: p.images || [],
            isFeatured: p.is_featured
        }))
    });
}));

// ===========================================
// GET /api/products/:slug
// Get single product by slug
// ===========================================
router.get('/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const result = await db.query(`
        SELECT
            p.*,
            c.name as category_name, c.slug as category_slug,
            pc.name as parent_category_name, pc.slug as parent_category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE p.slug = $1 AND p.is_active = true
    `, [slug]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const p = result.rows[0];

    // Get variants
    const variants = await db.query(`
        SELECT * FROM product_variants
        WHERE product_id = $1 AND is_active = true
    `, [p.id]);

    res.json({
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        comparePrice: p.compare_price ? parseFloat(p.compare_price) : null,
        brand: p.brand,
        images: p.images || [],
        sizes: p.sizes || [],
        colors: p.colors || [],
        stock: p.stock,
        isFeatured: p.is_featured,
        category: {
            name: p.category_name,
            slug: p.category_slug,
            parent: p.parent_category_name ? {
                name: p.parent_category_name,
                slug: p.parent_category_slug
            } : null
        },
        variants: variants.rows.map(v => ({
            id: v.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            price: v.price ? parseFloat(v.price) : null,
            stock: v.stock,
            imageUrl: v.image_url
        })),
        meta: {
            title: p.meta_title || p.name,
            description: p.meta_description || p.description
        }
    });
}));

// ===========================================
// GET /api/products/search
// Search products
// ===========================================
router.get('/search', asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
        return res.json({ products: [] });
    }

    const result = await db.query(`
        SELECT id, name, slug, price, images, brand
        FROM products
        WHERE is_active = true
          AND (name ILIKE $1 OR sku ILIKE $1 OR brand ILIKE $1)
        ORDER BY name
        LIMIT $2
    `, [`%${q}%`, parseInt(limit)]);

    res.json({
        products: result.rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price),
            image: p.images?.[0] || null,
            brand: p.brand
        }))
    });
}));

module.exports = router;
