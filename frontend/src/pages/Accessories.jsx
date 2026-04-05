import { Link } from 'react-router-dom'
import { useState, useMemo, useCallback } from 'react'
import { useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import QuickViewModal from '../components/QuickViewModal'
import { getCategoryHelpUrl } from '../utils/whatsapp'

// Category tab config
const typeConfig = {
  all: { label: 'All', icon: '✦' },
  Necklaces: { label: 'Necklaces', icon: '◇' },
  Earrings: { label: 'Earrings', icon: '◈' },
  Bracelets: { label: 'Bracelets', icon: '○' },
  Rings: { label: 'Rings', icon: '◎' },
  Sets: { label: 'Sets', icon: '❖' }
}

const materialOptions = ['Gold', 'Silver', 'Rose Gold', 'Crystal', 'Pearl']

const occasionOptions = [
  { id: 'everyday', label: 'Everyday', icon: '☀' },
  { id: 'gift', label: 'Gift-Giving', icon: '🎁' },
  { id: 'special', label: 'Special Occasion', icon: '✨' },
  { id: 'layering', label: 'Layering', icon: '◇◇' }
]

// Infer jewelry type from product name/ref
function getJewelryType(product) {
  const name = (product.name || '').toLowerCase()
  const ref = (product.ref || '').toLowerCase()
  if (name.includes('necklace') || name.includes('choker') || ref.includes('collar')) return 'Necklaces'
  if (name.includes('earring') || ref.includes('aretes')) return 'Earrings'
  if (name.includes('bracelet') || ref.includes('pulsera')) return 'Bracelets'
  if (name.includes('ring') || ref.includes('anillo')) return 'Rings'
  if (name.includes('set') || ref.includes('set')) return 'Sets'
  return 'Jewelry'
}

// Get material from product
function getMaterial(product) {
  return product.material || 'Gold'
}

// Infer occasion from product
function getOccasion(product) {
  const name = (product.name || '').toLowerCase()
  if (name.includes('set') || name.includes('gift')) return 'gift'
  if (name.includes('tennis') || name.includes('chandelier') || name.includes('crystal')) return 'special'
  if (name.includes('layered') || name.includes('station') || name.includes('chain')) return 'layering'
  return 'everyday'
}

function Accessories() {
  const [selectedType, setSelectedType] = useState('all')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [selectedOccasion, setSelectedOccasion] = useState('all')
  const [priceRange, setPriceRange] = useState([0, 100])
  const [sortBy, setSortBy] = useState('featured')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [visibleCount, setVisibleCount] = useState(12)
  const [wishlist, setWishlist] = useState([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch products
  const { data: productsData, isLoading } = useProductsByCategory('accesorios')

  // Enrich products
  const enrichedProducts = useMemo(() => {
    const products = productsData?.products || []
    return products.map(p => ({
      ...p,
      inferredType: getJewelryType(p),
      inferredMaterial: getMaterial(p),
      inferredOccasion: getOccasion(p)
    }))
  }, [productsData])

  // Price bounds
  const priceBounds = useMemo(() => {
    if (enrichedProducts.length === 0) return { min: 0, max: 100 }
    const prices = enrichedProducts.map(p => p.price)
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
  }, [enrichedProducts])

  // Type counts
  const typeCounts = useMemo(() => {
    const counts = { all: enrichedProducts.length }
    enrichedProducts.forEach(p => {
      counts[p.inferredType] = (counts[p.inferredType] || 0) + 1
    })
    return counts
  }, [enrichedProducts])

  // Material counts
  const materialCounts = useMemo(() => {
    const counts = {}
    enrichedProducts.forEach(p => {
      const mat = p.inferredMaterial
      counts[mat] = (counts[mat] || 0) + 1
    })
    return counts
  }, [enrichedProducts])

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

  // Toggle material filter
  const toggleMaterial = useCallback((material) => {
    setSelectedMaterials(prev =>
      prev.includes(material) ? prev.filter(m => m !== material) : [...prev, material]
    )
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
        (p.ref || '').toLowerCase().includes(query)
      )
    }

    // Type filter
    if (selectedType !== 'all') {
      products = products.filter(p => p.inferredType === selectedType)
    }

    // Material filter
    if (selectedMaterials.length > 0) {
      products = products.filter(p => selectedMaterials.includes(p.inferredMaterial))
    }

    // Occasion filter
    if (selectedOccasion !== 'all') {
      products = products.filter(p => p.inferredOccasion === selectedOccasion)
    }

    // Price range filter
    products = products.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])

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
  }, [enrichedProducts, selectedType, selectedMaterials, selectedOccasion, priceRange, sortBy, searchQuery])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Active filters for chips
  const activeFilters = useMemo(() => {
    const filters = []
    if (selectedType !== 'all') filters.push({ key: 'type', label: selectedType, clear: () => setSelectedType('all') })
    selectedMaterials.forEach(m => filters.push({ key: `mat-${m}`, label: m, clear: () => setSelectedMaterials(prev => prev.filter(x => x !== m)) }))
    if (selectedOccasion !== 'all') {
      const occ = occasionOptions.find(o => o.id === selectedOccasion)
      filters.push({ key: 'occasion', label: occ?.label || selectedOccasion, clear: () => setSelectedOccasion('all') })
    }
    if (priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max) {
      filters.push({ key: 'price', label: `XCG ${priceRange[0]} - ${priceRange[1]}`, clear: () => setPriceRange([priceBounds.min, priceBounds.max]) })
    }
    if (searchQuery.trim()) filters.push({ key: 'search', label: `"${searchQuery}"`, clear: () => setSearchQuery('') })
    return filters
  }, [selectedType, selectedMaterials, selectedOccasion, priceRange, priceBounds, searchQuery])

  // Clear all filters
  const clearFilters = () => {
    setSelectedType('all')
    setSelectedMaterials([])
    setSelectedOccasion('all')
    setPriceRange([priceBounds.min, priceBounds.max])
    setSearchQuery('')
  }

  // Star rating
  const renderStars = (rating = 4.5) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars.push(<span key={i} className="acc-star filled">★</span>)
      } else if (i === Math.ceil(rating) && rating % 1 >= 0.3) {
        stars.push(<span key={i} className="acc-star half">★</span>)
      } else {
        stars.push(<span key={i} className="acc-star">★</span>)
      }
    }
    return stars
  }

  return (
    <div className="acc-page">
      {/* Breadcrumb */}
      <nav className="acc-breadcrumb">
        <div className="acc-breadcrumb-inner">
          <Link to="/">Home</Link>
          <span>/</span>
          <span className="acc-breadcrumb-current">Accessories & Jewelry</span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="acc-hero">
        <div className="acc-hero-bg"></div>
        <div className="acc-hero-overlay"></div>
        <div className="acc-hero-content">
          <span className="acc-hero-tag">Colombian Artisan Collection</span>
          <h1>Elegant Jewelry</h1>
          <p>Handcrafted necklaces, earrings, bracelets & rings. Timeless pieces that tell your story.</p>
          <div className="acc-hero-stats">
            <div className="acc-hero-stat">
              <strong>{enrichedProducts.length}+</strong>
              <span>Unique Pieces</span>
            </div>
            <div className="acc-hero-stat-divider"></div>
            <div className="acc-hero-stat">
              <strong>100%</strong>
              <span>Authentic</span>
            </div>
            <div className="acc-hero-stat-divider"></div>
            <div className="acc-hero-stat">
              <strong>7-Day</strong>
              <span>Easy Returns</span>
            </div>
          </div>
          <button className="acc-hero-cta" onClick={() => {
            document.querySelector('.acc-container')?.scrollIntoView({ behavior: 'smooth' })
          }}>
            Shop Collection
          </button>
        </div>
      </section>

      {/* Trust Banner */}
      <div className="acc-trust-banner">
        <div className="acc-trust-banner-inner">
          <span>Free Shipping over XCG 80</span>
          <span className="acc-trust-banner-dot"></span>
          <span>7-Day Easy Returns</span>
          <span className="acc-trust-banner-dot"></span>
          <span>Quality Guaranteed</span>
          <span className="acc-trust-banner-dot"></span>
          <span>Secure Checkout</span>
        </div>
      </div>

      {/* Category Nav Tabs */}
      <nav className="acc-concern-nav">
        <div className="acc-concern-nav-inner">
          {Object.entries(typeConfig).map(([id, config]) => (
            <button
              key={id}
              className={`acc-concern-tab ${selectedType === id ? 'active' : ''}`}
              onClick={() => { setSelectedType(id); setVisibleCount(12) }}
            >
              <span className="acc-tab-icon">{config.icon}</span>
              <span>{config.label}</span>
              <span className="acc-concern-count">({typeCounts[id] || 0})</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Layout */}
      <div className="acc-container">
        {/* Mobile Filter Toggle */}
        <button className="acc-mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          </svg>
          Filters {activeFilters.length > 0 && <span className="acc-filter-badge">{activeFilters.length}</span>}
        </button>

        {/* Sidebar Filters */}
        <aside className={`acc-sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
          <div className="acc-sidebar-backdrop" onClick={() => setMobileFiltersOpen(false)} />
          <div className="acc-sidebar-panel">
            <div className="acc-sidebar-header">
              <h3>Filters</h3>
              <button className="acc-sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeFilters.length > 0 && (
              <button className="acc-clear-all-btn" onClick={clearFilters}>
                Clear All Filters ({activeFilters.length})
              </button>
            )}

            {/* Search */}
            <div className="acc-filter-section">
              <div className="acc-search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search jewelry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Jewelry Type */}
            <div className="acc-filter-section">
              <h4>Jewelry Type</h4>
              <div className="acc-filter-options">
                {Object.entries(typeConfig).filter(([id]) => id !== 'all').map(([id, config]) => (
                  <label key={id} className="acc-filter-check">
                    <input
                      type="checkbox"
                      checked={selectedType === id}
                      onChange={() => setSelectedType(selectedType === id ? 'all' : id)}
                    />
                    <span className="acc-check-custom">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="acc-check-label">{config.label}</span>
                    <span className="acc-check-count">{typeCounts[id] || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Material */}
            <div className="acc-filter-section">
              <h4>Material</h4>
              <div className="acc-material-grid">
                {materialOptions.map(mat => (
                  <button
                    key={mat}
                    className={`acc-material-btn ${selectedMaterials.includes(mat) ? 'active' : ''}`}
                    onClick={() => toggleMaterial(mat)}
                  >
                    <span className={`acc-material-swatch swatch-${mat.toLowerCase().replace(' ', '-')}`}></span>
                    <span>{mat}</span>
                    {materialCounts[mat] && <span className="acc-material-count">{materialCounts[mat]}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Occasion */}
            <div className="acc-filter-section">
              <h4>Shop by Occasion</h4>
              <div className="acc-occasion-grid">
                {occasionOptions.map(occ => (
                  <button
                    key={occ.id}
                    className={`acc-occasion-btn ${selectedOccasion === occ.id ? 'active' : ''}`}
                    onClick={() => setSelectedOccasion(selectedOccasion === occ.id ? 'all' : occ.id)}
                  >
                    <span className="acc-occasion-icon">{occ.icon}</span>
                    <span>{occ.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Slider */}
            <div className="acc-filter-section">
              <h4>Price Range</h4>
              <div className="acc-price-display">
                <span>XCG {priceRange[0]}</span>
                <span>XCG {priceRange[1]}</span>
              </div>
              <div className="acc-price-slider-wrap">
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Math.min(Number(e.target.value), priceRange[1] - 1), priceRange[1]])}
                  className="acc-range-input"
                />
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0] + 1)])}
                  className="acc-range-input"
                />
                <div className="acc-range-track">
                  <div
                    className="acc-range-fill"
                    style={{
                      left: `${((priceRange[0] - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%`,
                      right: `${100 - ((priceRange[1] - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <div className="acc-price-presets">
                <button onClick={() => setPriceRange([priceBounds.min, 25])} className={priceRange[1] === 25 ? 'active' : ''}>Under XCG 25</button>
                <button onClick={() => setPriceRange([25, 40])} className={priceRange[0] === 25 && priceRange[1] === 40 ? 'active' : ''}>XCG 25-40</button>
                <button onClick={() => setPriceRange([40, priceBounds.max])} className={priceRange[0] === 40 ? 'active' : ''}>Over XCG 40</button>
              </div>
            </div>

            {/* Gift Finder CTA */}
            <div className="acc-sidebar-gift">
              <div className="acc-gift-icon">🎁</div>
              <h4>Looking for a Gift?</h4>
              <p>Our sets make the perfect present for any occasion</p>
              <button onClick={() => { setSelectedType('Sets'); setVisibleCount(12); setMobileFiltersOpen(false) }}>
                Shop Gift Sets
              </button>
            </div>

            {/* WhatsApp Help */}
            <a href={getCategoryHelpUrl('accesorios')} className="acc-sidebar-help" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <strong>Need help choosing?</strong>
                <span>Chat with us on WhatsApp</span>
              </div>
            </a>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="acc-products-main">
          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="acc-filter-chips">
              {activeFilters.map(f => (
                <button key={f.key} className="acc-chip" onClick={f.clear}>
                  {f.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ))}
              <button className="acc-chip-clear" onClick={clearFilters}>Clear all</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="acc-products-toolbar">
            <p className="acc-product-count">
              <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'piece' : 'pieces'} found
            </p>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="acc-sort-select">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="acc-loading-state">
              <div className="acc-spinner" />
              <p>Loading collection...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="acc-empty-state">
              <div className="acc-empty-icon">✦</div>
              <h3>No pieces match your filters</h3>
              <p>Try adjusting your filters or browse our full collection</p>
              <button onClick={clearFilters}>View All Jewelry</button>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && filteredProducts.length > 0 && (
            <div className="acc-products-grid">
              {visibleProducts.map(product => {
                const isWishlisted = wishlist.includes(product.id)
                const typeLabel = getJewelryType(product)
                const materialLabel = getMaterial(product)
                const rating = 4.3 + (product.id % 7) * 0.1

                return (
                  <article key={product.id} className="acc-product-card">
                    <Link to={`/product/${product.id}`}>
                      <div className="acc-card-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }}
                        />
                        {product.badge && (
                          <span className={`acc-card-badge badge-${typeof product.badge === 'string' ? product.badge.toLowerCase().replace(/[^a-z0-9]/g, '_') : product.badge}`}>
                            {product.badge}
                          </span>
                        )}
                        <button
                          className={`acc-wishlist-btn ${isWishlisted ? 'active' : ''}`}
                          onClick={(e) => toggleWishlist(e, product.id)}
                          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        <div className="acc-card-actions">
                          <button
                            className="acc-action-btn"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product) }}
                          >
                            Quick View
                          </button>
                          <button
                            className="acc-action-btn primary"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                      <div className="acc-card-info">
                        <div className="acc-card-meta">
                          <span className="acc-card-type">{typeLabel}</span>
                          <span className="acc-card-material">{materialLabel}</span>
                        </div>
                        <h3 className="acc-card-name">{product.name}</h3>
                        <div className="acc-card-rating">
                          <div className="acc-stars">{renderStars(rating)}</div>
                          <span className="acc-rating-count">({Math.floor(10 + (product.id % 40))})</span>
                        </div>
                        <div className="acc-card-price-row">
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="acc-price-old">XCG {product.compareAtPrice.toFixed(2)}</span>
                          )}
                          <span className="acc-card-price">XCG {typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="acc-load-more">
              <button onClick={() => setVisibleCount(prev => prev + 12)}>
                Show More Pieces
                <span className="acc-load-more-sub">({filteredProducts.length - visibleCount} remaining)</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Trust Badges */}
      <section className="acc-trust">
        <div className="acc-trust-inner">
          <div className="acc-trust-item">
            <div className="acc-trust-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <strong>Handcrafted Quality</strong>
              <span>Each piece made with care</span>
            </div>
          </div>
          <div className="acc-trust-item">
            <div className="acc-trust-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <strong>Quality Guaranteed</strong>
              <span>Premium materials only</span>
            </div>
          </div>
          <div className="acc-trust-item">
            <div className="acc-trust-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div>
              <strong>Gift Ready</strong>
              <span>Perfect for any occasion</span>
            </div>
          </div>
          <div className="acc-trust-item">
            <div className="acc-trust-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <div>
              <strong>Free Delivery</strong>
              <span>On orders over XCG 80</span>
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
        /* ===== Accessories & Jewelry Page ===== */
        .acc-page {
          --gold: #C5A55A;
          --gold-light: #D4B96E;
          --gold-dark: #A88B3D;
          --dark: #1a1a1a;
          --acc-accent: #1B4D4F;
          --acc-accent-light: #F3EDE6;
          --warm-bg: #FAF8F5;
          --warm-100: #F3EDE6;
          --warm-200: #E6DED8;
          --warm-300: #D1C7BD;
          --warm-400: #9B9490;
          --warm-500: #7A746F;
          --warm-600: #6B6560;
          --success: #3D7A5F;
          background: var(--warm-bg);
        }

        /* Breadcrumb */
        .acc-breadcrumb {
          background: white;
          border-bottom: 1px solid var(--warm-200);
          padding: 12px 0;
        }
        .acc-breadcrumb-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 20px;
          font-size: 13px;
          color: var(--warm-400);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .acc-breadcrumb a { color: var(--warm-400); text-decoration: none; }
        .acc-breadcrumb a:hover { color: var(--dark); }
        .acc-breadcrumb-current { color: var(--dark); font-weight: 500; }

        /* Hero */
        .acc-hero {
          position: relative;
          min-height: 360px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 20px;
          overflow: hidden;
        }
        .acc-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #2C1810 40%, #3D2B1F 70%, #5C4033 100%);
        }
        .acc-hero-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 30% 50%, rgba(197,165,90,0.15) 0%, transparent 70%);
        }
        .acc-hero-content {
          position: relative;
          z-index: 1;
          max-width: 650px;
        }
        .acc-hero-tag {
          display: inline-block;
          color: var(--gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
          padding: 6px 16px;
          border: 1px solid rgba(197,165,90,0.3);
          border-radius: 20px;
        }
        .acc-hero h1 {
          color: white;
          font-size: 48px;
          font-weight: 300;
          letter-spacing: -1px;
          margin: 0 0 12px;
        }
        .acc-hero p {
          color: rgba(255,255,255,0.65);
          font-size: 16px;
          margin: 0 0 28px;
          line-height: 1.6;
        }
        .acc-hero-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          margin-bottom: 32px;
        }
        .acc-hero-stat { text-align: center; }
        .acc-hero-stat strong {
          display: block;
          color: var(--gold);
          font-size: 20px;
          font-weight: 600;
        }
        .acc-hero-stat span {
          color: rgba(255,255,255,0.5);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .acc-hero-stat-divider {
          width: 1px;
          height: 36px;
          background: rgba(255,255,255,0.15);
        }
        .acc-hero-cta {
          padding: 14px 36px;
          background: var(--gold);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
        }
        .acc-hero-cta:hover { background: var(--gold-light); transform: translateY(-1px); }

        /* Trust Banner */
        .acc-trust-banner {
          background: var(--acc-accent);
          color: white;
          padding: 10px 20px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        .acc-trust-banner-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .acc-trust-banner-dot {
          width: 3px;
          height: 3px;
          background: rgba(255,255,255,0.4);
          border-radius: 50%;
        }

        /* Category Nav */
        .acc-concern-nav {
          background: white;
          border-bottom: 1px solid var(--warm-200);
          position: sticky;
          top: 70px;
          z-index: 80;
        }
        .acc-concern-nav-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          gap: 4px;
          padding: 10px 20px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .acc-concern-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: none;
          border: 1.5px solid transparent;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          color: var(--warm-600);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .acc-tab-icon { font-size: 11px; opacity: 0.7; }
        .acc-concern-tab:hover { border-color: var(--warm-200); color: var(--dark); }
        .acc-concern-tab.active {
          background: var(--acc-accent);
          border-color: var(--acc-accent);
          color: white;
        }
        .acc-concern-tab.active .acc-tab-icon { opacity: 1; }
        .acc-concern-count { font-size: 11px; opacity: 0.6; }

        /* Container */
        .acc-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 20px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 36px;
        }

        /* Mobile Filter Toggle */
        .acc-mobile-filter-toggle {
          display: none;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 14px 20px;
          background: white;
          border: 1px solid var(--warm-200);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 20px;
        }
        .acc-filter-badge {
          background: var(--acc-accent);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        /* Sidebar */
        .acc-sidebar {
          position: sticky;
          top: 140px;
          height: fit-content;
          max-height: calc(100vh - 160px);
          overflow-y: auto;
        }
        .acc-sidebar-backdrop { display: none; }
        .acc-sidebar-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }
        .acc-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--warm-200);
        }
        .acc-sidebar-header h3 { font-size: 16px; font-weight: 600; margin: 0; }
        .acc-sidebar-close { display: none; background: none; border: none; cursor: pointer; color: var(--warm-600); }
        .acc-clear-all-btn {
          width: 100%;
          padding: 10px;
          background: var(--warm-bg);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          color: var(--acc-accent);
          cursor: pointer;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .acc-clear-all-btn:hover { background: var(--warm-200); }

        /* Filter Sections */
        .acc-filter-section { margin-bottom: 24px; }
        .acc-filter-section h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--warm-500);
          margin: 0 0 12px;
        }
        .acc-search-input-wrap { position: relative; }
        .acc-search-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--warm-400);
        }
        .acc-search-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--warm-200);
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .acc-search-input-wrap input:focus { outline: none; border-color: var(--acc-accent); }
        .acc-filter-options { display: flex; flex-direction: column; gap: 4px; }

        /* Checkbox Filter */
        .acc-filter-check {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 14px;
          color: var(--warm-600);
          border-radius: 6px;
          transition: background 0.15s;
        }
        .acc-filter-check:hover { background: var(--warm-bg); color: var(--dark); }
        .acc-filter-check input { display: none; }
        .acc-check-custom {
          width: 18px;
          height: 18px;
          border: 2px solid var(--warm-300);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .acc-check-custom svg { opacity: 0; color: white; transition: opacity 0.15s; }
        .acc-filter-check input:checked + .acc-check-custom {
          background: var(--acc-accent);
          border-color: var(--acc-accent);
        }
        .acc-filter-check input:checked + .acc-check-custom svg { opacity: 1; }
        .acc-check-label { flex: 1; }
        .acc-check-count { font-size: 12px; color: var(--warm-400); }

        /* Material Filter */
        .acc-material-grid { display: flex; flex-direction: column; gap: 4px; }
        .acc-material-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: none;
          border: 1.5px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: var(--warm-600);
          transition: all 0.15s;
          text-align: left;
        }
        .acc-material-btn:hover { background: var(--warm-bg); color: var(--dark); }
        .acc-material-btn.active { border-color: var(--acc-accent); background: var(--acc-accent-light); color: var(--acc-accent); font-weight: 500; }
        .acc-material-swatch {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--warm-200);
          flex-shrink: 0;
        }
        .swatch-gold { background: linear-gradient(135deg, #C5A55A, #E8D4A0); border-color: #C5A55A; }
        .swatch-silver { background: linear-gradient(135deg, #C0C0C0, #E8E8E8); border-color: #B8B8B8; }
        .swatch-rose-gold { background: linear-gradient(135deg, #B76E79, #E8B4B8); border-color: #B76E79; }
        .swatch-crystal { background: linear-gradient(135deg, #E0F0FF, #FFFFFF); border-color: #B0D0E8; }
        .swatch-pearl { background: linear-gradient(135deg, #F5F0E8, #FFFFFF); border-color: #E0D8C8; }
        .acc-material-count { margin-left: auto; font-size: 11px; color: var(--warm-400); }

        /* Occasion Filter */
        .acc-occasion-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .acc-occasion-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: var(--warm-bg);
          border: 1.5px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          color: var(--warm-600);
          transition: all 0.15s;
        }
        .acc-occasion-btn:hover { border-color: var(--warm-300); color: var(--dark); }
        .acc-occasion-btn.active { border-color: var(--acc-accent); background: var(--acc-accent-light); color: var(--acc-accent); }
        .acc-occasion-icon { font-size: 18px; }

        /* Price Range Slider */
        .acc-price-display {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          color: var(--dark);
          margin-bottom: 12px;
        }
        .acc-price-slider-wrap {
          position: relative;
          height: 24px;
          margin-bottom: 12px;
        }
        .acc-range-input {
          position: absolute;
          width: 100%;
          height: 24px;
          background: none;
          pointer-events: none;
          appearance: none;
          -webkit-appearance: none;
          top: 0;
          left: 0;
          margin: 0;
          z-index: 2;
        }
        .acc-range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: white;
          border: 2px solid var(--acc-accent);
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .acc-range-input::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: white;
          border: 2px solid var(--acc-accent);
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .acc-range-track {
          position: absolute;
          top: 10px;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--warm-200);
          border-radius: 2px;
        }
        .acc-range-fill {
          position: absolute;
          height: 100%;
          background: var(--acc-accent);
          border-radius: 2px;
        }
        .acc-price-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .acc-price-presets button {
          padding: 5px 10px;
          font-size: 11px;
          background: var(--warm-bg);
          border: 1px solid var(--warm-200);
          border-radius: 14px;
          cursor: pointer;
          color: var(--warm-600);
          transition: all 0.15s;
        }
        .acc-price-presets button:hover { border-color: var(--warm-300); }
        .acc-price-presets button.active { background: var(--acc-accent-light); border-color: var(--acc-accent); color: var(--acc-accent); }

        /* Gift Finder CTA */
        .acc-sidebar-gift {
          text-align: center;
          padding: 20px 16px;
          background: linear-gradient(135deg, #FDF8F0, #F3EDE6);
          border-radius: 10px;
          margin-bottom: 16px;
          border: 1px solid var(--warm-200);
        }
        .acc-gift-icon { font-size: 28px; margin-bottom: 8px; }
        .acc-sidebar-gift h4 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--dark); }
        .acc-sidebar-gift p { font-size: 12px; color: var(--warm-500); margin: 0 0 12px; line-height: 1.4; }
        .acc-sidebar-gift button {
          padding: 9px 20px;
          background: var(--gold);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .acc-sidebar-gift button:hover { background: var(--gold-dark); }

        /* Sidebar Help */
        .acc-sidebar-help {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: var(--warm-100);
          border-radius: 10px;
          text-decoration: none;
          color: var(--dark);
          font-size: 13px;
          transition: background 0.15s;
          border: 1px solid var(--warm-200);
        }
        .acc-sidebar-help:hover { background: var(--warm-200); }
        .acc-sidebar-help svg { color: var(--acc-accent); flex-shrink: 0; }
        .acc-sidebar-help strong { display: block; font-size: 13px; }
        .acc-sidebar-help span { font-size: 11px; color: var(--warm-500); }

        /* Filter Chips */
        .acc-filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
          align-items: center;
        }
        .acc-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--acc-accent-light);
          border: 1px solid var(--acc-accent);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: var(--acc-accent);
          cursor: pointer;
          transition: all 0.15s;
        }
        .acc-chip:hover { background: var(--acc-accent); color: white; }
        .acc-chip:hover svg { stroke: white; }
        .acc-chip-clear {
          background: none;
          border: none;
          font-size: 12px;
          color: var(--warm-400);
          cursor: pointer;
          text-decoration: underline;
          padding: 6px 4px;
        }
        .acc-chip-clear:hover { color: var(--dark); }

        /* Products Main */
        .acc-products-main { min-height: 600px; }
        .acc-products-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .acc-product-count { font-size: 14px; color: var(--warm-500); margin: 0; }
        .acc-product-count strong { color: var(--dark); }
        .acc-sort-select {
          padding: 10px 36px 10px 14px;
          border: 1px solid var(--warm-200);
          border-radius: 6px;
          font-size: 13px;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
          cursor: pointer;
          appearance: none;
        }

        /* Loading & Empty States */
        .acc-loading-state, .acc-empty-state { text-align: center; padding: 80px 20px; }
        .acc-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--warm-200);
          border-top-color: var(--acc-accent);
          border-radius: 50%;
          animation: acc-spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes acc-spin { to { transform: rotate(360deg); } }
        .acc-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .acc-empty-state h3 { margin: 0 0 8px; font-size: 18px; }
        .acc-empty-state p { color: var(--warm-500); margin: 0 0 20px; }
        .acc-empty-state button {
          padding: 12px 28px;
          background: var(--acc-accent);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        /* Products Grid */
        .acc-products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .acc-product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .acc-product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .acc-product-card a { text-decoration: none; color: inherit; }

        /* Card Media */
        .acc-card-media {
          position: relative;
          padding-top: 110%;
          background: linear-gradient(to bottom, #F8F6F3, white);
        }
        .acc-card-media img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 75%;
          max-height: 75%;
          object-fit: contain;
          transition: transform 0.4s;
        }
        .acc-product-card:hover .acc-card-media img {
          transform: translate(-50%, -50%) scale(1.06);
        }
        .acc-card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 4px 10px;
          background: var(--acc-accent);
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px;
        }
        .acc-card-badge.badge-bestseller { background: var(--gold); color: var(--dark); }
        .acc-card-badge.badge-new { background: var(--success); }
        .acc-card-badge.badge-gift_set { background: #8B5E3C; }

        /* Wishlist */
        .acc-wishlist-btn {
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
          color: var(--warm-400);
          transition: all 0.2s;
          z-index: 5;
        }
        .acc-wishlist-btn:hover, .acc-wishlist-btn.active { color: #C0392B; }

        /* Card Actions */
        .acc-card-actions {
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
        .acc-product-card:hover .acc-card-actions { opacity: 1; transform: translateY(0); }
        .acc-action-btn {
          padding: 12px;
          background: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .acc-action-btn.primary { background: var(--acc-accent); color: white; }
        .acc-action-btn.primary:hover { background: #24635F; }

        /* Card Info */
        .acc-card-info { padding: 16px 18px 18px; }
        .acc-card-meta {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .acc-card-type {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--acc-accent);
          background: var(--acc-accent-light);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .acc-card-material {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #8B6914;
          background: #FDF5E6;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .acc-card-name {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 8px;
          min-height: 40px;
          line-height: 1.4;
          color: var(--dark);
        }

        /* Star Rating */
        .acc-card-rating {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .acc-stars { display: flex; gap: 1px; }
        .acc-star { color: var(--warm-300); font-size: 13px; line-height: 1; }
        .acc-star.filled { color: var(--gold); }
        .acc-star.half {
          background: linear-gradient(90deg, var(--gold) 50%, var(--warm-300) 50%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .acc-rating-count { font-size: 11px; color: var(--warm-400); }

        /* Price */
        .acc-card-price-row { display: flex; align-items: center; gap: 8px; }
        .acc-price-old {
          font-size: 13px;
          color: var(--warm-400);
          text-decoration: line-through;
        }
        .acc-card-price {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--dark);
        }

        /* Load More */
        .acc-load-more { text-align: center; margin-top: 40px; }
        .acc-load-more button {
          padding: 14px 40px;
          background: transparent;
          border: 2px solid var(--dark);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .acc-load-more button:hover { background: var(--dark); color: white; }
        .acc-load-more-sub { display: block; font-size: 11px; color: var(--warm-400); margin-top: 2px; font-weight: 400; }

        /* Trust Badges */
        .acc-trust {
          background: var(--dark);
          padding: 48px 20px;
          margin-top: 48px;
        }
        .acc-trust-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
        }
        .acc-trust-item {
          display: flex;
          align-items: center;
          gap: 14px;
          color: white;
        }
        .acc-trust-icon {
          width: 48px;
          height: 48px;
          background: rgba(197,165,90,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .acc-trust-icon svg { stroke: var(--gold); }
        .acc-trust-item strong { display: block; font-size: 13px; font-weight: 600; margin-bottom: 2px; }
        .acc-trust-item span { font-size: 11px; opacity: 0.6; }

        /* Responsive */
        @media (max-width: 1100px) {
          .acc-products-grid { grid-template-columns: repeat(2, 1fr); }
          .acc-trust-inner { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 900px) {
          .acc-container { grid-template-columns: 1fr; }
          .acc-mobile-filter-toggle { display: flex; }
          .acc-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            pointer-events: none;
            max-height: none;
          }
          .acc-sidebar.open { pointer-events: auto; }
          .acc-sidebar-backdrop {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .acc-sidebar.open .acc-sidebar-backdrop { opacity: 1; }
          .acc-sidebar-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 340px;
            max-width: 85vw;
            transform: translateX(100%);
            transition: transform 0.3s;
            overflow-y: auto;
            border-radius: 0;
          }
          .acc-sidebar.open .acc-sidebar-panel { transform: translateX(0); }
          .acc-sidebar-close { display: flex; }
          .acc-concern-nav-inner { justify-content: flex-start; padding: 10px 16px; }
          .acc-hero-stats { gap: 16px; }
        }

        @media (max-width: 640px) {
          .acc-hero { min-height: 280px; padding: 40px 20px; }
          .acc-hero h1 { font-size: 32px; }
          .acc-hero p { font-size: 14px; }
          .acc-hero-stats { flex-direction: column; gap: 8px; }
          .acc-hero-stat-divider { width: 40px; height: 1px; }
          .acc-trust-banner-inner { font-size: 11px; gap: 10px; }
          .acc-products-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .acc-card-media { padding-top: 120%; }
          .acc-card-info { padding: 12px; }
          .acc-card-name { font-size: 12px; min-height: 34px; }
          .acc-card-price { font-size: 14px; }
          .acc-card-actions { display: none; }
          .acc-card-rating { display: none; }
          .acc-trust-inner { grid-template-columns: 1fr 1fr; gap: 20px; }
          .acc-trust-item strong { font-size: 12px; }
        }
      `}</style>
    </div>
  )
}

export default Accessories
