/**
 * Strapi CMS API Service for Unistyles Curacao
 *
 * Provides a clean interface to fetch content from Strapi CMS.
 * Falls back to hardcoded data when VITE_USE_STRAPI is false.
 */

// Use relative URL in production (nginx proxies /uploads to strapi)
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || '';
const USE_STRAPI = import.meta.env.VITE_USE_STRAPI === 'true';

// Safely parse JSON response
async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server returned non-JSON response');
  }
  return response.json();
}

// Helper to build Strapi API URL
function buildUrl(endpoint, params = {}) {
  const url = new URL(`/cms${endpoint}`, window.location.origin);

  // Add query parameters for population and filtering
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        url.searchParams.append(key, JSON.stringify(value));
      } else {
        url.searchParams.append(key, value);
      }
    }
  });

  return url.toString();
}

// Helper to transform Strapi response data
function transformProduct(strapiProduct) {
  const attrs = strapiProduct.attributes;

  return {
    id: strapiProduct.id,
    legacyId: attrs.legacyId,
    name: attrs.name,
    slug: attrs.slug,
    ref: attrs.ref,
    description: attrs.description,
    price: parseFloat(attrs.price),
    compareAtPrice: attrs.compareAtPrice ? parseFloat(attrs.compareAtPrice) : null,
    image: attrs.image?.data?.attributes?.url
      ? `${STRAPI_URL}${attrs.image.data.attributes.url}`
      : attrs.legacyImage || '/images/placeholder.jpg',
    gallery: attrs.gallery?.data?.map(img => `${STRAPI_URL}${img.attributes.url}`) || [],
    color: attrs.color,
    size: attrs.size,
    style: attrs.style,
    compression: attrs.compression,
    material: attrs.material,
    badge: attrs.badge,
    inStock: attrs.inStock,
    featured: attrs.featured,
    category: attrs.category?.data ? {
      id: attrs.category.data.id,
      name: attrs.category.data.attributes.name,
      slug: attrs.category.data.attributes.slug
    } : null,
    brand: attrs.brand?.data ? {
      id: attrs.brand.data.id,
      name: attrs.brand.data.attributes.name,
      slug: attrs.brand.data.attributes.slug
    } : null
  };
}

function transformCategory(strapiCategory) {
  const attrs = strapiCategory.attributes;

  return {
    id: strapiCategory.id,
    name: attrs.name,
    slug: attrs.slug,
    description: attrs.description,
    breadcrumb: attrs.breadcrumb,
    image: attrs.image?.data?.attributes?.url
      ? `${STRAPI_URL}${attrs.image.data.attributes.url}`
      : null,
    filterType: attrs.filterType,
    filters: attrs.filters || [],
    sortOrder: attrs.sortOrder,
    showInMenu: attrs.showInMenu,
    productCount: attrs.products?.data?.length || 0
  };
}

function transformBrand(strapiBrand) {
  const attrs = strapiBrand.attributes;

  return {
    id: strapiBrand.id,
    name: attrs.name,
    slug: attrs.slug,
    description: attrs.description,
    logo: attrs.logo?.data?.attributes?.url
      ? `${STRAPI_URL}${attrs.logo.data.attributes.url}`
      : null,
    website: attrs.website,
    country: attrs.country,
    featured: attrs.featured
  };
}

// API Functions

/**
 * Fetch all products with optional filters
 */
export async function fetchProducts(options = {}) {
  const {
    category,
    brand,
    featured,
    limit = 100,
    page = 1,
    sort = 'sortOrder:asc'
  } = options;

  const params = {
    'populate[image]': '*',
    'populate[category]': '*',
    'populate[brand]': '*',
    'pagination[page]': page,
    'pagination[pageSize]': limit,
    'sort': sort
  };

  if (category) {
    params['filters[category][slug][$eq]'] = category;
  }

  if (brand) {
    params['filters[brand][slug][$eq]'] = brand;
  }

  if (featured !== undefined) {
    params['filters[featured][$eq]'] = featured;
  }

  try {
    const response = await fetch(buildUrl('/products', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    return {
      products: data.data.map(transformProduct),
      pagination: data.meta.pagination
    };
  } catch (error) {
    console.warn('Products fetch failed:', error.message);
    return { products: [], pagination: { page: 1, pageSize: limit, total: 0 } };
  }
}

/**
 * Fetch a single product by ID or slug
 */
export async function fetchProduct(idOrSlug) {
  // Try to fetch by slug first
  const params = {
    'populate[image]': '*',
    'populate[gallery]': '*',
    'populate[category]': '*',
    'populate[brand]': '*'
  };

  // Check if it's a numeric ID or a slug/legacyId
  const isNumeric = /^\d+$/.test(idOrSlug);

  let url;
  if (isNumeric) {
    url = buildUrl(`/products/${idOrSlug}`, params);
  } else {
    // Try by legacyId first, then by slug
    params['filters[legacyId][$eq]'] = idOrSlug;
    url = buildUrl('/products', params);
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    if (isNumeric) {
      return transformProduct(data.data);
    }

    // For filter-based queries
    if (data.data && data.data.length > 0) {
      return transformProduct(data.data[0]);
    }

    // Try by slug
    const slugParams = {
      'populate[image]': '*',
      'populate[gallery]': '*',
      'populate[category]': '*',
      'populate[brand]': '*',
      'filters[slug][$eq]': idOrSlug
    };

    const slugResponse = await fetch(buildUrl('/products', slugParams));
    const slugData = await parseJsonResponse(slugResponse);

    if (slugData.data && slugData.data.length > 0) {
      return transformProduct(slugData.data[0]);
    }

    return null;
  } catch (error) {
    console.warn('Product fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetch all categories
 */
export async function fetchCategories(options = {}) {
  const { showInMenu, includeProducts = false } = options;

  const params = {
    'populate[image]': '*',
    'sort': 'sortOrder:asc'
  };

  if (includeProducts) {
    params['populate[products]'] = '*';
  }

  if (showInMenu !== undefined) {
    params['filters[showInMenu][$eq]'] = showInMenu;
  }

  try {
    const response = await fetch(buildUrl('/categories', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    return data.data.map(transformCategory);
  } catch (error) {
    console.warn('Categories fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch a single category by slug
 */
export async function fetchCategory(slug) {
  const params = {
    'populate[image]': '*',
    'filters[slug][$eq]': slug
  };

  try {
    const response = await fetch(buildUrl('/categories', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch category: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    if (data.data && data.data.length > 0) {
      return transformCategory(data.data[0]);
    }

    return null;
  } catch (error) {
    console.warn('Category fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetch all brands
 */
export async function fetchBrands(options = {}) {
  const { featured } = options;

  const params = {
    'populate[logo]': '*',
    'sort': 'name:asc'
  };

  if (featured !== undefined) {
    params['filters[featured][$eq]'] = featured;
  }

  try {
    const response = await fetch(buildUrl('/brands', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch brands: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    return data.data.map(transformBrand);
  } catch (error) {
    console.warn('Brands fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch homepage content
 */
export async function fetchHomepage() {
  const params = {
    'populate[heroSlides][populate]': '*',
    'populate[featuredCategories][populate]': '*',
    'populate[featuredProducts][populate][image]': '*',
    'populate[featuredProducts][populate][category]': '*',
    'populate[newArrivals][populate][image]': '*',
    'populate[newArrivals][populate][category]': '*',
    'populate[promoBanner][populate]': '*'
  };

  try {
    const response = await fetch(buildUrl('/homepage', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${response.status}`);
    }

    const data = await parseJsonResponse(response);
    const attrs = data.data?.attributes || {};

    // Transform hero slides to include proper image URLs
    const heroSlides = (attrs.heroSlides || []).map(slide => ({
      id: slide.id,
      title: slide.title,
      titleLine2: slide.titleLine2,
      subtitle: slide.subtitle,
      buttonText: slide.buttonText,
      buttonLink: slide.buttonLink,
      textColor: slide.textColor,
      textPosition: slide.textPosition,
      sortOrder: slide.sortOrder,
      image: slide.image?.data?.attributes?.url
        ? `${STRAPI_URL}${slide.image.data.attributes.url}`
        : slide.legacyImage || null,
      legacyImage: slide.legacyImage
    }));

    return {
      heroSlides,
      featuredCategories: attrs.featuredCategories?.data?.map(transformCategory) || [],
      featuredProducts: attrs.featuredProducts?.data?.map(transformProduct) || [],
      newArrivals: attrs.newArrivals?.data?.map(transformProduct) || [],
      promoBanner: attrs.promoBanner || null,
      seoTitle: attrs.seoTitle,
      seoDescription: attrs.seoDescription
    };
  } catch (error) {
    console.warn('Homepage fetch failed:', error.message);
    return {
      heroSlides: [],
      featuredCategories: [],
      featuredProducts: [],
      newArrivals: [],
      promoBanner: null,
      seoTitle: null,
      seoDescription: null
    };
  }
}

/**
 * Fetch a page by slug
 */
export async function fetchPage(slug) {
  const params = {
    'populate[featuredImage]': '*',
    'filters[slug][$eq]': slug
  };

  try {
    const response = await fetch(buildUrl('/pages', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    if (data.data && data.data.length > 0) {
      const page = data.data[0];
      const attrs = page.attributes;

      return {
        id: page.id,
        title: attrs.title,
        slug: attrs.slug,
        content: attrs.content,
        excerpt: attrs.excerpt,
        featuredImage: attrs.featuredImage?.data?.attributes?.url
          ? `${STRAPI_URL}${attrs.featuredImage.data.attributes.url}`
          : null,
        seoTitle: attrs.seoTitle,
        seoDescription: attrs.seoDescription
      };
    }

    return null;
  } catch (error) {
    console.warn('Page fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetch business settings
 */
export async function fetchBusinessSettings() {
  const params = {
    'populate[logo]': '*'
  };

  try {
    const response = await fetch(buildUrl('/business-setting', params));

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.status}`);
    }

    const data = await parseJsonResponse(response);
    const attrs = data.data?.attributes || {};

    return {
      storeName: attrs.storeName || 'Unistyles',
      tagline: attrs.tagline,
      logo: attrs.logo?.data?.attributes?.url
        ? `${STRAPI_URL}${attrs.logo.data.attributes.url}`
        : null,
      email: attrs.email,
      phone: attrs.phone,
      whatsappNumber: attrs.whatsappNumber,
      address: attrs.address,
      currency: attrs.currency || 'ANG',
      currencySymbol: attrs.currencySymbol || 'NAf.',
      freeDeliveryThreshold: attrs.freeDeliveryThreshold,
      deliveryFee: attrs.deliveryFee,
      deliveryZones: attrs.deliveryZones || [],
      paymentMethods: attrs.paymentMethods || [],
      socialLinks: attrs.socialLinks || {},
      businessHours: attrs.businessHours || {},
      maintenanceMode: attrs.maintenanceMode,
      maintenanceMessage: attrs.maintenanceMessage
    };
  } catch (error) {
    console.warn('Business settings fetch failed:', error.message);
    return {
      storeName: 'Unistyles',
      tagline: null,
      logo: null,
      email: null,
      phone: null,
      whatsappNumber: null,
      address: null,
      currency: 'ANG',
      currencySymbol: 'NAf.',
      freeDeliveryThreshold: null,
      deliveryFee: null,
      deliveryZones: [],
      paymentMethods: [],
      socialLinks: {},
      businessHours: {},
      maintenanceMode: false,
      maintenanceMessage: null
    };
  }
}

/**
 * Search products
 */
export async function searchProducts(query, options = {}) {
  const { limit = 20 } = options;

  const params = {
    'populate[image]': '*',
    'populate[category]': '*',
    'pagination[pageSize]': limit,
    '_q': query
  };

  // Strapi's search functionality
  const searchParams = {
    ...params,
    'filters[$or][0][name][$containsi]': query,
    'filters[$or][1][description][$containsi]': query,
    'filters[$or][2][ref][$containsi]': query
  };

  try {
    const response = await fetch(buildUrl('/products', searchParams));

    if (!response.ok) {
      throw new Error(`Failed to search products: ${response.status}`);
    }

    const data = await parseJsonResponse(response);

    return data.data.map(transformProduct);
  } catch (error) {
    console.warn('Product search failed:', error.message);
    return [];
  }
}

// Export config for use in components
export const strapiConfig = {
  url: STRAPI_URL,
  enabled: USE_STRAPI
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
  config: strapiConfig
};
