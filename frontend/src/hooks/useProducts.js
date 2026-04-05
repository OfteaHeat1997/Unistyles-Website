/**
 * React Query hooks for Strapi data fetching
 *
 * These hooks provide caching, automatic refetching, and loading states
 * for all Strapi content types.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProducts,
  fetchProduct,
  fetchCategories,
  fetchCategory,
  fetchBrands,
  fetchHomepage,
  fetchPage,
  fetchBusinessSettings,
  searchProducts,
  strapiConfig
} from '../services/strapiService';

// Import fallback data
import { products as localProducts, getProductById, getProductsByCategory } from '../data/productData';

const USE_STRAPI = strapiConfig.enabled;

// Query key factories
const queryKeys = {
  products: {
    all: ['products'],
    lists: () => [...queryKeys.products.all, 'list'],
    list: (filters) => [...queryKeys.products.lists(), filters],
    details: () => [...queryKeys.products.all, 'detail'],
    detail: (id) => [...queryKeys.products.details(), id],
    search: (query) => [...queryKeys.products.all, 'search', query]
  },
  categories: {
    all: ['categories'],
    lists: () => [...queryKeys.categories.all, 'list'],
    list: (filters) => [...queryKeys.categories.lists(), filters],
    detail: (slug) => [...queryKeys.categories.all, 'detail', slug]
  },
  brands: {
    all: ['brands'],
    list: (filters) => [...queryKeys.brands.all, 'list', filters]
  },
  homepage: ['homepage'],
  pages: {
    all: ['pages'],
    detail: (slug) => [...queryKeys.pages.all, slug]
  },
  settings: ['settings']
};

/**
 * Hook to fetch products with filters
 */
export function useProducts(options = {}) {
  const { category, brand, featured, limit, page, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.products.list({ category, brand, featured, limit, page }),
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to local data
        let products = [];

        if (category) {
          const categoryData = localProducts[category];
          if (categoryData) {
            products = categoryData.products.map(p => ({
              ...p,
              categorySlug: category,
              categoryName: categoryData.title
            }));
          }
        } else {
          // Get all products
          Object.entries(localProducts).forEach(([slug, data]) => {
            data.products.forEach(p => {
              products.push({
                ...p,
                categorySlug: slug,
                categoryName: data.title
              });
            });
          });
        }

        if (featured) {
          products = products.filter(p => p.badge === 'New' || p.badge === 'Bestseller');
        }

        return {
          products,
          pagination: { page: 1, pageSize: products.length, total: products.length }
        };
      }

      return fetchProducts({ category, brand, featured, limit, page });
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch a single product
 */
export function useProduct(idOrSlug) {
  return useQuery({
    queryKey: queryKeys.products.detail(idOrSlug),
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to local data
        return getProductById(idOrSlug);
      }

      return fetchProduct(idOrSlug);
    },
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to fetch products by category
 */
export function useProductsByCategory(categorySlug, options = {}) {
  return useProducts({ ...options, category: categorySlug });
}

/**
 * Hook to fetch all categories
 */
export function useCategories(options = {}) {
  const { showInMenu, includeProducts = false } = options;

  return useQuery({
    queryKey: queryKeys.categories.list({ showInMenu, includeProducts }),
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to local data
        return Object.entries(localProducts).map(([slug, data], index) => ({
          id: index + 1,
          name: data.title,
          slug,
          description: data.description,
          breadcrumb: data.breadcrumb,
          filterType: data.filterType,
          filters: data.filters,
          sortOrder: index + 1,
          showInMenu: true,
          productCount: data.products.length
        }));
      }

      return fetchCategories({ showInMenu, includeProducts });
    },
    staleTime: 10 * 60 * 1000 // 10 minutes - categories don't change often
  });
}

/**
 * Hook to fetch a single category
 */
export function useCategory(slug) {
  return useQuery({
    queryKey: queryKeys.categories.detail(slug),
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to local data
        const data = localProducts[slug];
        if (!data) return null;

        return {
          id: Object.keys(localProducts).indexOf(slug) + 1,
          name: data.title,
          slug,
          description: data.description,
          breadcrumb: data.breadcrumb,
          filterType: data.filterType,
          filters: data.filters,
          sortOrder: Object.keys(localProducts).indexOf(slug) + 1,
          showInMenu: true,
          productCount: data.products.length
        };
      }

      return fetchCategory(slug);
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000
  });
}

/**
 * Hook to fetch all brands
 */
export function useBrands(options = {}) {
  const { featured } = options;

  return useQuery({
    queryKey: queryKeys.brands.list({ featured }),
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to local data - extract unique brands from products
        const brands = new Set();
        Object.values(localProducts).forEach(category => {
          category.products.forEach(product => {
            if (product.brand) brands.add(product.brand);
          });
        });

        return Array.from(brands).map((name, index) => ({
          id: index + 1,
          name,
          slug: name.toLowerCase().replace(/'/g, '').replace(/\s+/g, '-'),
          featured: ['Leonisa', "L'Bel", 'Esika', 'Yanbal'].includes(name)
        }));
      }

      return fetchBrands({ featured });
    },
    staleTime: 10 * 60 * 1000
  });
}

/**
 * Hook to fetch homepage content
 */
export function useHomepage() {
  return useQuery({
    queryKey: queryKeys.homepage,
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback - return default homepage structure
        const featuredProducts = [];
        const newArrivals = [];

        Object.entries(localProducts).forEach(([slug, data]) => {
          data.products.forEach(p => {
            const product = { ...p, categorySlug: slug, categoryName: data.title };
            if (p.badge === 'New') newArrivals.push(product);
            if (p.badge === 'Bestseller') featuredProducts.push(product);
          });
        });

        return {
          heroSlides: [],
          featuredCategories: Object.entries(localProducts).slice(0, 4).map(([slug, data]) => ({
            name: data.title,
            slug
          })),
          featuredProducts: featuredProducts.slice(0, 8),
          newArrivals: newArrivals.slice(0, 8),
          promoBanner: null
        };
      }

      return fetchHomepage();
    },
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook to fetch a static page
 */
export function usePage(slug) {
  return useQuery({
    queryKey: queryKeys.pages.detail(slug),
    queryFn: () => fetchPage(slug),
    enabled: !!slug && USE_STRAPI,
    staleTime: 10 * 60 * 1000
  });
}

/**
 * Hook to fetch business settings
 */
export function useBusinessSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      if (!USE_STRAPI) {
        // Fallback to hardcoded constants
        return {
          storeName: 'Unistyles Curacao',
          tagline: 'Colombian Beauty & Lingerie',
          currency: 'XCG',
          currencySymbol: 'XCG',
          freeDeliveryThreshold: 80,
          deliveryFee: 10,
          whatsappNumber: '+59996736285'
        };
      }

      return fetchBusinessSettings();
    },
    staleTime: 30 * 60 * 1000 // 30 minutes
  });
}

/**
 * Hook to search products
 */
export function useProductSearch(query, options = {}) {
  const { limit = 20 } = options;

  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: async () => {
      if (!USE_STRAPI || !query) {
        // Fallback to local search
        const allProducts = [];
        Object.entries(localProducts).forEach(([slug, data]) => {
          data.products.forEach(p => {
            allProducts.push({ ...p, categorySlug: slug, categoryName: data.title });
          });
        });

        const searchLower = query.toLowerCase();
        return allProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.ref?.toLowerCase().includes(searchLower) ||
          p.brand?.toLowerCase().includes(searchLower)
        ).slice(0, limit);
      }

      return searchProducts(query, { limit });
    },
    enabled: !!query && query.length >= 2,
    staleTime: 1 * 60 * 1000 // 1 minute for search results
  });
}

/**
 * Hook to prefetch data
 */
export function usePrefetchProducts() {
  const queryClient = useQueryClient();

  const prefetchCategory = (categorySlug) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.list({ category: categorySlug }),
      queryFn: () => fetchProducts({ category: categorySlug })
    });
  };

  const prefetchProduct = (id) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(id),
      queryFn: () => fetchProduct(id)
    });
  };

  return { prefetchCategory, prefetchProduct };
}

export default {
  useProducts,
  useProduct,
  useProductsByCategory,
  useCategories,
  useCategory,
  useBrands,
  useHomepage,
  usePage,
  useBusinessSettings,
  useProductSearch,
  usePrefetchProducts
};
