import { Link } from 'react-router-dom'
import { useState, useMemo, useCallback } from 'react'
import { useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import QuickViewModal from '../components/QuickViewModal'
import { getCategoryHelpUrl } from '../utils/whatsapp'

// Brand options for personal care
const brandOptions = ['All', 'Yanbal', 'Esika']

// Product type detection from product name
function getProductType(product) {
  const name = (product.name || '').toLowerCase()
  if (name.includes('talco') || name.includes('talc')) return 'talcos'
  if (name.includes('mini chic') || name.includes('desenredante')) return 'other'
  return 'deodorants'
}

// Get gender from product data
function getGender(product) {
  // Check Strapi gender field first
  if (product.gender) return product.gender
  // Check local data category field (Men/Women/Unisex) - category can be string or object
  const cat = (typeof product.category === 'string' ? product.category : '').toLowerCase()
  if (cat === 'men') return 'men'
  if (cat === 'women') return 'women'
  if (cat === 'unisex') return 'unisex'
  return 'unisex'
}

function PersonalCare() {
  // State
  const [selectedType, setSelectedType] = useState('all')
  const [selectedGender, setSelectedGender] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('All')
  const [sortBy, setSortBy] = useState('featured')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [visibleCount, setVisibleCount] = useState(12)
  const [wishlist, setWishlist] = useState([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch products
  const { data: productsData, isLoading } = useProductsByCategory('desodorantes')

  // Enrich products with subcategory and gender
  const enrichedProducts = useMemo(() => {
    const products = productsData?.products || []
    return products.map(p => ({
      ...p,
      productType: getProductType(p),
      inferredGender: getGender(p)
    }))
  }, [productsData])

  // Product type counts
  const typeCounts = useMemo(() => {
    const counts = { all: enrichedProducts.length }
    enrichedProducts.forEach(p => {
      counts[p.productType] = (counts[p.productType] || 0) + 1
    })
    return counts
  }, [enrichedProducts])

  // Available type tabs (only show tabs that have products)
  const typeTabs = useMemo(() => {
    const tabs = [{ id: 'all', name: 'All Products' }]
    if (typeCounts['deodorants']) tabs.push({ id: 'deodorants', name: 'Deodorants' })
    if (typeCounts['talcos']) tabs.push({ id: 'talcos', name: 'Talcos' })
    if (typeCounts['other']) tabs.push({ id: 'other', name: 'More' })
    return tabs
  }, [typeCounts])

  // Gender counts
  const genderCounts = useMemo(() => ({
    all: enrichedProducts.length,
    men: enrichedProducts.filter(p => p.inferredGender === 'men').length,
    women: enrichedProducts.filter(p => p.inferredGender === 'women').length,
    unisex: enrichedProducts.filter(p => p.inferredGender === 'unisex').length
  }), [enrichedProducts])

  // Wishlist toggle
  const toggleWishlist = useCallback((e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId])
  }, [])

  // Add to cart
  const handleAddToCart = useCallback((e, product) => {
    e.preventDefault()
    e.stopPropagation()
    cartStore.addItem(product, 1)
  }, [])

  // Filter products
  const filteredProducts = useMemo(() => {
    let products = enrichedProducts

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      products = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        (typeof p.brand === 'object' ? p.brand?.name : p.brand || '').toLowerCase().includes(query)
      )
    }

    // Product type filter
    if (selectedType !== 'all') {
      products = products.filter(p => p.productType === selectedType)
    }

    // Gender filter
    if (selectedGender !== 'all') {
      products = products.filter(p => p.inferredGender === selectedGender)
    }

    // Brand filter
    if (selectedBrand !== 'All') {
      products = products.filter(p => {
        const brandName = typeof p.brand === 'object' ? p.brand?.name : p.brand
        return brandName?.toLowerCase().includes(selectedBrand.toLowerCase())
      })
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        products = [...products].sort((a, b) => a.price - b.price)
        break
      case 'price-high':
        products = [...products].sort((a, b) => b.price - a.price)
        break
      case 'name':
        products = [...products].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'newest':
        products = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
      default:
        break
    }

    return products
  }, [enrichedProducts, selectedType, selectedGender, selectedBrand, sortBy, searchQuery])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Clear all filters
  const clearFilters = () => {
    setSelectedType('all')
    setSelectedGender('all')
    setSelectedBrand('All')
    setSearchQuery('')
  }

  const activeFiltersCount = [
    selectedType !== 'all',
    selectedGender !== 'all',
    selectedBrand !== 'All',
    searchQuery.trim() !== ''
  ].filter(Boolean).length

  // Get format label for product card
  const getFormatLabel = (product) => {
    const name = (product.name || '').toLowerCase()
    if (name.includes('talco') || name.includes('talc')) return 'Talco'
    if (name.includes('mini chic') || name.includes('desenredante')) return 'Desenredante'
    return 'Deodorant'
  }

  // Get gender label for product
  const getGenderLabel = (product) => {
    const g = product.inferredGender
    if (g === 'men') return 'For Him'
    if (g === 'women') return 'For Her'
    return null
  }

  return (
    <div className="pc-page">
      {/* Hero Section */}
      <section className="pc-hero">
        <div className="pc-hero-bg"></div>
        <div className="pc-hero-content">
          <span className="pc-hero-tag">Daily Essentials</span>
          <h1>Personal Care</h1>
          <p>Deodorants, talcos, body sprays & more from Colombia's top brands</p>
        </div>
      </section>

      {/* Main Layout */}
      <div className="pc-container">
        {/* Mobile Filter Toggle */}
        <button className="pc-mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          </svg>
          Filters {activeFiltersCount > 0 && <span className="pc-filter-badge">{activeFiltersCount}</span>}
        </button>

        {/* Sidebar Filters */}
        <aside className={`pc-sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
          <div className="pc-sidebar-backdrop" onClick={() => setMobileFiltersOpen(false)} />
          <div className="pc-sidebar-panel">
            <div className="pc-sidebar-header">
              <h3>Filters</h3>
              <button className="pc-sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <button className="pc-clear-all-btn" onClick={clearFilters}>
                Clear All Filters ({activeFiltersCount})
              </button>
            )}

            {/* Search */}
            <div className="pc-filter-section">
              <div className="pc-search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Product Type Filter */}
            <div className="pc-filter-section">
              <h4>Product Type</h4>
              <div className="pc-filter-options">
                {typeTabs.map(tab => (
                  <label key={tab.id} className="pc-filter-radio">
                    <input
                      type="radio"
                      name="productType"
                      checked={selectedType === tab.id}
                      onChange={() => { setSelectedType(tab.id); setVisibleCount(12) }}
                    />
                    <span className="pc-radio-custom" />
                    <span className="pc-radio-label">{tab.name} ({typeCounts[tab.id] || 0})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Gender Filter */}
            <div className="pc-filter-section">
              <h4>Gender</h4>
              <div className="pc-gender-pills">
                {[
                  { id: 'all', label: 'All', count: genderCounts.all },
                  { id: 'women', label: 'For Her', count: genderCounts.women },
                  { id: 'men', label: 'For Him', count: genderCounts.men },
                  { id: 'unisex', label: 'Unisex', count: genderCounts.unisex }
                ].filter(g => g.count > 0 || g.id === 'all').map(g => (
                  <button
                    key={g.id}
                    className={`pc-gender-pill ${selectedGender === g.id ? 'active' : ''}`}
                    onClick={() => setSelectedGender(g.id)}
                  >
                    {g.label} <span>({g.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="pc-filter-section">
              <h4>Brand</h4>
              <div className="pc-filter-options">
                {brandOptions.map(brand => (
                  <label key={brand} className="pc-filter-radio">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === brand}
                      onChange={() => setSelectedBrand(brand)}
                    />
                    <span className="pc-radio-custom" />
                    <span className="pc-radio-label">{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* WhatsApp Help */}
            <a href={getCategoryHelpUrl('desodorantes')} className="pc-sidebar-help" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Need help? Chat with us</span>
            </a>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="pc-products-main">
          {/* Toolbar */}
          <div className="pc-products-toolbar">
            <p className="pc-product-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </p>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pc-sort-select">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="pc-loading-state">
              <div className="pc-spinner" />
              <p>Loading products...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="pc-empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3>No products found</h3>
              <p>Try adjusting your filters or search query</p>
              <button onClick={clearFilters}>Clear Filters</button>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && filteredProducts.length > 0 && (
            <div className="pc-products-grid">
              {visibleProducts.map(product => {
                const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                const isWishlisted = wishlist.includes(product.id)
                const formatLabel = getFormatLabel(product)
                const genderLabel = getGenderLabel(product)

                return (
                  <article key={product.id} className="pc-product-card">
                    <Link to={`/product/${product.id}`}>
                      <div className="pc-card-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }}
                        />
                        {product.badge && (
                          <span className={`pc-card-badge badge-${product.badge}`}>
                            {product.badge === 'new' ? 'New'
                              : product.badge === 'bestseller' ? 'Bestseller'
                              : product.badge === 'premium' ? 'Premium'
                              : product.badge === 'gift_set' ? 'Gift Set'
                              : product.badge}
                          </span>
                        )}
                        <button
                          className={`pc-wishlist-btn ${isWishlisted ? 'active' : ''}`}
                          onClick={(e) => toggleWishlist(e, product.id)}
                          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        <div className="pc-card-actions">
                          <button
                            className="pc-action-btn"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product) }}
                          >
                            Quick View
                          </button>
                          <button
                            className="pc-action-btn primary"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                      <div className="pc-card-info">
                        {brandName && <span className="pc-card-brand">{brandName}</span>}
                        <h3 className="pc-card-name">{product.name}</h3>
                        <div className="pc-card-meta">
                          <span className="pc-card-format">{formatLabel}</span>
                          {genderLabel && <span className="pc-card-gender">{genderLabel}</span>}
                        </div>
                        <p className="pc-card-price">XCG {typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</p>
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="pc-load-more">
              <button onClick={() => setVisibleCount(prev => prev + 12)}>
                Load More ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Features Bar */}
      <section className="pc-features">
        <div className="pc-features-inner">
          <div className="pc-feature-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <strong>100% Authentic</strong>
              <span>Original Colombian brands</span>
            </div>
          </div>
          <div className="pc-feature-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-1"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <div>
              <strong>Free Delivery</strong>
              <span>Orders over XCG 80</span>
            </div>
          </div>
          <div className="pc-feature-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <strong>Easy Returns</strong>
              <span>7-day return policy</span>
            </div>
          </div>
          <div className="pc-feature-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <strong>Secure Payment</strong>
              <span>Cash, Sentoo, or bank transfer</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />

      <style>{`
        /* ===== Personal Care Page Styles ===== */
        .pc-page {
          --gold: #C5A55A;
          --gold-light: #D4B96E;
          --dark: #1a1a1a;
          --gray-100: #FAF8F5;
          --gray-200: #E6DED8;
          --gray-400: #9B9490;
          --gray-600: #6B6560;
          --success: #1B4D4F;
          background: var(--gray-100);
        }

        /* Hero */
        .pc-hero {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 20px;
          overflow: hidden;
        }
        .pc-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #1F3347 50%, #1B4D4F 100%);
        }
        .pc-hero-content {
          position: relative;
          z-index: 1;
          max-width: 600px;
        }
        .pc-hero-tag {
          display: inline-block;
          color: var(--gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .pc-hero h1 {
          color: white;
          font-size: 44px;
          font-weight: 300;
          letter-spacing: -1px;
          margin: 0 0 12px;
        }
        .pc-hero p {
          color: rgba(255,255,255,0.7);
          font-size: 16px;
          margin: 0 0 28px;
        }

        /* Container */
        .pc-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 20px;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 36px;
        }

        /* Mobile Filter Toggle */
        .pc-mobile-filter-toggle {
          display: none;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 14px 20px;
          background: white;
          border: 1px solid var(--gray-200);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 20px;
        }
        .pc-filter-badge {
          background: var(--gold);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        /* Sidebar */
        .pc-sidebar {
          position: sticky;
          top: 140px;
          height: fit-content;
        }
        .pc-sidebar-backdrop { display: none; }
        .pc-sidebar-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }
        .pc-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--gray-200);
        }
        .pc-sidebar-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .pc-sidebar-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-600);
        }
        .pc-clear-all-btn {
          width: 100%;
          padding: 10px;
          background: var(--gray-100);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          color: var(--gold);
          cursor: pointer;
          margin-bottom: 20px;
        }
        .pc-clear-all-btn:hover {
          background: var(--gray-200);
        }

        /* Filter Sections */
        .pc-filter-section {
          margin-bottom: 24px;
        }
        .pc-filter-section h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gray-600);
          margin: 0 0 12px;
        }
        .pc-search-input-wrap {
          position: relative;
        }
        .pc-search-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-400);
        }
        .pc-search-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .pc-search-input-wrap input:focus {
          outline: none;
          border-color: var(--gold);
        }

        /* Gender Pills */
        .pc-gender-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pc-gender-pill {
          padding: 8px 14px;
          background: var(--gray-100);
          border: 1.5px solid var(--gray-200);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: var(--gray-600);
          cursor: pointer;
          transition: all 0.2s;
        }
        .pc-gender-pill span {
          opacity: 0.6;
          font-size: 11px;
        }
        .pc-gender-pill:hover {
          border-color: var(--dark);
          color: var(--dark);
        }
        .pc-gender-pill.active {
          background: var(--dark);
          border-color: var(--dark);
          color: white;
        }
        .pc-gender-pill.active span {
          opacity: 0.7;
        }

        /* Filter Options */
        .pc-filter-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pc-filter-radio {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          cursor: pointer;
          font-size: 14px;
          color: var(--gray-600);
        }
        .pc-filter-radio input { display: none; }
        .pc-radio-custom {
          width: 16px;
          height: 16px;
          border: 2px solid var(--gray-200);
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .pc-filter-radio input:checked + .pc-radio-custom {
          border-color: var(--gold);
        }
        .pc-filter-radio input:checked + .pc-radio-custom::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 6px;
          height: 6px;
          background: var(--gold);
          border-radius: 50%;
        }
        .pc-filter-radio:hover .pc-radio-label {
          color: var(--dark);
        }

        /* Sidebar Help */
        .pc-sidebar-help {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #F3EDE6;
          border-radius: 10px;
          text-decoration: none;
          color: #1B4D4F;
          font-size: 13px;
          margin-top: 20px;
        }
        .pc-sidebar-help svg {
          color: #1B4D4F;
          flex-shrink: 0;
        }

        /* Products Main */
        .pc-products-main {
          min-height: 600px;
        }
        .pc-products-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .pc-product-count {
          font-size: 14px;
          color: var(--gray-600);
          margin: 0;
        }
        .pc-sort-select {
          padding: 10px 36px 10px 14px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
          cursor: pointer;
          appearance: none;
        }

        /* Loading & Empty States */
        .pc-loading-state, .pc-empty-state {
          text-align: center;
          padding: 80px 20px;
        }
        .pc-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--gray-200);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: pc-spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes pc-spin { to { transform: rotate(360deg); } }
        .pc-empty-state svg {
          color: var(--gray-200);
          margin-bottom: 16px;
        }
        .pc-empty-state h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .pc-empty-state p {
          color: var(--gray-600);
          margin: 0 0 20px;
        }
        .pc-empty-state button {
          padding: 12px 28px;
          background: var(--gold);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Products Grid */
        .pc-products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .pc-product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .pc-product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .pc-product-card a {
          text-decoration: none;
          color: inherit;
        }

        /* Card Media */
        .pc-card-media {
          position: relative;
          padding-top: 110%;
          background: linear-gradient(to bottom, var(--gray-100), white);
        }
        .pc-card-media img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 70%;
          max-height: 70%;
          object-fit: contain;
          transition: transform 0.4s;
        }
        .pc-product-card:hover .pc-card-media img {
          transform: translate(-50%, -50%) scale(1.05);
        }
        .pc-card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 4px 10px;
          background: var(--dark);
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px;
        }
        .pc-card-badge.badge-bestseller {
          background: var(--gold);
          color: var(--dark);
        }
        .pc-card-badge.badge-new {
          background: var(--success);
        }
        .pc-card-badge.badge-premium {
          background: linear-gradient(135deg, #1F3347, #1B4D4F);
        }
        .pc-card-badge.badge-gift_set {
          background: #C5A55A;
        }

        /* Wishlist */
        .pc-wishlist-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          background: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-400);
          transition: all 0.2s;
          z-index: 5;
        }
        .pc-wishlist-btn:hover, .pc-wishlist-btn.active {
          color: #A4443A;
        }

        /* Card Actions */
        .pc-card-actions {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px;
          background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
          display: flex;
          flex-direction: column;
          gap: 8px;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.3s;
        }
        .pc-product-card:hover .pc-card-actions {
          opacity: 1;
          transform: translateY(0);
        }
        .pc-action-btn {
          padding: 12px;
          background: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pc-action-btn.primary {
          background: var(--gold);
          color: white;
        }

        /* Card Info */
        .pc-card-info {
          padding: 18px;
          text-align: center;
        }
        .pc-card-brand {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .pc-card-name {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 8px;
          min-height: 40px;
          line-height: 1.4;
          color: var(--dark);
        }
        .pc-card-meta {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .pc-card-format {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--gold);
          background: #FAF8F5;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .pc-card-gender {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--gray-400);
        }
        .pc-card-price {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--dark);
        }

        /* Load More */
        .pc-load-more {
          text-align: center;
          margin-top: 40px;
        }
        .pc-load-more button {
          padding: 14px 40px;
          background: transparent;
          border: 2px solid var(--dark);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pc-load-more button:hover {
          background: var(--dark);
          color: white;
        }

        /* Features Bar */
        .pc-features {
          background: var(--dark);
          padding: 40px 20px;
          margin-top: 60px;
        }
        .pc-features-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
        }
        .pc-feature-item {
          display: flex;
          align-items: center;
          gap: 14px;
          color: white;
        }
        .pc-feature-item svg {
          color: var(--gold);
          flex-shrink: 0;
        }
        .pc-feature-item strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .pc-feature-item span {
          font-size: 11px;
          opacity: 0.6;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .pc-products-grid { grid-template-columns: repeat(2, 1fr); }
          .pc-features-inner { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 900px) {
          .pc-container { grid-template-columns: 1fr; }
          .pc-mobile-filter-toggle { display: flex; }

          .pc-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            pointer-events: none;
          }
          .pc-sidebar.open { pointer-events: auto; }
          .pc-sidebar-backdrop {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .pc-sidebar.open .pc-sidebar-backdrop { opacity: 1; }
          .pc-sidebar-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 320px;
            max-width: 85vw;
            transform: translateX(100%);
            transition: transform 0.3s;
            overflow-y: auto;
            border-radius: 0;
          }
          .pc-sidebar.open .pc-sidebar-panel { transform: translateX(0); }
          .pc-sidebar-close { display: flex; }

          .pc-type-nav-inner {
            justify-content: flex-start;
            padding: 10px 16px;
          }
        }

        @media (max-width: 640px) {
          .pc-hero h1 { font-size: 32px; }
          .pc-hero p { font-size: 14px; }

          .pc-products-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .pc-card-media { padding-top: 120%; }
          .pc-card-info { padding: 12px; }
          .pc-card-name { font-size: 12px; min-height: 34px; }
          .pc-card-price { font-size: 14px; }
          .pc-card-actions { display: none; }

          .pc-features-inner {
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .pc-feature-item strong { font-size: 12px; }
        }
      `}</style>
    </div>
  )
}

export default PersonalCare
