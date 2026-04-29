'use strict';

// Load product data from JSON file
const productsData = require('./seed-data.json');

const brands = [
  { name: 'Leonisa', slug: 'leonisa', country: 'Colombia', featured: true },
  { name: "L'Bel", slug: 'lbel', country: 'Colombia', featured: true },
  { name: 'Esika', slug: 'esika', country: 'Colombia', featured: true },
  { name: 'Yanbal', slug: 'yanbal', country: 'Colombia', featured: true },
  { name: 'Cyzone', slug: 'cyzone', country: 'Colombia', featured: false }
];

const heroSlides = [
  {
    title: 'Elegance',
    titleLine2: 'Redefined',
    subtitle: 'Discover our premium Colombian lingerie collection',
    buttonText: 'Shop Lingerie',
    buttonLink: '/bras',
    legacyImage: '/images/hero-bra.jpg',
    textColor: 'white',
    textPosition: 'center',
    sortOrder: 1
  },
  {
    title: 'Timeless',
    titleLine2: 'Beauty',
    subtitle: 'Luxurious shapewear designed for the modern woman',
    buttonText: 'Shop Shapewear',
    buttonLink: '/shapewear',
    legacyImage: '/images/LEONISA_HD_02.jpg',
    textColor: 'white',
    textPosition: 'center',
    sortOrder: 2
  },
  {
    title: 'New',
    titleLine2: 'Collection',
    subtitle: 'Be the first to explore our latest arrivals',
    buttonText: 'View Collection',
    buttonLink: '/bras',
    legacyImage: '/images/LEONISA_HD_04.jpg',
    textColor: 'white',
    textPosition: 'center',
    sortOrder: 3
  },
  {
    title: 'Perfect',
    titleLine2: 'Comfort',
    subtitle: 'Premium quality lingerie for everyday confidence',
    buttonText: 'Shop Now',
    buttonLink: '/bras',
    legacyImage: '/images/LEONISA_HD_05.jpg',
    textColor: 'white',
    textPosition: 'center',
    sortOrder: 4
  },
  {
    title: 'Colombian',
    titleLine2: 'Beauty',
    subtitle: 'Authentic brands delivered to your door in Curacao',
    buttonText: 'Explore',
    buttonLink: '/shapewear',
    legacyImage: '/images/LEONISA_HD_06.jpg',
    textColor: 'white',
    textPosition: 'center',
    sortOrder: 5
  }
];

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Map badge values to Strapi enum
function mapBadge(badge) {
  if (!badge) return null;
  const badgeMap = {
    'New': 'new',
    'Bestseller': 'bestseller',
    'Premium': 'premium',
    'Sale': 'sale',
    'Gift Set': 'gift_set',
    '3-Pack': 'pack_3',
    'Firm Control': 'premium',
    'SPF 100': null,
    'Anti-Aging': null
  };
  return badgeMap[badge] !== undefined ? badgeMap[badge] : null;
}

// Map compression values to Strapi enum (lowercase)
function mapCompression(compression) {
  if (!compression) return null;
  const val = compression.toLowerCase();
  if (['light', 'medium', 'firm'].includes(val)) return val;
  return null;
}

module.exports = {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }) {
    // Set up public permissions
    await setupPublicPermissions(strapi);

    // FORCE_RESEED=1 wipes products and re-creates everything from seed-data.json.
    // Use this when the catalog has been overhauled (discontinued items removed,
    // new SKUs added, variant structure changed). Owner can trigger from a one-shot
    // env var on next deploy/restart.
    const forceReseed = process.env.FORCE_RESEED === '1' || process.env.FORCE_RESEED === 'true';
    if (forceReseed) {
      await wipeProducts(strapi);
    }

    // Seed (or sync) products
    await seedOrSyncData(strapi);

    // Always check homepage (separate from products)
    await seedHomepage(strapi);
  },
};

async function wipeProducts(strapi) {
  try {
    strapi.log.warn('FORCE_RESEED=1 — wiping all products before reseed');
    const all = await strapi.entityService.findMany('api::product.product', {
      fields: ['id'],
      pagination: { limit: -1 },
    });
    for (const p of all) {
      try {
        await strapi.entityService.delete('api::product.product', p.id);
      } catch (e) {
        strapi.log.error(`failed to delete product ${p.id}: ${e.message}`);
      }
    }
    strapi.log.info(`wiped ${all.length} products`);
  } catch (error) {
    strapi.log.error('wipe failed:', error.message);
  }
}

async function setupPublicPermissions(strapi) {
  const publicContentTypes = [
    'api::product.product',
    'api::category.category',
    'api::brand.brand',
    'api::homepage.homepage',
    'api::page.page',
    'api::business-setting.business-setting',
  ];
  const publicActions = ['find', 'findOne'];

  try {
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
    if (!publicRole) {
      strapi.log.warn('Public role not found');
      return;
    }

    const existingPermissions = await strapi.query('plugin::users-permissions.permission').findMany({ where: { role: publicRole.id } });
    const existingActionMap = new Set(existingPermissions.map(p => p.action));

    for (const contentType of publicContentTypes) {
      for (const action of publicActions) {
        const fullAction = `${contentType}.${action}`;
        if (!existingActionMap.has(fullAction)) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action: fullAction, role: publicRole.id },
          });
          strapi.log.info(`Created permission: ${fullAction}`);
        }
      }
    }
    strapi.log.info('Public permissions configured');
  } catch (error) {
    strapi.log.error('Failed to configure permissions:', error.message);
  }
}

async function seedOrSyncData(strapi) {
  try {
    // In sync mode (DB already has products and FORCE_RESEED is off):
    //   - update existing by legacyId (price, stock, variants)
    //   - create new
    //   - delete DB products whose legacyId is not in the current seed
    //     (this is how discontinued items get removed)
    const existingProducts = await strapi.entityService.count('api::product.product');
    const isSync = existingProducts > 0;
    if (isSync) {
      strapi.log.info(`DB has ${existingProducts} products — running sync (add/update/delete)`);
    } else {
      strapi.log.info('DB empty — seeding from scratch');
    }

    // Build set of legacyIds present in seed for later cleanup
    const seedLegacyIds = new Set();
    for (const cat of Object.values(productsData)) {
      for (const p of cat.products || []) {
        if (p.id) seedLegacyIds.add(p.id);
      }
    }

    // Create brands
    const brandMap = {};
    for (const brand of brands) {
      try {
        const existing = await strapi.entityService.findMany('api::brand.brand', {
          filters: { slug: brand.slug }
        });
        if (existing.length === 0) {
          const created = await strapi.entityService.create('api::brand.brand', {
            data: { ...brand, publishedAt: new Date() }
          });
          brandMap[brand.name] = created.id;
          strapi.log.info(`Created brand: ${brand.name}`);
        } else {
          brandMap[brand.name] = existing[0].id;
        }
      } catch (e) {
        strapi.log.error(`Failed to create brand ${brand.name}:`, e.message);
      }
    }

    // Create categories and products
    let sortOrder = 1;
    let totalProducts = 0;
    let failedProducts = 0;

    for (const [slug, data] of Object.entries(productsData)) {
      // Create category
      let categoryId;
      try {
        const existing = await strapi.entityService.findMany('api::category.category', {
          filters: { slug }
        });
        if (existing.length === 0) {
          const category = await strapi.entityService.create('api::category.category', {
            data: {
              name: data.title,
              slug,
              description: data.description,
              breadcrumb: data.breadcrumb,
              filterType: data.filterType,
              filters: data.filters,
              sortOrder: sortOrder++,
              showInMenu: true,
              publishedAt: new Date()
            }
          });
          categoryId = category.id;
          strapi.log.info(`Created category: ${data.title} (${data.products.length} products)`);
        } else {
          categoryId = existing[0].id;
          strapi.log.info(`Category exists: ${data.title}`);
        }
      } catch (e) {
        strapi.log.error(`Failed to create category ${data.title}:`, e.message);
        continue;
      }

      // Create products
      for (const product of data.products) {
        try {
          // Check if product already exists
          const existingProduct = await strapi.entityService.findMany('api::product.product', {
            filters: { legacyId: product.id }
          });

          const seedStock = product.stockQuantity != null ? product.stockQuantity : 0;
          const seedInStock = product.inStock != null ? product.inStock : seedStock > 0;
          const variantsData = (product.variants || []).map(v => ({
            sku: v.sku,
            color: v.color || null,
            size: v.size || null,
            price: v.price != null ? v.price : product.price,
            stockQuantity: v.stockQuantity != null ? v.stockQuantity : 0,
            inStock: v.inStock != null ? v.inStock : (v.stockQuantity || 0) > 0,
          }));

          if (existingProduct.length > 0) {
            const existing = existingProduct[0];
            await strapi.entityService.update('api::product.product', existing.id, {
              data: {
                price: product.price,
                stockQuantity: seedStock,
                inStock: seedInStock,
                description: product.description || existing.description,
                color: product.color || null,
                size: product.size || null,
                variants: variantsData,
                legacyImage: product.image,
              }
            });
            totalProducts++;
            continue;
          }

          const productSlug = slugify(`${product.name}-${product.id}`);
          const productData = {
            legacyId: product.id,
            name: product.name,
            slug: productSlug,
            ref: product.ref,
            description: product.description || `${product.name} - Premium quality from ${data.title} collection`,
            price: product.price,
            legacyImage: product.image,
            color: product.color || null,
            size: product.size || null,
            style: product.style || null,
            compression: mapCompression(product.compression),
            material: product.material || null,
            badge: mapBadge(product.badge),
            inStock: seedInStock,
            stockQuantity: seedStock,
            featured: product.badge === 'Bestseller' || product.badge === 'New',
            sortOrder: data.products.indexOf(product) + 1,
            category: categoryId,
            brand: product.brand ? brandMap[product.brand] || null : null,
            variants: variantsData,
            publishedAt: new Date()
          };

          await strapi.entityService.create('api::product.product', { data: productData });
          totalProducts++;
        } catch (e) {
          failedProducts++;
          // Only log first few errors to avoid spam
          if (failedProducts <= 5) {
            strapi.log.error(`Failed to create product ${product.id}: ${e.message}`);
          }
        }
      }
    }

    if (failedProducts > 5) {
      strapi.log.warn(`... and ${failedProducts - 5} more product errors`);
    }

    // Discontinued cleanup: any DB product whose legacyId is not in the seed
    // gets deleted. This is how products marked red in the catalog get removed.
    let removedCount = 0;
    try {
      const allDbProducts = await strapi.entityService.findMany('api::product.product', {
        fields: ['id', 'legacyId', 'name'],
        pagination: { limit: -1 },
      });
      for (const dbp of allDbProducts) {
        if (dbp.legacyId && !seedLegacyIds.has(dbp.legacyId)) {
          try {
            await strapi.entityService.delete('api::product.product', dbp.id);
            removedCount++;
          } catch (e) {
            strapi.log.error(`failed to delete discontinued ${dbp.legacyId}: ${e.message}`);
          }
        }
      }
      if (removedCount > 0) {
        strapi.log.info(`removed ${removedCount} discontinued products (legacyId not in seed)`);
      }
    } catch (e) {
      strapi.log.error('discontinued cleanup failed:', e.message);
    }

    strapi.log.info(`Seed/sync complete: ${totalProducts} upserted, ${failedProducts} failed, ${removedCount} discontinued removed`);
  } catch (error) {
    strapi.log.error('Seed/sync failed:', error.message);
  }
}

async function seedHomepage(strapi) {
  try {
    // Check if homepage already exists
    const existingHomepage = await strapi.entityService.findMany('api::homepage.homepage');
    if (existingHomepage && existingHomepage.heroSlides && existingHomepage.heroSlides.length > 0) {
      strapi.log.info('Homepage already has hero slides, skipping');
      return;
    }

    // Get featured products for homepage
    const featuredProducts = await strapi.entityService.findMany('api::product.product', {
      filters: { featured: true },
      limit: 8
    });

    const newArrivals = await strapi.entityService.findMany('api::product.product', {
      filters: { badge: 'new' },
      limit: 8
    });

    // Create or update homepage
    const homepageData = {
      heroSlides: heroSlides,
      featuredProducts: featuredProducts.map(p => p.id),
      newArrivals: newArrivals.map(p => p.id),
      seoTitle: 'UNISTYLES Curacao - Colombian Beauty & Lingerie',
      seoDescription: 'Discover authentic Colombian lingerie, shapewear, and beauty products. Premium brands like Leonisa, L\'Bel, Esika, and Yanbal delivered in Curacao.',
      publishedAt: new Date()
    };

    if (existingHomepage) {
      await strapi.entityService.update('api::homepage.homepage', existingHomepage.id, {
        data: homepageData
      });
      strapi.log.info('Updated homepage with hero slides');
    } else {
      await strapi.entityService.create('api::homepage.homepage', {
        data: homepageData
      });
      strapi.log.info('Created homepage with 5 hero slides');
    }
  } catch (error) {
    strapi.log.error('Failed to seed homepage:', error.message);
  }
}
