/**
 * Directus CMS API service for Unistyles Curacao.
 *
 * Replaces the Strapi-based strapiService.js. Function signatures and
 * returned shapes are intentionally identical so consumers (useProducts,
 * page components) don't need to change.
 *
 * Directus collections and field names use snake_case (set up in
 * services/directus/bootstrap.js). This module normalizes to the camelCase shape
 * the rest of the frontend already expects.
 */

const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL || '').replace(/\/$/, '');
const USE_CMS = import.meta.env.VITE_USE_CMS !== 'false';

async function parseJsonResponse(response) {
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('Server returned non-JSON response');
  }
  return response.json();
}

function buildUrl(path, params = {}) {
  const url = new URL(`/items${path}`, DIRECTUS_URL || window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      url.searchParams.append(key, value.join(','));
    } else {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}

function assetUrl(fileRef) {
  if (!fileRef) return null;
  // Directus returns either a UUID string or an expanded file object.
  const id = typeof fileRef === 'string' ? fileRef : fileRef.id;
  return id ? `${DIRECTUS_URL}/assets/${id}` : null;
}

function transformProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    legacyId: p.legacy_id,
    name: p.name,
    slug: p.slug,
    ref: p.ref,
    description: p.description,
    price: p.price != null ? parseFloat(p.price) : null,
    compareAtPrice: p.compare_at_price != null ? parseFloat(p.compare_at_price) : null,
    image: assetUrl(p.image) || p.legacy_image || '/images/placeholder.jpg',
    gallery: Array.isArray(p.gallery)
      ? p.gallery.map(assetUrl).filter(Boolean)
      : [],
    color: p.color,
    size: p.size,
    style: p.style,
    compression: p.compression,
    material: p.material,
    badge: p.badge,
    inStock: p.in_stock,
    featured: p.featured,
    gender: p.gender,
    fragranceFamily: p.fragrance_family,
    scentProfile: p.scent_profile,
    intensity: p.intensity,
    occasion: p.occasion,
    season: p.season,
    topNotes: p.top_notes,
    middleNotes: p.middle_notes,
    baseNotes: p.base_notes,
    volume: p.volume,
    concentration: p.concentration,
    skinType: p.skin_type,
    skinConcern: p.skin_concern,
    applicationArea: p.application_area,
    texture: p.texture,
    keyIngredients: p.key_ingredients,
    spf: p.spf,
    dermatologistTested: p.dermatologist_tested,
    routineStep: p.routine_step,
    timeOfUse: p.time_of_use,
    category: p.category_id && typeof p.category_id === 'object'
      ? { id: p.category_id.id, name: p.category_id.name, slug: p.category_id.slug }
      : null,
    brand: p.brand_id && typeof p.brand_id === 'object'
      ? { id: p.brand_id.id, name: p.brand_id.name, slug: p.brand_id.slug }
      : null,
  };
}

function transformCategory(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    breadcrumb: c.breadcrumb,
    image: assetUrl(c.image),
    filterType: c.filter_type,
    filters: c.filters || [],
    sortOrder: c.sort_order,
    showInMenu: c.show_in_menu,
    productCount: Array.isArray(c.products) ? c.products.length : 0,
  };
}

function transformBrand(b) {
  if (!b) return null;
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    logo: assetUrl(b.logo),
    website: b.website,
    country: b.country,
    featured: b.featured,
  };
}

const PRODUCT_FIELDS = '*,image.*,category_id.*,brand_id.*';
const PRODUCT_LIST_FIELDS = 'id,legacy_id,slug,ref,name,description,price,compare_at_price,image.*,color,size,style,compression,material,badge,in_stock,featured,gender,fragrance_family,scent_profile,intensity,occasion,season,top_notes,middle_notes,base_notes,volume,concentration,skin_type,skin_concern,application_area,texture,key_ingredients,spf,dermatologist_tested,routine_step,time_of_use,sort_order,category_id.id,category_id.name,category_id.slug,brand_id.id,brand_id.name,brand_id.slug';

/**
 * Translate Strapi-style sort like "sortOrder:asc" / "name:desc" into
 * Directus's "sort_order" / "-name" field syntax.
 */
function translateSort(sort) {
  if (!sort) return null;
  const camelToSnake = (s) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  return sort
    .split(',')
    .map((token) => {
      const [field, direction] = token.split(':');
      const snake = camelToSnake(field.trim());
      return direction && direction.trim().toLowerCase() === 'desc' ? `-${snake}` : snake;
    })
    .join(',');
}

export async function fetchProducts(options = {}) {
  const { category, brand, featured, limit = 25, page = 1, sort = 'sortOrder:asc' } = options;

  const params = {
    fields: PRODUCT_LIST_FIELDS,
    limit,
    page,
    sort: translateSort(sort),
    meta: 'filter_count',
  };
  if (category) params['filter[category_id][slug][_eq]'] = category;
  if (brand) params['filter[brand_id][slug][_eq]'] = brand;
  if (featured !== undefined) params['filter[featured][_eq]'] = featured;

  try {
    const res = await fetch(buildUrl('/products', params));
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
    const data = await parseJsonResponse(res);
    const total = data.meta?.filter_count ?? data.data?.length ?? 0;
    return {
      products: data.data.map(transformProduct),
      pagination: {
        page,
        pageSize: limit,
        total,
        pageCount: Math.ceil(total / limit) || 1,
      },
    };
  } catch (e) {
    console.warn('Products fetch failed:', e.message);
    return { products: [], pagination: { page: 1, pageSize: limit, total: 0, pageCount: 0 } };
  }
}

export async function fetchProduct(idOrSlug) {
  const isNumeric = /^\d+$/.test(String(idOrSlug));

  try {
    if (isNumeric) {
      const res = await fetch(buildUrl(`/products/${idOrSlug}`, { fields: PRODUCT_FIELDS }));
      if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
      const data = await parseJsonResponse(res);
      return transformProduct(data.data);
    }

    // Try by legacy_id first, then by slug.
    for (const filterField of ['legacy_id', 'slug']) {
      const params = {
        fields: PRODUCT_FIELDS,
        [`filter[${filterField}][_eq]`]: idOrSlug,
        limit: 1,
      };
      const res = await fetch(buildUrl('/products', params));
      if (!res.ok) continue;
      const data = await parseJsonResponse(res);
      if (data.data && data.data.length > 0) {
        return transformProduct(data.data[0]);
      }
    }
    return null;
  } catch (e) {
    console.warn('Product fetch failed:', e.message);
    return null;
  }
}

export async function fetchCategories(options = {}) {
  const { showInMenu, includeProducts = false } = options;

  const fields = includeProducts ? '*,image.*,products.id' : '*,image.*';
  const params = { fields, sort: 'sort_order' };
  if (showInMenu !== undefined) params['filter[show_in_menu][_eq]'] = showInMenu;

  try {
    const res = await fetch(buildUrl('/categories', params));
    if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
    const data = await parseJsonResponse(res);
    return data.data.map(transformCategory);
  } catch (e) {
    console.warn('Categories fetch failed:', e.message);
    return [];
  }
}

export async function fetchCategory(slug) {
  try {
    const res = await fetch(buildUrl('/categories', {
      fields: '*,image.*',
      'filter[slug][_eq]': slug,
      limit: 1,
    }));
    if (!res.ok) throw new Error(`Failed to fetch category: ${res.status}`);
    const data = await parseJsonResponse(res);
    return data.data && data.data.length > 0 ? transformCategory(data.data[0]) : null;
  } catch (e) {
    console.warn('Category fetch failed:', e.message);
    return null;
  }
}

export async function fetchBrands(options = {}) {
  const { featured } = options;
  const params = { fields: '*,logo.*', sort: 'name' };
  if (featured !== undefined) params['filter[featured][_eq]'] = featured;

  try {
    const res = await fetch(buildUrl('/brands', params));
    if (!res.ok) throw new Error(`Failed to fetch brands: ${res.status}`);
    const data = await parseJsonResponse(res);
    return data.data.map(transformBrand);
  } catch (e) {
    console.warn('Brands fetch failed:', e.message);
    return [];
  }
}

export async function fetchHomepage() {
  try {
    const res = await fetch(buildUrl('/homepage', { fields: '*' }));
    if (!res.ok) throw new Error(`Failed to fetch homepage: ${res.status}`);
    const data = await parseJsonResponse(res);
    const h = data.data || {};

    // hero_slides / promo_banner are stored as JSON in Directus. Image refs
    // inside should be Directus file UUIDs — the migration script writes them
    // that way. We resolve them to public asset URLs here.
    const heroSlides = (h.hero_slides || []).map((slide) => ({
      id: slide.id,
      title: slide.title,
      titleLine2: slide.titleLine2 || slide.title_line_2,
      subtitle: slide.subtitle,
      buttonText: slide.buttonText || slide.button_text,
      buttonLink: slide.buttonLink || slide.button_link,
      textColor: slide.textColor || slide.text_color,
      textPosition: slide.textPosition || slide.text_position,
      sortOrder: slide.sortOrder ?? slide.sort_order,
      image: assetUrl(slide.image) || slide.legacyImage || slide.legacy_image || null,
      legacyImage: slide.legacyImage || slide.legacy_image,
    }));

    return {
      heroSlides,
      featuredCategories: (h.featured_categories || []).map(transformCategory),
      featuredProducts: (h.featured_products || []).map(transformProduct),
      newArrivals: (h.new_arrivals || []).map(transformProduct),
      promoBanner: h.promo_banner || null,
      seoTitle: h.seo_title,
      seoDescription: h.seo_description,
    };
  } catch (e) {
    console.warn('Homepage fetch failed:', e.message);
    return {
      heroSlides: [],
      featuredCategories: [],
      featuredProducts: [],
      newArrivals: [],
      promoBanner: null,
      seoTitle: null,
      seoDescription: null,
    };
  }
}

export async function fetchPage(slug) {
  try {
    const res = await fetch(buildUrl('/pages', {
      fields: '*,featured_image.*',
      'filter[slug][_eq]': slug,
      limit: 1,
    }));
    if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);
    const data = await parseJsonResponse(res);
    if (!data.data || data.data.length === 0) return null;

    const page = data.data[0];
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      excerpt: page.excerpt,
      featuredImage: assetUrl(page.featured_image),
      seoTitle: page.seo_title,
      seoDescription: page.seo_description,
    };
  } catch (e) {
    console.warn('Page fetch failed:', e.message);
    return null;
  }
}

export async function fetchBusinessSettings() {
  const fallback = {
    storeName: 'Unistyles',
    tagline: null,
    logo: null,
    email: null,
    phone: null,
    whatsappNumber: null,
    address: null,
    currency: 'XCG',
    currencySymbol: 'XCG',
    freeDeliveryThreshold: null,
    deliveryFee: null,
    deliveryZones: [],
    paymentMethods: [],
    socialLinks: {},
    businessHours: {},
    maintenanceMode: false,
    maintenanceMessage: null,
  };

  try {
    const res = await fetch(buildUrl('/business_settings', { fields: '*,logo.*' }));
    if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
    const data = await parseJsonResponse(res);
    const s = data.data || {};
    return {
      storeName: s.store_name || fallback.storeName,
      tagline: s.tagline,
      logo: assetUrl(s.logo),
      email: s.email,
      phone: s.phone,
      whatsappNumber: s.whatsapp_number,
      address: s.address,
      currency: s.currency || fallback.currency,
      currencySymbol: s.currency_symbol || fallback.currencySymbol,
      freeDeliveryThreshold: s.free_delivery_threshold != null ? parseFloat(s.free_delivery_threshold) : null,
      deliveryFee: s.delivery_fee != null ? parseFloat(s.delivery_fee) : null,
      deliveryZones: s.delivery_zones || [],
      paymentMethods: s.payment_methods || [],
      socialLinks: s.social_links || {},
      businessHours: s.business_hours || {},
      maintenanceMode: s.maintenance_mode || false,
      maintenanceMessage: s.maintenance_message,
    };
  } catch (e) {
    console.warn('Business settings fetch failed:', e.message);
    return fallback;
  }
}

export async function searchProducts(query, options = {}) {
  const { limit = 20 } = options;
  const params = {
    fields: PRODUCT_LIST_FIELDS,
    search: query,
    limit,
  };

  try {
    const res = await fetch(buildUrl('/products', params));
    if (!res.ok) throw new Error(`Failed to search products: ${res.status}`);
    const data = await parseJsonResponse(res);
    return data.data.map(transformProduct);
  } catch (e) {
    console.warn('Product search failed:', e.message);
    return [];
  }
}

export const directusConfig = {
  url: DIRECTUS_URL,
  enabled: USE_CMS,
};

export default {
  fetchProducts,
  fetchProduct,
  fetchCategories,
  fetchCategory,
  fetchBrands,
  fetchHomepage,
  fetchPage,
  fetchBusinessSettings,
  searchProducts,
  config: directusConfig,
};
