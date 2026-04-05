// ===========================================
// SKINCARE ROUTES - Quiz & Recommendations
// Specialized Skincare/Creams E-commerce API
// ===========================================

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../utils/db');
const { getUploadedImages } = require('../utils/images');

// Resolve cremas category ID dynamically
let CREMAS_CATEGORY_ID = null;
async function getCremasCategoryId() {
    if (CREMAS_CATEGORY_ID) return CREMAS_CATEGORY_ID;
    try {
        const result = await db.query(
            "SELECT id FROM categories WHERE slug = 'cremas' AND published_at IS NOT NULL LIMIT 1"
        );
        if (result.rows.length > 0) {
            CREMAS_CATEGORY_ID = result.rows[0].id;
        }
    } catch { /* ignore */ }
    return CREMAS_CATEGORY_ID || 50; // fallback
}

// ===========================================
// GET /api/skincare/quiz
// Get quiz questions for skincare routine finder
// ===========================================
router.get('/quiz', asyncHandler(async (req, res) => {
  res.json({
    title: 'Find Your Perfect Routine',
    subtitle: 'Answer a few questions to discover your ideal skincare products',
    questions: [
      {
        id: 'skinType',
        question: 'What is your skin type?',
        options: [
          { id: 'normal', label: 'Normal', description: 'Balanced, not too oily or dry' },
          { id: 'dry', label: 'Dry', description: 'Feels tight, may flake' },
          { id: 'combination', label: 'Combination', description: 'Oily T-zone, dry cheeks' },
          { id: 'sensitive', label: 'Sensitive', description: 'Easily irritated, reactive' }
        ]
      },
      {
        id: 'concern',
        question: 'What is your primary skin concern?',
        options: [
          { id: 'hydration', label: 'Hydration', description: 'Deep moisture and plumpness' },
          { id: 'anti_aging', label: 'Anti-Aging', description: 'Fine lines and firmness' },
          { id: 'brightening', label: 'Brightening', description: 'Even tone and radiance' },
          { id: 'nourishing', label: 'Nourishing', description: 'Overall skin health' }
        ]
      },
      {
        id: 'area',
        question: 'Which area do you want to focus on?',
        options: [
          { id: 'face', label: 'Face', description: 'Facial skincare' },
          { id: 'body', label: 'Body', description: 'Body moisturizers and lotions' },
          { id: 'hands', label: 'Hands', description: 'Hand care' },
          { id: 'all', label: 'All Areas', description: 'Complete skincare' }
        ]
      },
      {
        id: 'budget',
        question: 'What is your budget range?',
        options: [
          { id: 'under25', label: 'Under XCG 25', description: 'Affordable essentials' },
          { id: '25to40', label: 'XCG 25 - 40', description: 'Mid-range picks' },
          { id: 'over40', label: 'Over XCG 40', description: 'Premium treatments' }
        ]
      },
      {
        id: 'routine',
        question: 'How much time for your skincare routine?',
        options: [
          { id: 'quick', label: '2 Minutes', description: 'Just the essentials' },
          { id: 'moderate', label: '5 Minutes', description: 'A balanced routine' },
          { id: 'full', label: '10+ Minutes', description: 'Full pampering session' }
        ]
      }
    ]
  });
}));

// ===========================================
// POST /api/skincare/quiz/results
// Get personalized recommendations based on quiz
// ===========================================
router.post('/quiz/results', asyncHandler(async (req, res) => {
  const { answers } = req.body;

  if (!answers) {
    return res.status(400).json({ error: 'Answers required' });
  }

  try {
    const categoryId = await getCremasCategoryId();

    const query = `
      SELECT DISTINCT
        p.id, p.name, p.slug, p.description, p.price,
        p.legacy_image as image, p.skin_type, p.skin_concern,
        p.application_area, p.texture, p.key_ingredients,
        p.dermatologist_tested, p.routine_step, p.time_of_use,
        p.featured, p.sort_order, p.badge,
        b.name as brand_name
      FROM products p
      JOIN products_category_links pcl ON p.id = pcl.product_id
      LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
      LEFT JOIN brands b ON pbl.brand_id = b.id
      WHERE pcl.category_id = $1 AND p.published_at IS NOT NULL
      ORDER BY p.featured DESC NULLS LAST, p.sort_order ASC, p.price ASC
      LIMIT 50
    `;

    const result = await db.query(query, [categoryId]);
    let recommendations = result.rows;

    // Score products based on quiz answers
    recommendations = recommendations.map(product => {
      let score = 50;

      // Skin type match
      if (answers.skinType) {
        if (product.skin_type === answers.skinType) score += 20;
        else if (product.skin_type === 'all') score += 10;
      }

      // Concern match
      if (answers.concern) {
        if (product.skin_concern === answers.concern) score += 25;
      }

      // Area match
      if (answers.area && answers.area !== 'all') {
        if (product.application_area === answers.area) score += 15;
        else if (product.application_area === 'all') score += 5;
      }

      // Budget match
      if (answers.budget) {
        const price = parseFloat(product.price);
        if (answers.budget === 'under25' && price < 25) score += 10;
        else if (answers.budget === '25to40' && price >= 25 && price <= 40) score += 10;
        else if (answers.budget === 'over40' && price > 40) score += 10;
      }

      // Routine time match
      if (answers.routine) {
        if (answers.routine === 'quick' && product.routine_step === 'moisturize') score += 5;
        else if (answers.routine === 'full' && product.routine_step === 'treat') score += 10;
      }

      // Featured products get a small boost
      if (product.featured) score += 5;

      return { ...product, matchScore: Math.min(score, 98) };
    });

    // Sort by score and take top 6
    recommendations.sort((a, b) => b.matchScore - a.matchScore);
    recommendations = recommendations.slice(0, 6);

    // Get uploaded images
    const uploadMap = await getUploadedImages(recommendations.map(p => p.id));

    res.json({
      success: true,
      message: `We found ${recommendations.length} skincare products for you`,
      answers: answers,
      recommendations: recommendations.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        image: uploadMap[p.id] || p.image,
        brand: p.brand_name,
        matchScore: p.matchScore,
        skinType: p.skin_type,
        skinConcern: p.skin_concern,
        applicationArea: p.application_area,
        keyIngredients: p.key_ingredients,
        routineStep: p.routine_step
      }))
    });
  } catch (error) {
    console.error('Skincare quiz results error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// ===========================================
// GET /api/skincare/filters
// Get filter options for skincare page
// ===========================================
router.get('/filters', asyncHandler(async (req, res) => {
  try {
    const categoryId = await getCremasCategoryId();

    const brandsQuery = `
      SELECT DISTINCT b.id, b.name, COUNT(p.id) as count
      FROM brands b
      JOIN products_brand_links pbl ON b.id = pbl.brand_id
      JOIN products p ON pbl.product_id = p.id
      JOIN products_category_links pcl ON p.id = pcl.product_id
      WHERE pcl.category_id = $1 AND p.published_at IS NOT NULL
      GROUP BY b.id, b.name
      HAVING COUNT(p.id) > 0
      ORDER BY count DESC
    `;

    const priceQuery = `
      SELECT MIN(p.price) as min_price, MAX(p.price) as max_price
      FROM products p
      JOIN products_category_links pcl ON p.id = pcl.product_id
      WHERE pcl.category_id = $1 AND p.published_at IS NOT NULL
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      JOIN products_category_links pcl ON p.id = pcl.product_id
      WHERE pcl.category_id = $1 AND p.published_at IS NOT NULL
    `;

    const concernsQuery = `
      SELECT DISTINCT skin_concern as concern, COUNT(*) as count
      FROM products p
      JOIN products_category_links pcl ON p.id = pcl.product_id
      WHERE pcl.category_id = $1
        AND p.published_at IS NOT NULL
        AND skin_concern IS NOT NULL
      GROUP BY skin_concern
      ORDER BY count DESC
    `;

    const areasQuery = `
      SELECT DISTINCT application_area as area, COUNT(*) as count
      FROM products p
      JOIN products_category_links pcl ON p.id = pcl.product_id
      WHERE pcl.category_id = $1
        AND p.published_at IS NOT NULL
        AND application_area IS NOT NULL
      GROUP BY application_area
      ORDER BY count DESC
    `;

    const [brands, prices, count, concerns, areas] = await Promise.all([
      db.query(brandsQuery, [categoryId]),
      db.query(priceQuery, [categoryId]),
      db.query(countQuery, [categoryId]),
      db.query(concernsQuery, [categoryId]),
      db.query(areasQuery, [categoryId])
    ]);

    res.json({
      brands: brands.rows.map(b => ({
        id: b.id,
        name: b.name,
        count: parseInt(b.count)
      })),
      priceRange: {
        min: parseFloat(prices.rows[0]?.min_price || 0),
        max: parseFloat(prices.rows[0]?.max_price || 100)
      },
      totalProducts: parseInt(count.rows[0]?.total || 0),
      skinConcerns: concerns.rows.map(c => ({
        id: c.concern,
        name: c.concern ? c.concern.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Other',
        count: parseInt(c.count)
      })),
      applicationAreas: areas.rows.map(a => ({
        id: a.area,
        name: a.area ? a.area.charAt(0).toUpperCase() + a.area.slice(1) : 'Other',
        count: parseInt(a.count)
      }))
    });
  } catch (error) {
    console.error('Skincare filters error:', error);
    res.json({
      brands: [],
      priceRange: { min: 0, max: 100 },
      totalProducts: 0,
      skinConcerns: [],
      applicationAreas: []
    });
  }
}));

// ===========================================
// GET /api/skincare
// List all skincare products with filters
// ===========================================
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 24,
    brand,
    minPrice,
    maxPrice,
    skinConcern,
    applicationArea,
    skinType,
    sort = 'featured',
    order = 'desc',
    search
  } = req.query;

  const categoryId = await getCremasCategoryId();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let whereConditions = ['pcl.category_id = $1', 'p.published_at IS NOT NULL'];
  let params = [categoryId];
  let paramCount = 1;

  if (brand && brand !== 'All') {
    paramCount++;
    whereConditions.push(`b.name ILIKE $${paramCount}`);
    params.push(`%${brand}%`);
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

  if (skinConcern) {
    paramCount++;
    whereConditions.push(`p.skin_concern = $${paramCount}`);
    params.push(skinConcern);
  }

  if (applicationArea && applicationArea !== 'all') {
    paramCount++;
    whereConditions.push(`p.application_area = $${paramCount}`);
    params.push(applicationArea);
  }

  if (skinType) {
    paramCount++;
    whereConditions.push(`(p.skin_type = $${paramCount} OR p.skin_type = 'all')`);
    params.push(skinType);
  }

  if (search) {
    paramCount++;
    whereConditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR b.name ILIKE $${paramCount} OR p.key_ingredients ILIKE $${paramCount})`);
    params.push(`%${search}%`);
  }

  const whereClause = whereConditions.join(' AND ');

  const sortOptions = {
    featured: 'p.featured DESC NULLS LAST, p.sort_order ASC',
    'price-low': 'p.price ASC',
    'price-high': 'p.price DESC',
    name: 'p.name ASC',
    newest: 'p.created_at DESC'
  };
  const sortClause = sortOptions[sort] || sortOptions.featured;

  const countQuery = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM products p
    JOIN products_category_links pcl ON p.id = pcl.product_id
    LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
    LEFT JOIN brands b ON pbl.brand_id = b.id
    WHERE ${whereClause}
  `;

  const productsQuery = `
    SELECT DISTINCT
      p.id, p.name, p.slug, p.description, p.price,
      p.legacy_image as image, p.badge, p.in_stock, p.featured,
      p.skin_type, p.skin_concern, p.application_area,
      p.texture, p.key_ingredients, p.dermatologist_tested,
      p.routine_step, p.time_of_use,
      p.sort_order, p.created_at,
      b.name as brand_name, b.id as brand_id
    FROM products p
    JOIN products_category_links pcl ON p.id = pcl.product_id
    LEFT JOIN products_brand_links pbl ON p.id = pbl.product_id
    LEFT JOIN brands b ON pbl.brand_id = b.id
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
    const uploadMap = await getUploadedImages(productsResult.rows.map(p => p.id));

    res.json({
      products: productsResult.rows.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        image: uploadMap[p.id] || p.image,
        brand: p.brand_name ? { id: p.brand_id, name: p.brand_name } : null,
        badge: p.badge,
        inStock: p.in_stock !== false,
        featured: p.featured,
        skinType: p.skin_type,
        skinConcern: p.skin_concern,
        applicationArea: p.application_area,
        texture: p.texture,
        keyIngredients: p.key_ingredients,
        dermatologistTested: p.dermatologist_tested,
        routineStep: p.routine_step,
        timeOfUse: p.time_of_use
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        brand,
        skinConcern,
        applicationArea,
        skinType,
        minPrice,
        maxPrice,
        search
      }
    });
  } catch (error) {
    console.error('Skincare products query error:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

module.exports = router;
