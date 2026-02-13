/**
 * Migrate brands from productData.js to Strapi
 * Run with: node scripts/migrate-brands.js
 */

const brands = [
  {
    name: 'Leonisa',
    slug: 'leonisa',
    description: 'Premium Colombian lingerie and shapewear brand known for innovative designs and superior quality. Founded in 1956, Leonisa is the leading intimate apparel brand in Latin America.',
    country: 'Colombia',
    website: 'https://www.leonisa.com',
    featured: true
  },
  {
    name: "L'Bel",
    slug: 'lbel',
    description: "L'Bel is a prestigious French-Colombian beauty brand offering luxury skincare, fragrances, and cosmetics. Known for premium anti-aging products and elegant perfumes.",
    country: 'Colombia',
    website: 'https://www.lbel.com',
    featured: true
  },
  {
    name: 'Esika',
    slug: 'esika',
    description: 'Esika offers accessible Colombian beauty products including fragrances, skincare, and makeup. Known for trendy products at affordable prices for the modern woman.',
    country: 'Colombia',
    website: 'https://www.esika.com',
    featured: true
  },
  {
    name: 'Yanbal',
    slug: 'yanbal',
    description: 'Yanbal is a leading Colombian beauty and jewelry company offering fragrances, skincare, and elegant accessories. Known for quality products and direct sales model.',
    country: 'Colombia',
    website: 'https://www.yanbal.com',
    featured: true
  },
  {
    name: 'Cyzone',
    slug: 'cyzone',
    description: 'Cyzone is a youthful Colombian beauty brand targeting young women with trendy fragrances, makeup, and accessories at accessible prices.',
    country: 'Colombia',
    website: 'https://www.cyzone.com',
    featured: false
  }
];

async function migrateBrands(strapiUrl, apiToken) {
  console.log('Starting brand migration...');

  const results = {
    created: 0,
    updated: 0,
    errors: []
  };

  for (const brand of brands) {
    try {
      // Check if brand exists
      const searchResponse = await fetch(
        `${strapiUrl}/api/brands?filters[slug][$eq]=${brand.slug}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const searchData = await searchResponse.json();

      const payload = {
        data: {
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          country: brand.country,
          website: brand.website,
          featured: brand.featured,
          publishedAt: new Date().toISOString()
        }
      };

      if (searchData.data && searchData.data.length > 0) {
        // Update existing brand
        const existingId = searchData.data[0].id;
        const updateResponse = await fetch(
          `${strapiUrl}/api/brands/${existingId}`,
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
          console.log(`Updated brand: ${brand.name}`);
          results.updated++;
        } else {
          const error = await updateResponse.json();
          throw new Error(JSON.stringify(error));
        }
      } else {
        // Create new brand
        const createResponse = await fetch(
          `${strapiUrl}/api/brands`,
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
          console.log(`Created brand: ${brand.name}`);
          results.created++;
        } else {
          const error = await createResponse.json();
          throw new Error(JSON.stringify(error));
        }
      }
    } catch (error) {
      console.error(`Error migrating brand ${brand.name}:`, error.message);
      results.errors.push({ brand: brand.name, error: error.message });
    }
  }

  console.log('\n--- Brand Migration Results ---');
  console.log(`Created: ${results.created}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Errors: ${results.errors.length}`);

  return results;
}

module.exports = { brands, migrateBrands };

// Run directly if called as script
if (require.main === module) {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const API_TOKEN = process.env.STRAPI_API_TOKEN;

  if (!API_TOKEN) {
    console.error('Error: STRAPI_API_TOKEN environment variable is required');
    console.log('Generate an API token in Strapi Admin > Settings > API Tokens');
    process.exit(1);
  }

  migrateBrands(STRAPI_URL, API_TOKEN)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
