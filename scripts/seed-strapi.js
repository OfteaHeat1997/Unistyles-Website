#!/usr/bin/env node

/**
 * Seed Strapi with data from productData.js
 *
 * This script migrates all categories, brands, and products to Strapi CMS.
 *
 * Prerequisites:
 * 1. Strapi must be running
 * 2. Create an API token in Strapi Admin > Settings > API Tokens
 *    - Token type: Full access
 * 3. Set environment variables:
 *    - STRAPI_URL (default: http://localhost:1337)
 *    - STRAPI_API_TOKEN (required)
 *
 * Usage:
 *   STRAPI_API_TOKEN=your_token node scripts/seed-strapi.js
 */

const { migrateCategories } = require('./migrate-categories');
const { migrateBrands } = require('./migrate-brands');
const { migrateProducts } = require('./migrate-products');

async function seedStrapi() {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const API_TOKEN = process.env.STRAPI_API_TOKEN;

  console.log('╔════════════════════════════════════════════╗');
  console.log('║     Strapi Data Migration for Unistyles    ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  if (!API_TOKEN) {
    console.error('Error: STRAPI_API_TOKEN environment variable is required');
    console.log('');
    console.log('To generate an API token:');
    console.log('1. Open Strapi Admin Panel at http://localhost:1337/admin');
    console.log('2. Go to Settings > API Tokens');
    console.log('3. Create a new token with "Full access" permissions');
    console.log('4. Run: STRAPI_API_TOKEN=your_token node scripts/seed-strapi.js');
    process.exit(1);
  }

  // Test connection
  console.log(`Testing connection to Strapi at ${STRAPI_URL}...`);
  try {
    const healthCheck = await fetch(`${STRAPI_URL}/_health`);
    if (!healthCheck.ok) {
      throw new Error('Strapi is not responding');
    }
    console.log('✓ Strapi is running\n');
  } catch (error) {
    console.error('✗ Cannot connect to Strapi');
    console.error(`  Make sure Strapi is running at ${STRAPI_URL}`);
    console.error(`  Error: ${error.message}`);
    process.exit(1);
  }

  const startTime = Date.now();
  const results = {
    categories: null,
    brands: null,
    products: null
  };

  try {
    // Step 1: Migrate Categories
    console.log('═══════════════════════════════════════════');
    console.log('Step 1: Migrating Categories');
    console.log('═══════════════════════════════════════════');
    results.categories = await migrateCategories(STRAPI_URL, API_TOKEN);
    console.log('');

    // Step 2: Migrate Brands
    console.log('═══════════════════════════════════════════');
    console.log('Step 2: Migrating Brands');
    console.log('═══════════════════════════════════════════');
    results.brands = await migrateBrands(STRAPI_URL, API_TOKEN);
    console.log('');

    // Step 3: Migrate Products
    console.log('═══════════════════════════════════════════');
    console.log('Step 3: Migrating Products');
    console.log('═══════════════════════════════════════════');
    results.products = await migrateProducts(STRAPI_URL, API_TOKEN);
    console.log('');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('           Migration Complete!             ');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('Summary:');
  console.log('─────────────────────────────────────────');
  console.log(`Categories: ${results.categories.created} created, ${results.categories.updated} updated`);
  console.log(`Brands:     ${results.brands.created} created, ${results.brands.updated} updated`);
  console.log(`Products:   ${results.products.created} created, ${results.products.updated} updated`);
  console.log('─────────────────────────────────────────');
  console.log(`Duration:   ${duration} seconds`);
  console.log('');

  const totalErrors =
    results.categories.errors.length +
    results.brands.errors.length +
    results.products.errors.length;

  if (totalErrors > 0) {
    console.log(`⚠ ${totalErrors} errors occurred during migration.`);
    console.log('  Check the logs above for details.');
  } else {
    console.log('✓ All data migrated successfully!');
  }

  console.log('');
  console.log('Next steps:');
  console.log('1. Visit the Strapi Admin panel to verify the data');
  console.log('2. Upload product images via the Media Library');
  console.log('3. Configure public API permissions in Settings > Roles > Public');
  console.log('');
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

seedStrapi();
