/**
 * Migrate products from productData.js to Strapi
 * Run with: node scripts/migrate-products.js
 */

// Import products data from frontend
const productsData = require('../frontend/src/data/productData.js');

// Map badge values to enum values
const badgeMap = {
  'New': 'new',
  'Bestseller': 'bestseller',
  'Premium': 'premium',
  'Sale': 'sale',
  'Gift Set': 'gift-set',
  '3-Pack': '3-pack',
  'Firm Control': 'firm',
  'SPF 100': null, // Not a standard badge
  'Anti-Aging': null
};

// Map compression values
const compressionMap = {
  'Light': 'light',
  'Medium': 'medium',
  'Firm': 'firm'
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getCategoryMap(strapiUrl, apiToken) {
  const response = await fetch(
    `${strapiUrl}/api/categories?pagination[pageSize]=100`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  const categoryMap = {};

  if (data.data) {
    data.data.forEach(cat => {
      categoryMap[cat.attributes.slug] = cat.id;
    });
  }

  return categoryMap;
}

async function getBrandMap(strapiUrl, apiToken) {
  const response = await fetch(
    `${strapiUrl}/api/brands?pagination[pageSize]=100`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  const brandMap = {};

  if (data.data) {
    data.data.forEach(brand => {
      brandMap[brand.attributes.name] = brand.id;
      // Also map by slug
      brandMap[brand.attributes.slug] = brand.id;
    });
  }

  return brandMap;
}

async function migrateProducts(strapiUrl, apiToken) {
  console.log('Starting product migration...');

  // Get category and brand mappings
  const categoryMap = await getCategoryMap(strapiUrl, apiToken);
  const brandMap = await getBrandMap(strapiUrl, apiToken);

  console.log('Category map:', categoryMap);
  console.log('Brand map:', brandMap);

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Get all products from the data file
  const products = productsData.default || productsData.products;

  for (const [categorySlug, categoryData] of Object.entries(products)) {
    console.log(`\nProcessing category: ${categoryData.title} (${categorySlug})`);

    const categoryId = categoryMap[categorySlug];
    if (!categoryId) {
      console.warn(`Category not found in Strapi: ${categorySlug}`);
    }

    for (const product of categoryData.products) {
      try {
        // Find brand ID
        let brandId = null;
        if (product.brand) {
          brandId = brandMap[product.brand];
          if (!brandId) {
            // Try to find by normalized name
            const normalizedBrand = product.brand.toLowerCase().replace(/'/g, '');
            brandId = brandMap[normalizedBrand] || brandMap[slugify(product.brand)];
          }
        }

        // Map badge value
        let badge = null;
        if (product.badge) {
          badge = badgeMap[product.badge];
        }

        // Map compression value
        let compression = null;
        if (product.compression) {
          compression = compressionMap[product.compression];
        }

        const productSlug = slugify(`${product.name}-${product.id}`);

        // Build the product payload
        const payload = {
          data: {
            name: product.name,
            slug: productSlug,
            ref: product.ref || null,
            description: product.description || null,
            price: product.price,
            color: product.color || null,
            size: product.size || null,
            style: product.style || null,
            compression: compression,
            material: product.material || null,
            badge: badge,
            inStock: true,
            featured: product.badge === 'Bestseller' || product.badge === 'New',
            sortOrder: 0,
            legacyId: product.id,
            category: categoryId || null,
            brand: brandId || null,
            publishedAt: new Date().toISOString()
          }
        };

        // Check if product exists by legacyId
        const searchResponse = await fetch(
          `${strapiUrl}/api/products?filters[legacyId][$eq]=${product.id}`,
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const searchData = await searchResponse.json();

        if (searchData.data && searchData.data.length > 0) {
          // Update existing product
          const existingId = searchData.data[0].id;
          const updateResponse = await fetch(
            `${strapiUrl}/api/products/${existingId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }
          );

          if (updateResponse.ok) {
            console.log(`  Updated: ${product.name} (${product.id})`);
            results.updated++;
          } else {
            const error = await updateResponse.json();
            throw new Error(JSON.stringify(error));
          }
        } else {
          // Create new product
          const createResponse = await fetch(
            `${strapiUrl}/api/products`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }
          );

          if (createResponse.ok) {
            console.log(`  Created: ${product.name} (${product.id})`);
            results.created++;
          } else {
            const error = await createResponse.json();
            throw new Error(JSON.stringify(error));
          }
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`  Error migrating product ${product.id}:`, error.message);
        results.errors.push({
          product: product.id,
          name: product.name,
          error: error.message
        });
      }
    }
  }

  console.log('\n--- Product Migration Results ---');
  console.log(`Created: ${results.created}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.product} (${err.name}): ${err.error}`);
    });
  }

  return results;
}

module.exports = { migrateProducts };

// Run directly if called as script
if (require.main === module) {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const API_TOKEN = process.env.STRAPI_API_TOKEN;

  if (!API_TOKEN) {
    console.error('Error: STRAPI_API_TOKEN environment variable is required');
    console.log('Generate an API token in Strapi Admin > Settings > API Tokens');
    process.exit(1);
  }

  migrateProducts(STRAPI_URL, API_TOKEN)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
