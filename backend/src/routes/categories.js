// ===========================================
// CATEGORIES ROUTES
// Reads from Strapi's PostgreSQL tables directly
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// ===========================================
// GET /api/categories
// Get all categories with product counts
// ===========================================
router.get('/', asyncHandler(async (req, res) => {
    const { showInMenu } = req.query;

    let whereConditions = ['c.published_at IS NOT NULL'];
    let params = [];

    if (showInMenu === 'true') {
        whereConditions.push('c.show_in_menu = true');
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.query(`
        SELECT
            c.id, c.name, c.slug, c.description, c.breadcrumb,
            c.filter_type, c.filters, c.sort_order, c.show_in_menu,
            COUNT(pcl.product_id) as product_count
        FROM categories c
        LEFT JOIN products_category_links pcl ON c.id = pcl.category_id
        LEFT JOIN products p ON pcl.product_id = p.id AND p.published_at IS NOT NULL
        WHERE ${whereClause}
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
    `, params);

    res.json({
        categories: result.rows.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            breadcrumb: c.breadcrumb,
            filterType: c.filter_type,
            filters: c.filters || [],
            sortOrder: c.sort_order,
            showInMenu: c.show_in_menu,
            productCount: parseInt(c.product_count)
        }))
    });
}));

// ===========================================
// GET /api/categories/:slug
// Get category by slug with product count
// ===========================================
router.get('/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const result = await db.query(`
        SELECT
            c.id, c.name, c.slug, c.description, c.breadcrumb,
            c.filter_type, c.filters, c.sort_order, c.show_in_menu,
            COUNT(pcl.product_id) as product_count
        FROM categories c
        LEFT JOIN products_category_links pcl ON c.id = pcl.category_id
        LEFT JOIN products p ON pcl.product_id = p.id AND p.published_at IS NOT NULL
        WHERE c.slug = $1 AND c.published_at IS NOT NULL
        GROUP BY c.id
    `, [slug]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }

    const c = result.rows[0];

    res.json({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        breadcrumb: c.breadcrumb,
        filterType: c.filter_type,
        filters: c.filters || [],
        sortOrder: c.sort_order,
        showInMenu: c.show_in_menu,
        productCount: parseInt(c.product_count)
    });
}));

module.exports = router;
