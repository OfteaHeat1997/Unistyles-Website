import { Link } from 'react-router-dom'
import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import QuickViewModal from '../components/QuickViewModal'
import { getCategoryHelpUrl } from '../utils/whatsapp'

// Brand options for sunscreen
const brandOptions = ['All', 'Yanbal', 'Esika', "L'Bel"]

// SPF level definitions with labels and icons
const spfConfig = {
  all: { label: 'All', icon: null },
  spf50: { label: 'SPF 50', icon: null },
  spf50plus: { label: 'SPF 50+', icon: null },
  spf100: { label: 'SPF 100', icon: null }
}

// Protection guide step definitions
const guideSteps = [
  { id: 'apply', label: 'Apply', number: 1, description: 'Apply generously 15 min before sun exposure', icon: 'shield' },
  { id: 'reapply', label: 'Reapply', number: 2, description: 'Reapply every 2 hours or after sweating', icon: 'refresh' },
  { id: 'water', label: 'Water Protection', number: 3, description: 'Use water-resistant formulas for swimming', icon: 'droplet' },
  { id: 'aftersun', label: 'After-Sun', number: 4, description: 'Moisturize and soothe skin after sun exposure', icon: 'sun' }
]

// Infer SPF level from product data
function getSPFLevel(product) {
  if (product.spfLevel) return product.spfLevel
  const name = (product.name || '').toLowerCase()
  const badge = (product.badge || '').toLowerCase()
  if (name.includes('spf 100') || name.includes('fps 100') || badge.includes('spf 100')) return 'spf100'
  if (name.includes('spf 50+') || name.includes('50+') || name.includes('fps 50+')) return 'spf50plus'
  return 'spf50'
}

// Infer format type from product data
function getFormatType(product) {
  if (product.formatType) return product.formatType
  const name = (product.name || '').toLowerCase()
  const cat = (typeof product.category === 'string' ? product.category : '').toLowerCase()
  if (cat === 'spray' || name.includes('spray') || name.includes('bifasico')) return 'spray'
  if (cat === 'tinted' || name.includes('compact') || name.includes('compacto')) return 'compact'
  if (name.includes('matt') || name.includes('matificante') || name.includes('matte')) return 'matte'
  return 'cream'
}

// Infer skin concern from product data
function getSkinConcern(product) {
  if (product.skinConcern) return product.skinConcern
  const name = (product.name || '').toLowerCase()
  const desc = (product.description || '').toLowerCase()
  if (name.includes('anti-aging') || name.includes('anti aging') || name.includes('antiaging')) return 'anti_aging'
  if (name.includes('matt') || name.includes('matificante') || desc.includes('oil control') || desc.includes('matte')) return 'oil_control'
  if (name.includes('spray') || name.includes('bifasico') || desc.includes('water')) return 'water_activities'
  return 'daily'
}

// Infer guide step for product
function getGuideStep(product) {
  if (product.guideStep) return product.guideStep
  const format = getFormatType(product)
  const concern = getSkinConcern(product)
  if (concern === 'water_activities' || format === 'spray') return 'water'
  if (format === 'compact') return 'reapply'
  return 'apply'
}

// Get SPF label for display
function getSPFLabel(product) {
  const level = getSPFLevel(product)
  if (level === 'spf100') return 'SPF 100'
  if (level === 'spf50plus') return 'SPF 50+'
  return 'SPF 50'
}

// Get format label for display
function getFormatLabel(product) {
  const format = getFormatType(product)
  if (format === 'spray') return 'Spray'
  if (format === 'compact') return 'Compact'
  if (format === 'matte') return 'Matte'
  return 'Cream'
}

// Quiz questions for sunscreen
const quizQuestions = [
  {
    id: 'skinType',
    question: 'What is your skin type?',
    options: [
      { id: 'normal', label: 'Normal', description: 'Balanced, not too oily or dry' },
      { id: 'oily', label: 'Oily', description: 'Shiny, prone to breakouts' },
      { id: 'dry', label: 'Dry', description: 'Feels tight, may flake' },
      { id: 'sensitive', label: 'Sensitive', description: 'Easily irritated, reactive' }
    ]
  },
  {
    id: 'concern',
    question: 'What is your primary concern?',
    options: [
      { id: 'daily', label: 'Daily Protection', description: 'Everyday UV defense' },
      { id: 'anti_aging', label: 'Anti-Aging', description: 'Sun protection + anti-aging benefits' },
      { id: 'oil_control', label: 'Oil Control', description: 'Matte finish, no shine' },
      { id: 'water_activities', label: 'Water Activities', description: 'Swimming, sports, sweating' }
    ]
  },
  {
    id: 'format',
    question: 'What format do you prefer?',
    options: [
      { id: 'cream', label: 'Cream', description: 'Classic lotion formula' },
      { id: 'compact', label: 'Compact', description: 'Portable powder or tinted compact' },
      { id: 'spray', label: 'Spray', description: 'Easy spray-on application' },
      { id: 'any', label: 'Any Format', description: 'Open to all options' }
    ]
  },
  {
    id: 'budget',
    question: 'What is your budget range?',
    options: [
      { id: 'under25', label: 'Under XCG 25', description: 'Affordable protection' },
      { id: '25to35', label: 'XCG 25 - 35', description: 'Mid-range picks' },
      { id: 'over35', label: 'Over XCG 35', description: 'Premium formulas' }
    ]
  }
]

function Sunscreen() {
  // State
  const [selectedSPF, setSelectedSPF] = useState('all')
  const [selectedFormat, setSelectedFormat] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('All')
  const [priceRange, setPriceRange] = useState('all')
  const [sortBy, setSortBy] = useState('featured')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [visibleCount, setVisibleCount] = useState(12)
  const [wishlist, setWishlist] = useState([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizStep, setQuizStep] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizResults, setQuizResults] = useState(null)

  // Fetch products
  const { data: productsData, isLoading } = useProductsByCategory('bloqueador')

  // Enrich products with sunscreen metadata
  const enrichedProducts = useMemo(() => {
    const products = productsData?.products || []
    return products.map(p => ({
      ...p,
      inferredSPF: getSPFLevel(p),
      inferredFormat: getFormatType(p),
      inferredConcern: getSkinConcern(p),
      inferredStep: getGuideStep(p)
    }))
  }, [productsData])

  // SPF counts
  const spfCounts = useMemo(() => {
    const counts = { all: enrichedProducts.length }
    enrichedProducts.forEach(p => {
      counts[p.inferredSPF] = (counts[p.inferredSPF] || 0) + 1
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

    // SPF filter
    if (selectedSPF !== 'all') {
      products = products.filter(p => p.inferredSPF === selectedSPF)
    }

    // Format filter
    if (selectedFormat !== 'all') {
      products = products.filter(p => p.inferredFormat === selectedFormat)
    }

    // Brand filter
    if (selectedBrand !== 'All') {
      products = products.filter(p => {
        const brandName = typeof p.brand === 'object' ? p.brand?.name : p.brand
        return brandName?.toLowerCase().includes(selectedBrand.toLowerCase())
      })
    }

    // Price range filter
    if (priceRange !== 'all') {
      switch (priceRange) {
        case 'under25':
          products = products.filter(p => p.price < 25)
          break
        case '25to35':
          products = products.filter(p => p.price >= 25 && p.price <= 35)
          break
        case 'over35':
          products = products.filter(p => p.price > 35)
          break
      }
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
  }, [enrichedProducts, selectedSPF, selectedFormat, selectedBrand, priceRange, sortBy, searchQuery])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Clear all filters
  const clearFilters = () => {
    setSelectedSPF('all')
    setSelectedFormat('all')
    setSelectedBrand('All')
    setPriceRange('all')
    setSearchQuery('')
  }

  const activeFiltersCount = [
    selectedSPF !== 'all',
    selectedFormat !== 'all',
    selectedBrand !== 'All',
    priceRange !== 'all',
    searchQuery.trim() !== ''
  ].filter(Boolean).length

  // Quiz handlers
  const handleQuizAnswer = (questionId, answerId) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answerId }))
    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(prev => prev + 1)
    } else {
      computeQuizResults({ ...quizAnswers, [questionId]: answerId })
    }
  }

  const computeQuizResults = (answers) => {
    const scored = enrichedProducts.map(product => {
      let score = 50

      // Skin type match
      if (answers.skinType) {
        if (answers.skinType === 'oily' && product.inferredConcern === 'oil_control') score += 20
        else if (answers.skinType === 'sensitive' && product.inferredFormat === 'cream') score += 15
        else if (answers.skinType === 'dry' && product.inferredFormat !== 'matte') score += 10
        else if (answers.skinType === 'normal') score += 10
      }

      // Concern match
      if (answers.concern) {
        if (product.inferredConcern === answers.concern) score += 25
      }

      // Format match
      if (answers.format && answers.format !== 'any') {
        if (product.inferredFormat === answers.format) score += 15
      }

      // Budget match
      if (answers.budget) {
        if (answers.budget === 'under25' && product.price < 25) score += 10
        else if (answers.budget === '25to35' && product.price >= 25 && product.price <= 35) score += 10
        else if (answers.budget === 'over35' && product.price > 35) score += 10
      }

      // Badge boost
      if (product.badge === 'bestseller' || product.badge === 'Bestseller') score += 5

      return { ...product, matchScore: Math.min(score, 98) }
    })

    scored.sort((a, b) => b.matchScore - a.matchScore)
    setQuizResults(scored.slice(0, 6))
  }

  const resetQuiz = () => {
    setQuizStep(0)
    setQuizAnswers({})
    setQuizResults(null)
  }

  const closeQuiz = () => {
    setQuizOpen(false)
    resetQuiz()
  }

  // Products by guide step for "Sun Protection Guide" section
  const productsByStep = useMemo(() => {
    const byStep = {}
    guideSteps.forEach(step => {
      byStep[step.id] = enrichedProducts.filter(p => p.inferredStep === step.id).slice(0, 2)
    })
    return byStep
  }, [enrichedProducts])

  return (
    <div className="sun-page">
      {/* Hero Section */}
      <section className="sun-hero">
        <div className="sun-hero-bg"></div>
        <div className="sun-hero-content">
          <span className="sun-hero-tag">Sun Protection</span>
          <h1>Premium Sun Protection</h1>
          <p>Shield your skin with Colombia's best sunscreens. SPF 50+ to SPF 100 formulas for the Caribbean sun.</p>
          <button className="sun-hero-cta" onClick={() => setQuizOpen(true)}>
            Find Your Perfect Sunscreen
          </button>
        </div>
      </section>

      {/* SPF Nav Tabs */}
      <nav className="sun-concern-nav">
        <div className="sun-concern-nav-inner">
          {Object.entries(spfConfig).map(([id, config]) => (
            <button
              key={id}
              className={`sun-concern-tab ${selectedSPF === id ? 'active' : ''}`}
              onClick={() => { setSelectedSPF(id); setVisibleCount(12) }}
            >
              {config.icon && <span className="sun-concern-icon">{config.icon}</span>}
              <span>{config.label}</span>
              <span className="sun-concern-count">({spfCounts[id] || 0})</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Layout */}
      <div className="sun-container">
        {/* Mobile Filter Toggle */}
        <button className="sun-mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          </svg>
          Filters {activeFiltersCount > 0 && <span className="sun-filter-badge">{activeFiltersCount}</span>}
        </button>

        {/* Sidebar Filters */}
        <aside className={`sun-sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
          <div className="sun-sidebar-backdrop" onClick={() => setMobileFiltersOpen(false)} />
          <div className="sun-sidebar-panel">
            <div className="sun-sidebar-header">
              <h3>Filters</h3>
              <button className="sun-sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <button className="sun-clear-all-btn" onClick={clearFilters}>
                Clear All Filters ({activeFiltersCount})
              </button>
            )}

            {/* Search */}
            <div className="sun-filter-section">
              <div className="sun-search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search sunscreens, brands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Format Type Filter */}
            <div className="sun-filter-section">
              <h4>Format Type</h4>
              <div className="sun-filter-options">
                {[
                  { id: 'all', label: 'All Formats' },
                  { id: 'cream', label: 'Cream' },
                  { id: 'compact', label: 'Compact' },
                  { id: 'spray', label: 'Spray' },
                  { id: 'matte', label: 'Matte' }
                ].map(opt => (
                  <label key={opt.id} className="sun-filter-radio">
                    <input
                      type="radio"
                      name="format"
                      checked={selectedFormat === opt.id}
                      onChange={() => { setSelectedFormat(opt.id); setVisibleCount(12) }}
                    />
                    <span className="sun-radio-custom" />
                    <span className="sun-radio-label">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="sun-filter-section">
              <h4>Brand</h4>
              <div className="sun-filter-options">
                {brandOptions.map(brand => (
                  <label key={brand} className="sun-filter-radio">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === brand}
                      onChange={() => setSelectedBrand(brand)}
                    />
                    <span className="sun-radio-custom" />
                    <span className="sun-radio-label">{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="sun-filter-section">
              <h4>Price Range</h4>
              <div className="sun-filter-options">
                {[
                  { id: 'all', label: 'All Prices' },
                  { id: 'under25', label: 'Under XCG 25' },
                  { id: '25to35', label: 'XCG 25 - 35' },
                  { id: 'over35', label: 'Over XCG 35' }
                ].map(opt => (
                  <label key={opt.id} className="sun-filter-radio">
                    <input
                      type="radio"
                      name="price"
                      checked={priceRange === opt.id}
                      onChange={() => setPriceRange(opt.id)}
                    />
                    <span className="sun-radio-custom" />
                    <span className="sun-radio-label">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quiz CTA */}
            <button className="sun-sidebar-quiz-cta" onClick={() => setQuizOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div>
                <strong>Sunscreen Quiz</strong>
                <span>Find your perfect protection in 60 seconds</span>
              </div>
            </button>

            {/* WhatsApp Help */}
            <a href={getCategoryHelpUrl('bloqueador')} className="sun-sidebar-help" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Need sunscreen advice? Chat with us</span>
            </a>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="sun-products-main">
          {/* Toolbar */}
          <div className="sun-products-toolbar">
            <p className="sun-product-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </p>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sun-sort-select">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="sun-loading-state">
              <div className="sun-spinner" />
              <p>Loading products...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="sun-empty-state">
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
            <div className="sun-products-grid">
              {visibleProducts.map(product => {
                const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                const isWishlisted = wishlist.includes(product.id)
                const formatLabel = getFormatLabel(product)
                const spfLabel = getSPFLabel(product)

                return (
                  <article key={product.id} className="sun-product-card">
                    <Link to={`/product/${product.id}`}>
                      <div className="sun-card-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }}
                        />
                        {product.badge && (
                          <span className={`sun-card-badge badge-${typeof product.badge === 'string' ? product.badge.toLowerCase().replace(/[^a-z0-9]/g, '_') : product.badge}`}>
                            {product.badge === 'new' || product.badge === 'New' ? 'New'
                              : product.badge === 'bestseller' || product.badge === 'Bestseller' ? 'Bestseller'
                              : product.badge}
                          </span>
                        )}
                        <button
                          className={`sun-wishlist-btn ${isWishlisted ? 'active' : ''}`}
                          onClick={(e) => toggleWishlist(e, product.id)}
                          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        <div className="sun-card-actions">
                          <button
                            className="sun-action-btn"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product) }}
                          >
                            Quick View
                          </button>
                          <button
                            className="sun-action-btn primary"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                      <div className="sun-card-info">
                        {brandName && <span className="sun-card-brand">{brandName}</span>}
                        <h3 className="sun-card-name">{product.name}</h3>
                        <div className="sun-card-meta">
                          <span className="sun-card-format">{formatLabel}</span>
                          <span className="sun-card-spf">{spfLabel}</span>
                        </div>
                        <p className="sun-card-price">XCG {typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</p>
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="sun-load-more">
              <button onClick={() => setVisibleCount(prev => prev + 12)}>
                Load More ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Sun Protection Guide Section */}
      <section className="sun-routine">
        <div className="sun-routine-inner">
          <div className="sun-routine-header">
            <span className="sun-routine-tag">Protection Guide</span>
            <h2>Your Sun Protection Routine</h2>
            <p>Follow these steps for maximum sun protection every day</p>
          </div>
          <div className="sun-routine-steps">
            {guideSteps.map((step) => {
              const stepProducts = productsByStep[step.id] || []
              return (
                <div key={step.id} className="sun-routine-step">
                  <div className="sun-step-number">{step.number}</div>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                  {stepProducts.length > 0 ? (
                    <div className="sun-step-products">
                      {stepProducts.map(p => (
                        <Link key={p.id} to={`/product/${p.id}`} className="sun-step-product">
                          <img src={p.image} alt={p.name} onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }} />
                          <span className="sun-step-product-name">{p.name}</span>
                          <span className="sun-step-product-price">XCG {p.price}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="sun-step-empty">Browse our collection to find products for this step</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="sun-trust">
        <div className="sun-trust-inner">
          <div className="sun-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <div>
              <strong>Broad Spectrum UVA/UVB</strong>
              <span>Full spectrum protection</span>
            </div>
          </div>
          <div className="sun-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <strong>Dermatologist Tested</strong>
              <span>Clinically proven formulas</span>
            </div>
          </div>
          <div className="sun-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div>
              <strong>Water Resistant</strong>
              <span>Stays on during activities</span>
            </div>
          </div>
          <div className="sun-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <strong>Caribbean Sun Tested</strong>
              <span>Made for tropical climates</span>
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

      {/* Sunscreen Quiz Modal */}
      {quizOpen && createPortal(
        <div className="sun-quiz-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeQuiz() }}>
          <div className="sun-quiz-modal">
            <button className="sun-quiz-close" onClick={closeQuiz}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!quizResults ? (
              <>
                {/* Quiz Header */}
                <div className="sun-quiz-header">
                  <h2>Find Your Perfect Sunscreen</h2>
                  <p>Answer {quizQuestions.length} quick questions</p>
                  <div className="sun-quiz-progress">
                    {quizQuestions.map((_, i) => (
                      <div key={i} className={`sun-quiz-dot ${i <= quizStep ? 'active' : ''} ${i < quizStep ? 'done' : ''}`} />
                    ))}
                  </div>
                </div>

                {/* Current Question */}
                <div className="sun-quiz-question">
                  <h3>{quizQuestions[quizStep].question}</h3>
                  <div className="sun-quiz-options">
                    {quizQuestions[quizStep].options.map(option => (
                      <button
                        key={option.id}
                        className={`sun-quiz-option ${quizAnswers[quizQuestions[quizStep].id] === option.id ? 'selected' : ''}`}
                        onClick={() => handleQuizAnswer(quizQuestions[quizStep].id, option.id)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Back button */}
                {quizStep > 0 && (
                  <button className="sun-quiz-back" onClick={() => setQuizStep(prev => prev - 1)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Previous Question
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Quiz Results */}
                <div className="sun-quiz-header">
                  <h2>Your Personalized Picks</h2>
                  <p>Based on your answers, we recommend these sunscreens</p>
                </div>
                <div className="sun-quiz-results">
                  {quizResults.map(product => {
                    const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                    return (
                      <Link key={product.id} to={`/product/${product.id}`} className="sun-quiz-result-card" onClick={closeQuiz}>
                        <div className="sun-quiz-result-img">
                          <img src={product.image} alt={product.name} onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }} />
                          <span className="sun-quiz-match">{product.matchScore}% match</span>
                        </div>
                        <div className="sun-quiz-result-info">
                          {brandName && <span className="sun-quiz-result-brand">{brandName}</span>}
                          <h4>{product.name}</h4>
                          <span className="sun-quiz-result-price">XCG {product.price}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                <div className="sun-quiz-actions">
                  <button className="sun-quiz-retake" onClick={resetQuiz}>Retake Quiz</button>
                  <button className="sun-quiz-close-btn" onClick={closeQuiz}>Browse All Products</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* ===== Sunscreen Page Styles ===== */
        .sun-page {
          --gold: #C5A55A;
          --gold-light: #D4B96E;
          --dark: #1a1a1a;
          --sun-accent: #1B4D4F;
          --sun-accent-light: #F3EDE6;
          --gray-100: #FAF8F5;
          --gray-200: #E6DED8;
          --gray-400: #9B9490;
          --gray-600: #6B6560;
          --success: #1B4D4F;
          background: var(--gray-100);
        }

        /* Hero */
        .sun-hero {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 20px;
          overflow: hidden;
        }
        .sun-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #1F3347 50%, #1B4D4F 100%);
        }
        .sun-hero-content {
          position: relative;
          z-index: 1;
          max-width: 600px;
        }
        .sun-hero-tag {
          display: inline-block;
          color: var(--gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .sun-hero h1 {
          color: white;
          font-size: 44px;
          font-weight: 300;
          letter-spacing: -1px;
          margin: 0 0 12px;
        }
        .sun-hero p {
          color: rgba(255,255,255,0.7);
          font-size: 16px;
          margin: 0 0 28px;
        }
        .sun-hero-cta {
          padding: 14px 32px;
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
        .sun-hero-cta:hover {
          background: var(--gold-light);
          color: var(--dark);
        }

        /* SPF Nav */
        .sun-concern-nav {
          background: white;
          border-bottom: 1px solid var(--gray-200);
          position: sticky;
          top: 70px;
          z-index: 80;
        }
        .sun-concern-nav-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          gap: 4px;
          padding: 10px 20px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .sun-concern-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: none;
          border: 1.5px solid transparent;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-600);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sun-concern-tab:hover {
          border-color: var(--gray-200);
          color: var(--dark);
        }
        .sun-concern-tab.active {
          background: var(--sun-accent);
          border-color: var(--sun-accent);
          color: white;
        }
        .sun-concern-icon { font-size: 14px; }
        .sun-concern-count {
          font-size: 11px;
          opacity: 0.6;
        }

        /* Container */
        .sun-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 20px;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 36px;
        }

        /* Mobile Filter Toggle */
        .sun-mobile-filter-toggle {
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
        .sun-filter-badge {
          background: var(--sun-accent);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        /* Sidebar */
        .sun-sidebar {
          position: sticky;
          top: 140px;
          height: fit-content;
        }
        .sun-sidebar-backdrop { display: none; }
        .sun-sidebar-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }
        .sun-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--gray-200);
        }
        .sun-sidebar-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .sun-sidebar-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-600);
        }
        .sun-clear-all-btn {
          width: 100%;
          padding: 10px;
          background: var(--gray-100);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          color: var(--sun-accent);
          cursor: pointer;
          margin-bottom: 20px;
        }
        .sun-clear-all-btn:hover { background: var(--gray-200); }

        /* Filter Sections */
        .sun-filter-section {
          margin-bottom: 24px;
        }
        .sun-filter-section h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gray-600);
          margin: 0 0 12px;
        }
        .sun-search-input-wrap {
          position: relative;
        }
        .sun-search-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-400);
        }
        .sun-search-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .sun-search-input-wrap input:focus {
          outline: none;
          border-color: var(--sun-accent);
        }
        .sun-filter-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sun-filter-radio {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          cursor: pointer;
          font-size: 14px;
          color: var(--gray-600);
        }
        .sun-filter-radio input { display: none; }
        .sun-radio-custom {
          width: 16px;
          height: 16px;
          border: 2px solid var(--gray-200);
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .sun-filter-radio input:checked + .sun-radio-custom {
          border-color: var(--sun-accent);
        }
        .sun-filter-radio input:checked + .sun-radio-custom::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 6px;
          height: 6px;
          background: var(--sun-accent);
          border-radius: 50%;
        }
        .sun-filter-radio:hover .sun-radio-label { color: var(--dark); }

        /* Sidebar Quiz CTA */
        .sun-sidebar-quiz-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, var(--sun-accent-light), #F3EDE6);
          border: 1.5px solid var(--sun-accent);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 16px;
          transition: all 0.2s;
        }
        .sun-sidebar-quiz-cta:hover {
          background: var(--sun-accent);
          color: white;
        }
        .sun-sidebar-quiz-cta:hover svg { stroke: white; }
        .sun-sidebar-quiz-cta svg {
          color: var(--sun-accent);
          flex-shrink: 0;
        }
        .sun-sidebar-quiz-cta strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }
        .sun-sidebar-quiz-cta span {
          font-size: 11px;
          opacity: 0.7;
        }

        /* Sidebar Help */
        .sun-sidebar-help {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #F3EDE6;
          border-radius: 10px;
          text-decoration: none;
          color: #1B4D4F;
          font-size: 13px;
          margin-top: 8px;
        }
        .sun-sidebar-help svg {
          color: #1B4D4F;
          flex-shrink: 0;
        }

        /* Products Main */
        .sun-products-main { min-height: 600px; }
        .sun-products-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .sun-product-count {
          font-size: 14px;
          color: var(--gray-600);
          margin: 0;
        }
        .sun-sort-select {
          padding: 10px 36px 10px 14px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
          cursor: pointer;
          appearance: none;
        }

        /* Loading & Empty States */
        .sun-loading-state, .sun-empty-state {
          text-align: center;
          padding: 80px 20px;
        }
        .sun-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--gray-200);
          border-top-color: var(--sun-accent);
          border-radius: 50%;
          animation: sun-spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes sun-spin { to { transform: rotate(360deg); } }
        .sun-empty-state svg { color: var(--gray-200); margin-bottom: 16px; }
        .sun-empty-state h3 { margin: 0 0 8px; font-size: 18px; }
        .sun-empty-state p { color: var(--gray-600); margin: 0 0 20px; }
        .sun-empty-state button {
          padding: 12px 28px;
          background: var(--sun-accent);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Products Grid */
        .sun-products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .sun-product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .sun-product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .sun-product-card a { text-decoration: none; color: inherit; }

        /* Card Media */
        .sun-card-media {
          position: relative;
          padding-top: 110%;
          background: linear-gradient(to bottom, var(--gray-100), white);
        }
        .sun-card-media img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 70%;
          max-height: 70%;
          object-fit: contain;
          transition: transform 0.4s;
        }
        .sun-product-card:hover .sun-card-media img {
          transform: translate(-50%, -50%) scale(1.05);
        }
        .sun-card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 4px 10px;
          background: var(--sun-accent);
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px;
        }
        .sun-card-badge.badge-bestseller { background: var(--gold); color: var(--dark); }
        .sun-card-badge.badge-new { background: var(--success); }
        .sun-card-badge.badge-spf_100 { background: #1F3347; }

        /* Wishlist */
        .sun-wishlist-btn {
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
        .sun-wishlist-btn:hover, .sun-wishlist-btn.active { color: #A4443A; }

        /* Card Actions */
        .sun-card-actions {
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
        .sun-product-card:hover .sun-card-actions {
          opacity: 1;
          transform: translateY(0);
        }
        .sun-action-btn {
          padding: 12px;
          background: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sun-action-btn.primary {
          background: var(--sun-accent);
          color: white;
        }

        /* Card Info */
        .sun-card-info {
          padding: 18px;
          text-align: center;
        }
        .sun-card-brand {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .sun-card-name {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 8px;
          min-height: 40px;
          line-height: 1.4;
          color: var(--dark);
        }
        .sun-card-meta {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .sun-card-format {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--sun-accent);
          background: var(--sun-accent-light);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .sun-card-spf {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #1F3347;
          background: #F3EDE6;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .sun-card-price {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--dark);
        }

        /* Load More */
        .sun-load-more {
          text-align: center;
          margin-top: 40px;
        }
        .sun-load-more button {
          padding: 14px 40px;
          background: transparent;
          border: 2px solid var(--dark);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sun-load-more button:hover {
          background: var(--dark);
          color: white;
        }

        /* Sun Protection Guide Section */
        .sun-routine {
          background: white;
          padding: 60px 20px;
          margin-top: 40px;
        }
        .sun-routine-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .sun-routine-header {
          text-align: center;
          margin-bottom: 48px;
        }
        .sun-routine-tag {
          display: inline-block;
          color: var(--sun-accent);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .sun-routine-header h2 {
          font-size: 32px;
          font-weight: 300;
          color: var(--dark);
          margin: 0 0 10px;
        }
        .sun-routine-header p {
          color: var(--gray-600);
          font-size: 15px;
          margin: 0;
        }
        .sun-routine-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .sun-routine-step {
          text-align: center;
          padding: 28px 20px;
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          position: relative;
        }
        .sun-step-number {
          width: 36px;
          height: 36px;
          background: var(--sun-accent);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          margin: 0 auto 14px;
        }
        .sun-routine-step h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 6px;
          color: var(--dark);
        }
        .sun-routine-step > p {
          font-size: 12px;
          color: var(--gray-600);
          margin: 0 0 16px;
          line-height: 1.4;
        }
        .sun-step-products {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sun-step-product {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border: 1px solid var(--gray-200);
          border-radius: 8px;
          text-decoration: none;
          color: var(--dark);
          transition: all 0.2s;
        }
        .sun-step-product:hover {
          border-color: var(--sun-accent);
          background: var(--sun-accent-light);
        }
        .sun-step-product img {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border-radius: 4px;
        }
        .sun-step-product-name {
          font-size: 12px;
          font-weight: 500;
          flex: 1;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sun-step-product-price {
          font-size: 11px;
          font-weight: 600;
          color: var(--sun-accent);
          white-space: nowrap;
        }
        .sun-step-empty {
          font-size: 11px;
          color: var(--gray-400);
          font-style: italic;
        }

        /* Trust Badges */
        .sun-trust {
          background: var(--dark);
          padding: 40px 20px;
        }
        .sun-trust-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
        }
        .sun-trust-item {
          display: flex;
          align-items: center;
          gap: 14px;
          color: white;
        }
        .sun-trust-item svg {
          color: var(--sun-accent);
          flex-shrink: 0;
          stroke: #C5A55A;
        }
        .sun-trust-item strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .sun-trust-item span {
          font-size: 11px;
          opacity: 0.6;
        }

        /* Quiz Modal */
        .sun-quiz-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .sun-quiz-modal {
          background: white;
          border-radius: 16px;
          max-width: 560px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 40px;
          position: relative;
        }
        .sun-quiz-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-400);
          transition: color 0.2s;
        }
        .sun-quiz-close:hover { color: var(--dark); }

        .sun-quiz-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .sun-quiz-header h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--dark);
        }
        .sun-quiz-header p {
          color: var(--gray-600);
          margin: 0 0 20px;
          font-size: 14px;
        }
        .sun-quiz-progress {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        .sun-quiz-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--gray-200);
          transition: all 0.3s;
        }
        .sun-quiz-dot.active { background: var(--sun-accent); transform: scale(1.2); }
        .sun-quiz-dot.done { background: var(--sun-accent); opacity: 0.5; }

        .sun-quiz-question h3 {
          font-size: 18px;
          font-weight: 500;
          margin: 0 0 20px;
          text-align: center;
          color: var(--dark);
        }
        .sun-quiz-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sun-quiz-option {
          display: block;
          width: 100%;
          padding: 16px 20px;
          border: 1.5px solid var(--gray-200);
          border-radius: 10px;
          background: white;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .sun-quiz-option:hover {
          border-color: var(--sun-accent);
          background: var(--sun-accent-light);
        }
        .sun-quiz-option.selected {
          border-color: var(--sun-accent);
          background: var(--sun-accent-light);
        }
        .sun-quiz-option strong {
          display: block;
          font-size: 14px;
          margin-bottom: 2px;
          color: var(--dark);
        }
        .sun-quiz-option span {
          font-size: 12px;
          color: var(--gray-600);
        }
        .sun-quiz-back {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          background: none;
          border: none;
          color: var(--gray-600);
          cursor: pointer;
          font-size: 13px;
        }
        .sun-quiz-back:hover { color: var(--dark); }

        /* Quiz Results */
        .sun-quiz-results {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .sun-quiz-result-card {
          border: 1px solid var(--gray-200);
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          color: var(--dark);
          transition: all 0.2s;
        }
        .sun-quiz-result-card:hover {
          border-color: var(--sun-accent);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .sun-quiz-result-img {
          position: relative;
          padding-top: 80%;
          background: var(--gray-100);
        }
        .sun-quiz-result-img img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 65%;
          max-height: 65%;
          object-fit: contain;
        }
        .sun-quiz-match {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 3px 8px;
          background: var(--sun-accent);
          color: white;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
        }
        .sun-quiz-result-info {
          padding: 12px;
          text-align: center;
        }
        .sun-quiz-result-brand {
          display: block;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gold);
          margin-bottom: 4px;
        }
        .sun-quiz-result-info h4 {
          font-size: 12px;
          font-weight: 500;
          margin: 0 0 4px;
          line-height: 1.3;
        }
        .sun-quiz-result-price {
          font-size: 13px;
          font-weight: 600;
          color: var(--sun-accent);
        }

        .sun-quiz-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .sun-quiz-retake {
          padding: 12px 24px;
          background: none;
          border: 1.5px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sun-quiz-retake:hover { border-color: var(--dark); }
        .sun-quiz-close-btn {
          padding: 12px 24px;
          background: var(--sun-accent);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .sun-products-grid { grid-template-columns: repeat(2, 1fr); }
          .sun-trust-inner { grid-template-columns: repeat(2, 1fr); }
          .sun-routine-steps { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 900px) {
          .sun-container { grid-template-columns: 1fr; }
          .sun-mobile-filter-toggle { display: flex; }

          .sun-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            pointer-events: none;
          }
          .sun-sidebar.open { pointer-events: auto; }
          .sun-sidebar-backdrop {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .sun-sidebar.open .sun-sidebar-backdrop { opacity: 1; }
          .sun-sidebar-panel {
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
          .sun-sidebar.open .sun-sidebar-panel { transform: translateX(0); }
          .sun-sidebar-close { display: flex; }

          .sun-concern-nav-inner {
            justify-content: flex-start;
            padding: 10px 16px;
          }
        }

        @media (max-width: 640px) {
          .sun-hero { min-height: 260px; padding: 40px 20px; }
          .sun-hero h1 { font-size: 32px; }
          .sun-hero p { font-size: 14px; }

          .sun-products-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .sun-card-media { padding-top: 120%; }
          .sun-card-info { padding: 12px; }
          .sun-card-name { font-size: 12px; min-height: 34px; }
          .sun-card-price { font-size: 14px; }
          .sun-card-actions { display: none; }

          .sun-routine-steps { grid-template-columns: 1fr; }
          .sun-routine-header h2 { font-size: 24px; }

          .sun-trust-inner {
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .sun-trust-item strong { font-size: 12px; }

          .sun-quiz-modal { padding: 24px; }
          .sun-quiz-results { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .sun-quiz-header h2 { font-size: 20px; }
        }
      `}</style>
    </div>
  )
}

export default Sunscreen
