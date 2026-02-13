/**
 * Migrate categories from productData.js to Strapi
 * Run with: node scripts/migrate-categories.js
 */

const categories = [
  {
    name: 'Bras',
    slug: 'bras',
    description: 'Explore the best of Colombian bras by Leonisa, designed for elegance and comfort. Delivered locally in Curacao.',
    breadcrumb: 'Lingerie',
    filterType: 'size',
    filters: ['All', 'S', 'M', 'L', 'XL'],
    sortOrder: 1,
    showInMenu: true
  },
  {
    name: 'Panties',
    slug: 'panties',
    description: 'Discover our collection of Colombian panties by Leonisa. Comfortable, stylish, and perfect for everyday wear. Delivered locally in Curacao.',
    breadcrumb: 'Lingerie',
    filterType: 'style',
    filters: ['All', 'Bikini', 'Thong', 'High Waist', 'Packs'],
    sortOrder: 2,
    showInMenu: true
  },
  {
    name: 'Shapewear',
    slug: 'shapewear',
    description: 'Discover Colombian shapewear from Leonisa. Premium compression garments designed to sculpt, smooth, and enhance your natural curves with all-day comfort.',
    breadcrumb: 'Lingerie',
    filterType: 'style',
    filters: ['All', 'High Waist', 'Thong', 'Seamless', 'Firm Control'],
    sortOrder: 3,
    showInMenu: true
  },
  {
    name: 'Fragrances',
    slug: 'colonias',
    description: "Discover our collection of authentic Colombian fragrances from top brands like L'Bel, Esika, Cyzone, and Yanbal. Premium perfumes delivered locally in Curacao.",
    breadcrumb: 'Beauty',
    filterType: 'category',
    filters: ['All', 'Women', 'Men', 'Gift Sets'],
    sortOrder: 4,
    showInMenu: true
  },
  {
    name: 'Creams',
    slug: 'cremas',
    description: "Premium skincare from L'Bel, Esika, and Yanbal. Nourish your skin with Colombian beauty secrets.",
    breadcrumb: 'Beauty',
    filterType: 'category',
    filters: ['All', 'Body', 'Face', 'Hand', 'Anti-Aging'],
    sortOrder: 5,
    showInMenu: true
  },
  {
    name: 'Sunscreen',
    slug: 'bloqueador',
    description: "Sun protection for the Caribbean sun. Stay protected with quality sunscreens from top Colombian brands like Yanbal, Esika, and L'Bel.",
    breadcrumb: 'Beauty',
    filterType: 'category',
    filters: ['All', 'Facial', 'Body', 'Tinted', 'Spray'],
    sortOrder: 6,
    showInMenu: true
  },
  {
    name: 'Deodorants',
    slug: 'desodorantes',
    description: 'Stay fresh all day with Colombian deodorants and antiperspirants from Esika and Yanbal.',
    breadcrumb: 'Beauty',
    filterType: 'category',
    filters: ['All', 'Women', 'Men', 'Roll-on', 'Unisex'],
    sortOrder: 7,
    showInMenu: true
  },
  {
    name: 'Facial Cleansing',
    slug: 'limpieza-facial',
    description: "Facial cleansing products for radiant skin. Colombian skincare at its best from L'Bel and Esika.",
    breadcrumb: 'Beauty',
    filterType: 'category',
    filters: ['All', 'Cleansers', 'Micellar Water', 'Toners', 'Exfoliators', 'Serums'],
    sortOrder: 8,
    showInMenu: true
  },
  {
    name: 'Accessories & Jewelry',
    slug: 'accesorios',
    description: 'Beautiful Colombian jewelry and accessories. Elegant pieces for every occasion.',
    breadcrumb: 'Accessories',
    filterType: 'category',
    filters: ['All', 'Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Sets'],
    sortOrder: 9,
    showInMenu: true
  }
];

async function migrateCategories(strapiUrl, apiToken) {
  console.log('Starting category migration...');

  const results = {
    created: 0,
    updated: 0,
    errors: []
  };

  for (const category of categories) {
    try {
      // Check if category exists
      const searchResponse = await fetch(
        `${strapiUrl}/api/categories?filters[slug][$eq]=${category.slug}`,
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
          name: category.name,
          slug: category.slug,
          description: category.description,
          breadcrumb: category.breadcrumb,
          filterType: category.filterType,
          filters: category.filters,
          sortOrder: category.sortOrder,
          showInMenu: category.showInMenu,
          publishedAt: new Date().toISOString()
        }
      };

      if (searchData.data && searchData.data.length > 0) {
        // Update existing category
        const existingId = searchData.data[0].id;
        const updateResponse = await fetch(
          `${strapiUrl}/api/categories/${existingId}`,
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
          console.log(`Updated category: ${category.name}`);
          results.updated++;
        } else {
          const error = await updateResponse.json();
          throw new Error(JSON.stringify(error));
        }
      } else {
        // Create new category
        const createResponse = await fetch(
          `${strapiUrl}/api/categories`,
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
          console.log(`Created category: ${category.name}`);
          results.created++;
        } else {
          const error = await createResponse.json();
          throw new Error(JSON.stringify(error));
        }
      }
    } catch (error) {
      console.error(`Error migrating category ${category.name}:`, error.message);
      results.errors.push({ category: category.name, error: error.message });
    }
  }

  console.log('\n--- Category Migration Results ---');
  console.log(`Created: ${results.created}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Errors: ${results.errors.length}`);

  return results;
}

module.exports = { categories, migrateCategories };

// Run directly if called as script
if (require.main === module) {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const API_TOKEN = process.env.STRAPI_API_TOKEN;

  if (!API_TOKEN) {
    console.error('Error: STRAPI_API_TOKEN environment variable is required');
    console.log('Generate an API token in Strapi Admin > Settings > API Tokens');
    process.exit(1);
  }

  migrateCategories(STRAPI_URL, API_TOKEN)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
