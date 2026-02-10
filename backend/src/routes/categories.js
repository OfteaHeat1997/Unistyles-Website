// ===========================================
// CATEGORIES ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');

// ===========================================
// GET /api/categories
// Get all categories with hierarchy
// ===========================================
router.get('/', asyncHandler(async (req, res) => {
    const result = await db.query(`
        SELECT
            c.id, c.name, c.name_es, c.slug, c.description,
            c.image_url, c.parent_id, c.sort_order,
            COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
        WHERE c.is_active = true
        GROUP BY c.id
        ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name
    `);

    // Build hierarchy
    const categories = result.rows;
    const parentCategories = categories.filter(c => !c.parent_id);

    const hierarchy = parentCategories.map(parent => ({
        id: parent.id,
        name: parent.name,
        nameEs: parent.name_es,
        slug: parent.slug,
        description: parent.description,
        imageUrl: parent.image_url,
        productCount: parseInt(parent.product_count),
        children: categories
            .filter(c => c.parent_id === parent.id)
            .map(child => ({
                id: child.id,
                name: child.name,
                nameEs: child.name_es,
                slug: child.slug,
                description: child.description,
                imageUrl: child.image_url,
                productCount: parseInt(child.product_count)
            }))
    }));

    res.json({ categories: hierarchy });
}));

// ===========================================
// GET /api/categories/:slug
// Get category by slug with products count
// ===========================================
router.get('/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const result = await db.query(`
        SELECT
            c.id, c.name, c.name_es, c.slug, c.description,
            c.image_url, c.parent_id,
            pc.name as parent_name, pc.slug as parent_slug,
            COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
        WHERE c.slug = $1 AND c.is_active = true
        GROUP BY c.id, pc.name, pc.slug
    `, [slug]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }

    const category = result.rows[0];

    // Get subcategories if this is a parent
    const subcategories = await db.query(`
        SELECT id, name, name_es, slug, image_url,
               (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = true) as product_count
        FROM categories c
        WHERE parent_id = $1 AND is_active = true
        ORDER BY sort_order, name
    `, [category.id]);

    res.json({
        id: category.id,
        name: category.name,
        nameEs: category.name_es,
        slug: category.slug,
        description: category.description,
        imageUrl: category.image_url,
        productCount: parseInt(category.product_count),
        parent: category.parent_name ? {
            name: category.parent_name,
            slug: category.parent_slug
        } : null,
        subcategories: subcategories.rows.map(s => ({
            id: s.id,
            name: s.name,
            nameEs: s.name_es,
            slug: s.slug,
            imageUrl: s.image_url,
            productCount: parseInt(s.product_count)
        }))
    });
}));

module.exports = router;
