// ===========================================
// PERFUME ROUTES - Quiz & Recommendations
// Reads from the Directus-managed product tables.
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');
const { assetUrl } = require('../utils/images');

// Resolve perfume category ID dynamically
let PERFUME_CATEGORY_ID = null;
async function getPerfumeCategoryId() {
    if (PERFUME_CATEGORY_ID) return PERFUME_CATEGORY_ID;
    try {
        const result = await db.query(
            "SELECT id FROM categories WHERE slug = 'perfume' LIMIT 1"
        );
        if (result.rows.length > 0) {
            PERFUME_CATEGORY_ID = result.rows[0].id;
        }
    } catch { /* ignore */ }
    return PERFUME_CATEGORY_ID || 40; // fallback
}

// ===========================================
// GET /api/perfumes/quiz
// Get quiz questions for fragrance finder
// Based on luxury perfume e-commerce best practices
// ===========================================
router.get('/quiz', asyncHandler(async (req, res) => {
  res.json({
    title: 'Find Your Signature Scent',
    subtitle: 'Answer a few questions to discover fragrances perfect for you',
    questions: [
      {
        id: 'gender',
        question: 'Who is this fragrance for?',
        options: [
          { id: 'women', label: 'For Her', description: 'Feminine fragrances' },
          { id: 'men', label: 'For Him', description: 'Masculine fragrances' },
          { id: 'unisex', label: 'Anyone', description: 'Universal appeal' }
        ]
      },
      {
        id: 'occasion',
        question: 'When will you wear it most?',
        options: [
          { id: 'daily', label: 'Everyday', description: 'Light & versatile' },
          { id: 'office', label: 'Work', description: 'Subtle & professional' },
          { id: 'evening', label: 'Night Out', description: 'Bold & captivating' },
          { id: 'romantic', label: 'Special Moments', description: 'Intimate & memorable' }
        ]
      },
      {
        id: 'scent',
        question: 'Which scent family appeals to you?',
        options: [
          { id: 'floral', label: 'Floral', description: 'Rose, jasmine, gardenia' },
          { id: 'fresh', label: 'Fresh', description: 'Citrus, aquatic, green' },
          { id: 'oriental', label: 'Oriental', description: 'Vanilla, amber, spice' },
          { id: 'woody', label: 'Woody', description: 'Sandalwood, cedar, oud' }
        ]
      },
      {
        id: 'intensity',
        question: 'How strong do you prefer your fragrance?',
        options: [
          { id: 'light', label: 'Subtle', description: 'Close to skin' },
          { id: 'moderate', label: 'Moderate', description: 'Noticeable presence' },
          { id: 'intense', label: 'Bold', description: 'Long-lasting projection' }
        ]
      }
    ]
  });
}));

// ===========================================
// POST /api/perfumes/quiz/results
// Get personalized recommendations based on quiz
// ===========================================
router.post('/quiz/results', asyncHandler(async (req, res) => {
  const { answers } = req.body;

  if (!answers) {
    return res.status(400).json({ error: 'Answers required' });
  }

  try {
    const categoryId = await getPerfumeCategoryId();
    // Build dynamic query based on answers
    let whereConditions = ['p.category_id = $1'];
    let params = [categoryId];
    let paramCount = 1;

    // Gender-based scoring keywords
    const genderKeywords = {
      women: ['mujer', 'dama', 'ella', 'women', 'her', 'femenin', 'woman', 'lady', 'girl', 'floral'],
      men: ['hombre', 'caballero', 'him', 'men', 'masculin', 'man', 'gentleman', 'bold']
    };

    // Build query to get all perfumes
    const query = `
      SELECT
        p.id, p.name, p.slug, p.description, p.price,
        p.image, p.legacy_image, p.gender, p.fragrance_family,
        p.intensity, p.occasion, p.scent_profile,
        p.featured, p.sort_order,
        b.name AS brand_name
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.featured DESC NULLS LAST, p.sort_order ASC, p.price ASC
      LIMIT 50
    `;

    const result = await db.query(query, params);
    let recommendations = result.rows;

    // Score and filter based on answers
    recommendations = recommendations.map(product => {
      let score = 70; // Base score
      const text = ((product.name || '') + ' ' + (product.description || '')).toLowerCase();
      const brandName = (product.brand_name || '').toLowerCase();

      // Gender matching
      if (answers.gender && answers.gender !== 'unisex') {
        const keywords = genderKeywords[answers.gender] || [];
        const hasMatch = keywords.some(k => text.includes(k));

        // Also check the database gender field if populated
        if (product.gender === answers.gender) {
          score += 20;
        } else if (hasMatch) {
          score += 15;
        } else if (answers.gender === 'women' && !genderKeywords.men.some(k => text.includes(k))) {
          // If looking for women's and no male keywords, slight boost
          score += 5;
        } else if (answers.gender === 'men' && !genderKeywords.women.some(k => text.includes(k))) {
          score += 5;
        }
      }

      // Occasion matching
      if (answers.occasion && product.occasion === answers.occasion) {
        score += 10;
      }

      // Scent family matching
      if (answers.scent) {
        if (product.fragrance_family === answers.scent) {
          score += 15;
        }
        // Check description for scent keywords
        const scentKeywords = {
          floral: ['floral', 'flower', 'rose', 'jasmine', 'gardenia', 'lily'],
          fresh: ['fresh', 'citrus', 'aquatic', 'marine', 'green', 'limón', 'citrico'],
          oriental: ['oriental', 'vanilla', 'vainilla', 'amber', 'ámbar', 'spice', 'warm'],
          woody: ['woody', 'wood', 'sandal', 'cedar', 'oud', 'madera']
        };
        const keywords = scentKeywords[answers.scent] || [];
        if (keywords.some(k => text.includes(k))) {
          score += 10;
        }
      }

      // Intensity matching
      if (answers.intensity && product.intensity === answers.intensity) {
        score += 10;
      }

      // Premium brand boost
      const premiumBrands = ['esika', "l'bel", 'lbel', 'yanbal'];
      if (premiumBrands.some(b => brandName.includes(b))) {
        score += 5;
      }

      return { ...product, matchScore: Math.min(score, 98) };
    });

    // Sort by score and take top 6
    recommendations.sort((a, b) => b.matchScore - a.matchScore);
    recommendations = recommendations.slice(0, 6);

    res.json({
      success: true,
      message: `We found ${recommendations.length} fragrances that match your preferences`,
      answers: answers,
      recommendations: recommendations.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        image: assetUrl(p.image) || p.legacy_image || null,
        brand: p.brand_name,
        matchScore: p.matchScore,
        gender: p.gender,
        fragranceFamily: p.fragrance_family
      }))
    });
  } catch (error) {
    console.error('Quiz results error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// ===========================================
// GET /api/perfumes/filters
// Get filter options for perfume page
// ===========================================
router.get('/filters', asyncHandler(async (req, res) => {
  try {
    // Get brands with perfume count
    const brandsQuery = `
      SELECT b.id, b.name, COUNT(p.id) AS count
      FROM brands b
      JOIN products p ON p.brand_id = b.id
      WHERE p.category_id = $1
      GROUP BY b.id, b.name
      HAVING COUNT(p.id) > 0
      ORDER BY count DESC
    `;

    // Get price range
    const priceQuery = `
      SELECT MIN(p.price) AS min_price, MAX(p.price) AS max_price
      FROM products p
      WHERE p.category_id = $1
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM products p
      WHERE p.category_id = $1
    `;

    // Get available fragrance families
    const familiesQuery = `
      SELECT fragrance_family AS family, COUNT(*) AS count
      FROM products p
      WHERE p.category_id = $1
        AND fragrance_family IS NOT NULL
      GROUP BY fragrance_family
      ORDER BY count DESC
    `;

    const categoryId = await getPerfumeCategoryId();
    const [brands, prices, count, families] = await Promise.all([
      db.query(brandsQuery, [categoryId]),
      db.query(priceQuery, [categoryId]),
      db.query(countQuery, [categoryId]),
      db.query(familiesQuery, [categoryId])
    ]);

    res.json({
      brands: brands.rows.map(b => ({
        id: b.id,
        name: b.name,
        count: parseInt(b.count)
      })),
      priceRange: {
        min: parseFloat(prices.rows[0]?.min_price || 0),
        max: parseFloat(prices.rows[0]?.max_price || 200)
      },
      totalProducts: parseInt(count.rows[0]?.total || 0),
      fragranceFamilies: families.rows.map(f => ({
        id: f.family,
        name: f.family ? f.family.charAt(0).toUpperCase() + f.family.slice(1) : 'Other',
        count: parseInt(f.count)
      })),
      genderOptions: [
        { id: 'all', name: 'All Fragrances' },
        { id: 'women', name: 'For Her' },
        { id: 'men', name: 'For Him' }
      ],
      intensityOptions: [
        { id: 'light', name: 'Light' },
        { id: 'moderate', name: 'Moderate' },
        { id: 'intense', name: 'Intense' }
      ]
    });
  } catch (error) {
    console.error('Filters error:', error);
    // Return default filters on error
    res.json({
      brands: [],
      priceRange: { min: 0, max: 200 },
      totalProducts: 0,
      fragranceFamilies: [],
      genderOptions: [
        { id: 'all', name: 'All Fragrances' },
        { id: 'women', name: 'For Her' },
        { id: 'men', name: 'For Him' }
      ],
      intensityOptions: []
    });
  }
}));

// ===========================================
// GET /api/perfumes
// List all perfumes with filters
// ===========================================
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 24,
    brand,
    minPrice,
    maxPrice,
    gender,
    intensity,
    fragranceFamily,
    sort = 'featured',
    order = 'desc',
    search
  } = req.query;

  const categoryId = await getPerfumeCategoryId();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let whereConditions = ['p.category_id = $1'];
  let params = [categoryId];
  let paramCount = 1;

  // Brand filter
  if (brand && brand !== 'All') {
    paramCount++;
    whereConditions.push(`b.name ILIKE $${paramCount}`);
    params.push(`%${brand}%`);
  }

  // Price filters
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

  // Gender filter - use database field directly
  if (gender && gender !== 'all') {
    paramCount++;
    whereConditions.push(`p.gender = $${paramCount}`);
    params.push(gender);
  }

  // Intensity filter
  if (intensity) {
    paramCount++;
    whereConditions.push(`p.intensity = $${paramCount}`);
    params.push(intensity);
  }

  // Fragrance family filter
  if (fragranceFamily) {
    paramCount++;
    whereConditions.push(`p.fragrance_family = $${paramCount}`);
    params.push(fragranceFamily);
  }

  // Search
  if (search) {
    paramCount++;
    whereConditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR b.name ILIKE $${paramCount})`);
    params.push(`%${search}%`);
  }

  const whereClause = whereConditions.join(' AND ');

  // Sort options
  const sortOptions = {
    featured: 'p.featured DESC NULLS LAST, p.sort_order ASC',
    'price-low': 'p.price ASC',
    'price-high': 'p.price DESC',
    name: 'p.name ASC',
    newest: 'p.date_created DESC'
  };
  const sortClause = sortOptions[sort] || sortOptions.featured;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ${whereClause}
  `;

  const productsQuery = `
    SELECT
      p.id, p.name, p.slug, p.description, p.price,
      p.image, p.legacy_image, p.badge, p.in_stock, p.featured,
      p.gender, p.fragrance_family, p.intensity,
      p.sort_order,
      b.name AS brand_name, b.id AS brand_id
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ${whereClause}
    ORDER BY ${sortClause}
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

  params.push(parseInt(limit), offset);

  try {
    const [countResult, productsResult] = await Promise.all([
      db.query(countQuery, params.slice(0, paramCount)),
      db.query(productsQuery, params)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      products: productsResult.rows.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        image: assetUrl(p.image) || p.legacy_image || null,
        brand: p.brand_name ? { id: p.brand_id, name: p.brand_name } : null,
        badge: p.badge,
        inStock: p.in_stock !== false,
        featured: p.featured,
        gender: p.gender,
        fragranceFamily: p.fragrance_family,
        intensity: p.intensity
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        brand,
        gender,
        intensity,
        fragranceFamily,
        minPrice,
        maxPrice,
        search
      }
    });
  } catch (error) {
    console.error('Products query error:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// ===========================================
// GET /api/perfumes/:id
// Get single perfume details
// ===========================================
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT
        p.id, p.name, p.slug, p.description, p.price, p.compare_at_price,
        p.image, p.legacy_image, p.badge, p.in_stock, p.featured,
        p.gender, p.fragrance_family, p.scent_profile, p.intensity,
        p.occasion, p.season, p.top_notes, p.middle_notes, p.base_notes,
        p.volume, p.concentration,
        b.name AS brand_name, b.id AS brand_id
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = $1 AND p.category_id = $2
    `;

    const perfCatId = await getPerfumeCategoryId();
    const result = await db.query(query, [id, perfCatId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfume not found' });
    }

    const p = result.rows[0];

    res.json({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: parseFloat(p.price),
      compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
      image: assetUrl(p.image) || p.legacy_image || null,
      brand: p.brand_name ? { id: p.brand_id, name: p.brand_name } : null,
      badge: p.badge,
      inStock: p.in_stock !== false,
      featured: p.featured,
      // Fragrance details
      gender: p.gender,
      fragranceFamily: p.fragrance_family,
      scentProfile: p.scent_profile,
      intensity: p.intensity,
      occasion: p.occasion,
      season: p.season,
      notes: {
        top: p.top_notes,
        middle: p.middle_notes,
        base: p.base_notes
      },
      volume: p.volume,
      concentration: p.concentration
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}));

module.exports = router;
