import { Link } from 'react-router-dom'
import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import QuickViewModal from '../components/QuickViewModal'
import { getCategoryHelpUrl } from '../utils/whatsapp'

// Brand options for skincare
const brandOptions = ['All', "L'Bel", 'Esika', 'Yanbal']

// Concern definitions with labels and colors
const concernConfig = {
  all: { label: 'All', icon: null },
  hydration: { label: 'Hydration', icon: '💧' },
  anti_aging: { label: 'Anti-Aging', icon: '✨' },
  brightening: { label: 'Brightening', icon: '🌟' },
  nourishing: { label: 'Nourishing', icon: '🌿' }
}

// Routine step definitions
const routineSteps = [
  { id: 'cleanse', label: 'Cleanse', number: 1, description: 'Remove impurities and prep skin', icon: 'droplet' },
  { id: 'treat', label: 'Treat', number: 2, description: 'Target specific skin concerns', icon: 'flask' },
  { id: 'moisturize', label: 'Moisturize', number: 3, description: 'Lock in hydration and nutrients', icon: 'shield' },
  { id: 'protect', label: 'Protect', number: 4, description: 'Shield from UV and environment', icon: 'sun' }
]

// Infer skin concern from product data
function getConcern(product) {
  if (product.skinConcern) return product.skinConcern
  const name = (product.name || '').toLowerCase()
  const cat = (typeof product.category === 'string' ? product.category : '').toLowerCase()
  if (cat === 'anti-aging' || name.includes('anti') || name.includes('renacer') || name.includes('totalist') || name.includes('triple')) return 'anti_aging'
  if (name.includes('sensitiv') || name.includes('hydra') || name.includes('gaia')) return 'hydration'
  if (name.includes('seda') || name.includes('perla') || name.includes('bright')) return 'brightening'
  return 'nourishing'
}

// Infer application area from product data
function getApplicationArea(product) {
  if (product.applicationArea) return product.applicationArea
  const name = (product.name || '').toLowerCase()
  const cat = (typeof product.category === 'string' ? product.category : '').toLowerCase()
  if (cat === 'hand' || name.includes('hand') || name.includes('mano')) return 'hands'
  if (cat === 'face' || cat === 'anti-aging' || name.includes('face') || name.includes('facial') || name.includes('night') || name.includes('noche')) return 'face'
  return 'body'
}

// Infer routine step
function getRoutineStep(product) {
  if (product.routineStep) return product.routineStep
  const concern = getConcern(product)
  if (concern === 'anti_aging') return 'treat'
  return 'moisturize'
}

// Infer key ingredients
function getKeyIngredients(product) {
  if (product.keyIngredients) return product.keyIngredients
  const name = (product.name || '').toLowerCase()
  if (name.includes('mithyka')) return 'Mithyka Complex, Vitamin E'
  if (name.includes('vibranza')) return 'Aloe Vera, Coconut Oil'
  if (name.includes('ccori')) return 'Gold Particles, Argan Oil'
  if (name.includes('renacer')) return 'Retinol, Hyaluronic Acid'
  if (name.includes('totalist')) return 'Collagen, CoQ10'
  if (name.includes('sensitiv')) return 'Chamomile, Ceramides'
  if (name.includes('triple')) return 'Retinol, Vitamin C'
  return 'Premium Ingredients'
}

// Quiz questions for skincare
const quizQuestions = [
  {
    id: 'skinType',
    question: 'What is your skin type?',
    options: [
      { id: 'normal', label: 'Normal', description: 'Balanced, not too oily or dry' },
      { id: 'dry', label: 'Dry', description: 'Feels tight, may flake' },
      { id: 'combination', label: 'Combination', description: 'Oily T-zone, dry cheeks' },
      { id: 'sensitive', label: 'Sensitive', description: 'Easily irritated, reactive' }
    ]
  },
  {
    id: 'concern',
    question: 'What is your primary skin concern?',
    options: [
      { id: 'hydration', label: 'Hydration', description: 'Deep moisture and plumpness' },
      { id: 'anti_aging', label: 'Anti-Aging', description: 'Fine lines and firmness' },
      { id: 'brightening', label: 'Brightening', description: 'Even tone and radiance' },
      { id: 'nourishing', label: 'Nourishing', description: 'Overall skin health' }
    ]
  },
  {
    id: 'area',
    question: 'Which area do you want to focus on?',
    options: [
      { id: 'face', label: 'Face', description: 'Facial skincare' },
      { id: 'body', label: 'Body', description: 'Body moisturizers and lotions' },
      { id: 'hands', label: 'Hands', description: 'Hand care' },
      { id: 'all', label: 'All Areas', description: 'Complete skincare' }
    ]
  },
  {
    id: 'budget',
    question: 'What is your budget range?',
    options: [
      { id: 'under25', label: 'Under XCG 25', description: 'Affordable essentials' },
      { id: '25to40', label: 'XCG 25 - 40', description: 'Mid-range picks' },
      { id: 'over40', label: 'Over XCG 40', description: 'Premium treatments' }
    ]
  },
  {
    id: 'routine',
    question: 'How much time for your skincare routine?',
    options: [
      { id: 'quick', label: '2 Minutes', description: 'Just the essentials' },
      { id: 'moderate', label: '5 Minutes', description: 'A balanced routine' },
      { id: 'full', label: '10+ Minutes', description: 'Full pampering session' }
    ]
  }
]

function Skincare() {
  // State
  const [selectedConcern, setSelectedConcern] = useState('all')
  const [selectedArea, setSelectedArea] = useState('all')
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
  const { data: productsData, isLoading } = useProductsByCategory('cremas')

  // Enrich products with skincare metadata
  const enrichedProducts = useMemo(() => {
    const products = productsData?.products || []
    return products.map(p => ({
      ...p,
      inferredConcern: getConcern(p),
      inferredArea: getApplicationArea(p),
      inferredStep: getRoutineStep(p),
      inferredIngredients: getKeyIngredients(p)
    }))
  }, [productsData])

  // Concern counts
  const concernCounts = useMemo(() => {
    const counts = { all: enrichedProducts.length }
    enrichedProducts.forEach(p => {
      counts[p.inferredConcern] = (counts[p.inferredConcern] || 0) + 1
    })
    return counts
  }, [enrichedProducts])

  // Area counts
  const areaCounts = useMemo(() => {
    const counts = { all: enrichedProducts.length }
    enrichedProducts.forEach(p => {
      counts[p.inferredArea] = (counts[p.inferredArea] || 0) + 1
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
        (typeof p.brand === 'object' ? p.brand?.name : p.brand || '').toLowerCase().includes(query) ||
        (p.inferredIngredients || '').toLowerCase().includes(query)
      )
    }

    // Concern filter
    if (selectedConcern !== 'all') {
      products = products.filter(p => p.inferredConcern === selectedConcern)
    }

    // Area filter
    if (selectedArea !== 'all') {
      products = products.filter(p => p.inferredArea === selectedArea || p.inferredArea === 'all')
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
        case '25to40':
          products = products.filter(p => p.price >= 25 && p.price <= 40)
          break
        case 'over40':
          products = products.filter(p => p.price > 40)
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
  }, [enrichedProducts, selectedConcern, selectedArea, selectedBrand, priceRange, sortBy, searchQuery])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Clear all filters
  const clearFilters = () => {
    setSelectedConcern('all')
    setSelectedArea('all')
    setSelectedBrand('All')
    setPriceRange('all')
    setSearchQuery('')
  }

  const activeFiltersCount = [
    selectedConcern !== 'all',
    selectedArea !== 'all',
    selectedBrand !== 'All',
    priceRange !== 'all',
    searchQuery.trim() !== ''
  ].filter(Boolean).length

  // Get area label for product card
  const getAreaLabel = (product) => {
    const area = product.inferredArea
    if (area === 'face') return 'Face'
    if (area === 'body') return 'Body'
    if (area === 'hands') return 'Hands'
    if (area === 'all') return 'Multi-Use'
    return 'Body'
  }

  // Quiz handlers
  const handleQuizAnswer = (questionId, answerId) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answerId }))
    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(prev => prev + 1)
    } else {
      // Calculate results
      computeQuizResults({ ...quizAnswers, [questionId]: answerId })
    }
  }

  const computeQuizResults = (answers) => {
    const scored = enrichedProducts.map(product => {
      let score = 50

      // Skin type match
      if (answers.skinType) {
        const productSkinType = product.skinType || 'all'
        if (productSkinType === answers.skinType) score += 20
        else if (productSkinType === 'all') score += 10
      }

      // Concern match
      if (answers.concern) {
        if (product.inferredConcern === answers.concern) score += 25
      }

      // Area match
      if (answers.area && answers.area !== 'all') {
        if (product.inferredArea === answers.area) score += 15
        else if (product.inferredArea === 'all') score += 5
      }

      // Budget match
      if (answers.budget) {
        if (answers.budget === 'under25' && product.price < 25) score += 10
        else if (answers.budget === '25to40' && product.price >= 25 && product.price <= 40) score += 10
        else if (answers.budget === 'over40' && product.price > 40) score += 10
      }

      // Routine time match - quick prefers moisturizers, full prefers treatments
      if (answers.routine) {
        if (answers.routine === 'quick' && product.inferredStep === 'moisturize') score += 5
        else if (answers.routine === 'full' && product.inferredStep === 'treat') score += 10
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

  // Products by routine step for "Complete Your Routine" section
  const productsByStep = useMemo(() => {
    const byStep = {}
    routineSteps.forEach(step => {
      byStep[step.id] = enrichedProducts.filter(p => p.inferredStep === step.id).slice(0, 2)
    })
    return byStep
  }, [enrichedProducts])

  return (
    <div className="sc-page">
      {/* Hero Section */}
      <section className="sc-hero">
        <div className="sc-hero-bg"></div>
        <div className="sc-hero-content">
          <span className="sc-hero-tag">Premium Skincare</span>
          <h1>Nourish Your Skin</h1>
          <p>Colombian beauty secrets for radiant, healthy skin. Premium creams and treatments from top brands.</p>
          <button className="sc-hero-cta" onClick={() => setQuizOpen(true)}>
            Find Your Perfect Routine
          </button>
        </div>
      </section>

      {/* Concern Nav Tabs */}
      <nav className="sc-concern-nav">
        <div className="sc-concern-nav-inner">
          {Object.entries(concernConfig).map(([id, config]) => (
            <button
              key={id}
              className={`sc-concern-tab ${selectedConcern === id ? 'active' : ''}`}
              onClick={() => { setSelectedConcern(id); setVisibleCount(12) }}
            >
              {config.icon && <span className="sc-concern-icon">{config.icon}</span>}
              <span>{config.label}</span>
              <span className="sc-concern-count">({concernCounts[id] || 0})</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Layout */}
      <div className="sc-container">
        {/* Mobile Filter Toggle */}
        <button className="sc-mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          </svg>
          Filters {activeFiltersCount > 0 && <span className="sc-filter-badge">{activeFiltersCount}</span>}
        </button>

        {/* Sidebar Filters */}
        <aside className={`sc-sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
          <div className="sc-sidebar-backdrop" onClick={() => setMobileFiltersOpen(false)} />
          <div className="sc-sidebar-panel">
            <div className="sc-sidebar-header">
              <h3>Filters</h3>
              <button className="sc-sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <button className="sc-clear-all-btn" onClick={clearFilters}>
                Clear All Filters ({activeFiltersCount})
              </button>
            )}

            {/* Search */}
            <div className="sc-filter-section">
              <div className="sc-search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search creams, ingredients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Application Area Filter */}
            <div className="sc-filter-section">
              <h4>Product Type</h4>
              <div className="sc-filter-options">
                {[
                  { id: 'all', label: 'All Products' },
                  { id: 'body', label: 'Body Creams' },
                  { id: 'face', label: 'Face Creams' },
                  { id: 'hands', label: 'Hand Creams' }
                ].map(opt => (
                  <label key={opt.id} className="sc-filter-radio">
                    <input
                      type="radio"
                      name="area"
                      checked={selectedArea === opt.id}
                      onChange={() => { setSelectedArea(opt.id); setVisibleCount(12) }}
                    />
                    <span className="sc-radio-custom" />
                    <span className="sc-radio-label">{opt.label} ({areaCounts[opt.id] || 0})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="sc-filter-section">
              <h4>Brand</h4>
              <div className="sc-filter-options">
                {brandOptions.map(brand => (
                  <label key={brand} className="sc-filter-radio">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === brand}
                      onChange={() => setSelectedBrand(brand)}
                    />
                    <span className="sc-radio-custom" />
                    <span className="sc-radio-label">{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="sc-filter-section">
              <h4>Price Range</h4>
              <div className="sc-filter-options">
                {[
                  { id: 'all', label: 'All Prices' },
                  { id: 'under25', label: 'Under XCG 25' },
                  { id: '25to40', label: 'XCG 25 - 40' },
                  { id: 'over40', label: 'Over XCG 40' }
                ].map(opt => (
                  <label key={opt.id} className="sc-filter-radio">
                    <input
                      type="radio"
                      name="price"
                      checked={priceRange === opt.id}
                      onChange={() => setPriceRange(opt.id)}
                    />
                    <span className="sc-radio-custom" />
                    <span className="sc-radio-label">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quiz CTA */}
            <button className="sc-sidebar-quiz-cta" onClick={() => setQuizOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <strong>Skincare Quiz</strong>
                <span>Find your perfect routine in 60 seconds</span>
              </div>
            </button>

            {/* WhatsApp Help */}
            <a href={getCategoryHelpUrl('cremas')} className="sc-sidebar-help" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Need skincare advice? Chat with us</span>
            </a>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="sc-products-main">
          {/* Toolbar */}
          <div className="sc-products-toolbar">
            <p className="sc-product-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </p>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sc-sort-select">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="sc-loading-state">
              <div className="sc-spinner" />
              <p>Loading products...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="sc-empty-state">
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
            <div className="sc-products-grid">
              {visibleProducts.map(product => {
                const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                const isWishlisted = wishlist.includes(product.id)
                const areaLabel = getAreaLabel(product)
                const ingredients = product.inferredIngredients

                return (
                  <article key={product.id} className="sc-product-card">
                    <Link to={`/product/${product.id}`}>
                      <div className="sc-card-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }}
                        />
                        {product.badge && (
                          <span className={`sc-card-badge badge-${typeof product.badge === 'string' ? product.badge.toLowerCase().replace(/[^a-z]/g, '_') : product.badge}`}>
                            {product.badge === 'new' || product.badge === 'New' ? 'New'
                              : product.badge === 'bestseller' || product.badge === 'Bestseller' ? 'Bestseller'
                              : product.badge === 'Anti-Aging' ? 'Anti-Aging'
                              : product.badge}
                          </span>
                        )}
                        <button
                          className={`sc-wishlist-btn ${isWishlisted ? 'active' : ''}`}
                          onClick={(e) => toggleWishlist(e, product.id)}
                          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        <div className="sc-card-actions">
                          <button
                            className="sc-action-btn"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product) }}
                          >
                            Quick View
                          </button>
                          <button
                            className="sc-action-btn primary"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                      <div className="sc-card-info">
                        {brandName && <span className="sc-card-brand">{brandName}</span>}
                        <h3 className="sc-card-name">{product.name}</h3>
                        <div className="sc-card-meta">
                          <span className="sc-card-area">{areaLabel}</span>
                          <span className="sc-card-ingredient">{ingredients.split(',')[0]}</span>
                        </div>
                        <p className="sc-card-price">XCG {typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</p>
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="sc-load-more">
              <button onClick={() => setVisibleCount(prev => prev + 12)}>
                Load More ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Complete Your Routine Section */}
      <section className="sc-routine">
        <div className="sc-routine-inner">
          <div className="sc-routine-header">
            <span className="sc-routine-tag">Build Your Routine</span>
            <h2>Complete Your Skincare Routine</h2>
            <p>Follow these steps for healthy, glowing skin every day</p>
          </div>
          <div className="sc-routine-steps">
            {routineSteps.map((step) => {
              const stepProducts = productsByStep[step.id] || []
              return (
                <div key={step.id} className="sc-routine-step">
                  <div className="sc-step-number">{step.number}</div>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                  {stepProducts.length > 0 ? (
                    <div className="sc-step-products">
                      {stepProducts.map(p => (
                        <Link key={p.id} to={`/product/${p.id}`} className="sc-step-product">
                          <img src={p.image} alt={p.name} onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }} />
                          <span className="sc-step-product-name">{p.name}</span>
                          <span className="sc-step-product-price">XCG {p.price}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="sc-step-empty">Browse our collection to find products for this step</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="sc-trust">
        <div className="sc-trust-inner">
          <div className="sc-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <strong>Dermatologist Tested</strong>
              <span>Clinically proven formulas</span>
            </div>
          </div>
          <div className="sc-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div>
              <strong>Natural Ingredients</strong>
              <span>Carefully selected actives</span>
            </div>
          </div>
          <div className="sc-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <div>
              <strong>Cruelty Free</strong>
              <span>Never tested on animals</span>
            </div>
          </div>
          <div className="sc-trust-item">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <strong>Colombian Beauty Secrets</strong>
              <span>Authentic premium brands</span>
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

      {/* Skincare Quiz Modal */}
      {quizOpen && createPortal(
        <div className="sc-quiz-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeQuiz() }}>
          <div className="sc-quiz-modal">
            <button className="sc-quiz-close" onClick={closeQuiz}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!quizResults ? (
              <>
                {/* Quiz Header */}
                <div className="sc-quiz-header">
                  <h2>Find Your Perfect Routine</h2>
                  <p>Answer {quizQuestions.length} quick questions</p>
                  <div className="sc-quiz-progress">
                    {quizQuestions.map((_, i) => (
                      <div key={i} className={`sc-quiz-dot ${i <= quizStep ? 'active' : ''} ${i < quizStep ? 'done' : ''}`} />
                    ))}
                  </div>
                </div>

                {/* Current Question */}
                <div className="sc-quiz-question">
                  <h3>{quizQuestions[quizStep].question}</h3>
                  <div className="sc-quiz-options">
                    {quizQuestions[quizStep].options.map(option => (
                      <button
                        key={option.id}
                        className={`sc-quiz-option ${quizAnswers[quizQuestions[quizStep].id] === option.id ? 'selected' : ''}`}
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
                  <button className="sc-quiz-back" onClick={() => setQuizStep(prev => prev - 1)}>
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
                <div className="sc-quiz-header">
                  <h2>Your Personalized Picks</h2>
                  <p>Based on your answers, we recommend these products</p>
                </div>
                <div className="sc-quiz-results">
                  {quizResults.map(product => {
                    const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                    return (
                      <Link key={product.id} to={`/product/${product.id}`} className="sc-quiz-result-card" onClick={closeQuiz}>
                        <div className="sc-quiz-result-img">
                          <img src={product.image} alt={product.name} onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }} />
                          <span className="sc-quiz-match">{product.matchScore}% match</span>
                        </div>
                        <div className="sc-quiz-result-info">
                          {brandName && <span className="sc-quiz-result-brand">{brandName}</span>}
                          <h4>{product.name}</h4>
                          <span className="sc-quiz-result-price">XCG {product.price}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                <div className="sc-quiz-actions">
                  <button className="sc-quiz-retake" onClick={resetQuiz}>Retake Quiz</button>
                  <button className="sc-quiz-close-btn" onClick={closeQuiz}>Browse All Products</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* ===== Skincare Page Styles ===== */
        .sc-page {
          --gold: #C5A55A;
          --gold-light: #D4B96E;
          --dark: #1a1a1a;
          --skincare-green: #1B4D4F;
          --skincare-green-light: #F3EDE6;
          --gray-100: #FAF8F5;
          --gray-200: #E6DED8;
          --gray-400: #9B9490;
          --gray-600: #6B6560;
          --success: #1B4D4F;
          background: var(--gray-100);
        }

        /* Hero */
        .sc-hero {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 20px;
          overflow: hidden;
        }
        .sc-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #1F3347 50%, #1B4D4F 100%);
        }
        .sc-hero-content {
          position: relative;
          z-index: 1;
          max-width: 600px;
        }
        .sc-hero-tag {
          display: inline-block;
          color: var(--gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .sc-hero h1 {
          color: white;
          font-size: 44px;
          font-weight: 300;
          letter-spacing: -1px;
          margin: 0 0 12px;
        }
        .sc-hero p {
          color: rgba(255,255,255,0.7);
          font-size: 16px;
          margin: 0 0 28px;
        }
        .sc-hero-cta {
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
        .sc-hero-cta:hover {
          background: var(--gold-light);
          color: var(--dark);
        }

        /* Concern Nav */
        .sc-concern-nav {
          background: white;
          border-bottom: 1px solid var(--gray-200);
          position: sticky;
          top: 70px;
          z-index: 80;
        }
        .sc-concern-nav-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          gap: 4px;
          padding: 10px 20px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .sc-concern-tab {
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
        .sc-concern-tab:hover {
          border-color: var(--gray-200);
          color: var(--dark);
        }
        .sc-concern-tab.active {
          background: var(--skincare-green);
          border-color: var(--skincare-green);
          color: white;
        }
        .sc-concern-icon { font-size: 14px; }
        .sc-concern-count {
          font-size: 11px;
          opacity: 0.6;
        }

        /* Container */
        .sc-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 20px;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 36px;
        }

        /* Mobile Filter Toggle */
        .sc-mobile-filter-toggle {
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
        .sc-filter-badge {
          background: var(--skincare-green);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        /* Sidebar */
        .sc-sidebar {
          position: sticky;
          top: 140px;
          height: fit-content;
        }
        .sc-sidebar-backdrop { display: none; }
        .sc-sidebar-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }
        .sc-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--gray-200);
        }
        .sc-sidebar-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .sc-sidebar-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-600);
        }
        .sc-clear-all-btn {
          width: 100%;
          padding: 10px;
          background: var(--gray-100);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          color: var(--skincare-green);
          cursor: pointer;
          margin-bottom: 20px;
        }
        .sc-clear-all-btn:hover { background: var(--gray-200); }

        /* Filter Sections */
        .sc-filter-section {
          margin-bottom: 24px;
        }
        .sc-filter-section h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gray-600);
          margin: 0 0 12px;
        }
        .sc-search-input-wrap {
          position: relative;
        }
        .sc-search-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-400);
        }
        .sc-search-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .sc-search-input-wrap input:focus {
          outline: none;
          border-color: var(--skincare-green);
        }
        .sc-filter-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sc-filter-radio {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          cursor: pointer;
          font-size: 14px;
          color: var(--gray-600);
        }
        .sc-filter-radio input { display: none; }
        .sc-radio-custom {
          width: 16px;
          height: 16px;
          border: 2px solid var(--gray-200);
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .sc-filter-radio input:checked + .sc-radio-custom {
          border-color: var(--skincare-green);
        }
        .sc-filter-radio input:checked + .sc-radio-custom::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 6px;
          height: 6px;
          background: var(--skincare-green);
          border-radius: 50%;
        }
        .sc-filter-radio:hover .sc-radio-label { color: var(--dark); }

        /* Sidebar Quiz CTA */
        .sc-sidebar-quiz-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, var(--skincare-green-light), #F3EDE6);
          border: 1.5px solid var(--skincare-green);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 16px;
          transition: all 0.2s;
        }
        .sc-sidebar-quiz-cta:hover {
          background: var(--skincare-green);
          color: white;
        }
        .sc-sidebar-quiz-cta:hover svg { stroke: white; }
        .sc-sidebar-quiz-cta svg {
          color: var(--skincare-green);
          flex-shrink: 0;
        }
        .sc-sidebar-quiz-cta strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }
        .sc-sidebar-quiz-cta span {
          font-size: 11px;
          opacity: 0.7;
        }

        /* Sidebar Help */
        .sc-sidebar-help {
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
        .sc-sidebar-help svg {
          color: #1B4D4F;
          flex-shrink: 0;
        }

        /* Products Main */
        .sc-products-main { min-height: 600px; }
        .sc-products-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .sc-product-count {
          font-size: 14px;
          color: var(--gray-600);
          margin: 0;
        }
        .sc-sort-select {
          padding: 10px 36px 10px 14px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
          cursor: pointer;
          appearance: none;
        }

        /* Loading & Empty States */
        .sc-loading-state, .sc-empty-state {
          text-align: center;
          padding: 80px 20px;
        }
        .sc-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--gray-200);
          border-top-color: var(--skincare-green);
          border-radius: 50%;
          animation: sc-spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes sc-spin { to { transform: rotate(360deg); } }
        .sc-empty-state svg { color: var(--gray-200); margin-bottom: 16px; }
        .sc-empty-state h3 { margin: 0 0 8px; font-size: 18px; }
        .sc-empty-state p { color: var(--gray-600); margin: 0 0 20px; }
        .sc-empty-state button {
          padding: 12px 28px;
          background: var(--skincare-green);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Products Grid */
        .sc-products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .sc-product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .sc-product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .sc-product-card a { text-decoration: none; color: inherit; }

        /* Card Media */
        .sc-card-media {
          position: relative;
          padding-top: 110%;
          background: linear-gradient(to bottom, var(--gray-100), white);
        }
        .sc-card-media img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 70%;
          max-height: 70%;
          object-fit: contain;
          transition: transform 0.4s;
        }
        .sc-product-card:hover .sc-card-media img {
          transform: translate(-50%, -50%) scale(1.05);
        }
        .sc-card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 4px 10px;
          background: var(--skincare-green);
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px;
        }
        .sc-card-badge.badge-bestseller { background: var(--gold); color: var(--dark); }
        .sc-card-badge.badge-new { background: var(--success); }
        .sc-card-badge.badge-anti_aging { background: #1F3347; }

        /* Wishlist */
        .sc-wishlist-btn {
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
        .sc-wishlist-btn:hover, .sc-wishlist-btn.active { color: #A4443A; }

        /* Card Actions */
        .sc-card-actions {
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
        .sc-product-card:hover .sc-card-actions {
          opacity: 1;
          transform: translateY(0);
        }
        .sc-action-btn {
          padding: 12px;
          background: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sc-action-btn.primary {
          background: var(--skincare-green);
          color: white;
        }

        /* Card Info */
        .sc-card-info {
          padding: 18px;
          text-align: center;
        }
        .sc-card-brand {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .sc-card-name {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 8px;
          min-height: 40px;
          line-height: 1.4;
          color: var(--dark);
        }
        .sc-card-meta {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .sc-card-area {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--skincare-green);
          background: var(--skincare-green-light);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .sc-card-ingredient {
          display: inline-block;
          font-size: 10px;
          font-weight: 500;
          color: var(--gray-400);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sc-card-price {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--dark);
        }

        /* Load More */
        .sc-load-more {
          text-align: center;
          margin-top: 40px;
        }
        .sc-load-more button {
          padding: 14px 40px;
          background: transparent;
          border: 2px solid var(--dark);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sc-load-more button:hover {
          background: var(--dark);
          color: white;
        }

        /* Complete Your Routine Section */
        .sc-routine {
          background: white;
          padding: 60px 20px;
          margin-top: 40px;
        }
        .sc-routine-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .sc-routine-header {
          text-align: center;
          margin-bottom: 48px;
        }
        .sc-routine-tag {
          display: inline-block;
          color: var(--skincare-green);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .sc-routine-header h2 {
          font-size: 32px;
          font-weight: 300;
          color: var(--dark);
          margin: 0 0 10px;
        }
        .sc-routine-header p {
          color: var(--gray-600);
          font-size: 15px;
          margin: 0;
        }
        .sc-routine-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .sc-routine-step {
          text-align: center;
          padding: 28px 20px;
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          position: relative;
        }
        .sc-step-number {
          width: 36px;
          height: 36px;
          background: var(--skincare-green);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          margin: 0 auto 14px;
        }
        .sc-routine-step h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 6px;
          color: var(--dark);
        }
        .sc-routine-step > p {
          font-size: 12px;
          color: var(--gray-600);
          margin: 0 0 16px;
          line-height: 1.4;
        }
        .sc-step-products {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sc-step-product {
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
        .sc-step-product:hover {
          border-color: var(--skincare-green);
          background: var(--skincare-green-light);
        }
        .sc-step-product img {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border-radius: 4px;
        }
        .sc-step-product-name {
          font-size: 12px;
          font-weight: 500;
          flex: 1;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sc-step-product-price {
          font-size: 11px;
          font-weight: 600;
          color: var(--skincare-green);
          white-space: nowrap;
        }
        .sc-step-empty {
          font-size: 11px;
          color: var(--gray-400);
          font-style: italic;
        }

        /* Trust Badges */
        .sc-trust {
          background: var(--dark);
          padding: 40px 20px;
        }
        .sc-trust-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
        }
        .sc-trust-item {
          display: flex;
          align-items: center;
          gap: 14px;
          color: white;
        }
        .sc-trust-item svg {
          color: var(--skincare-green);
          flex-shrink: 0;
          stroke: #C5A55A;
        }
        .sc-trust-item strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .sc-trust-item span {
          font-size: 11px;
          opacity: 0.6;
        }

        /* Quiz Modal */
        .sc-quiz-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .sc-quiz-modal {
          background: white;
          border-radius: 16px;
          max-width: 560px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 40px;
          position: relative;
        }
        .sc-quiz-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-400);
          transition: color 0.2s;
        }
        .sc-quiz-close:hover { color: var(--dark); }

        .sc-quiz-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .sc-quiz-header h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--dark);
        }
        .sc-quiz-header p {
          color: var(--gray-600);
          margin: 0 0 20px;
          font-size: 14px;
        }
        .sc-quiz-progress {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        .sc-quiz-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--gray-200);
          transition: all 0.3s;
        }
        .sc-quiz-dot.active { background: var(--skincare-green); transform: scale(1.2); }
        .sc-quiz-dot.done { background: var(--skincare-green); opacity: 0.5; }

        .sc-quiz-question h3 {
          font-size: 18px;
          font-weight: 500;
          margin: 0 0 20px;
          text-align: center;
          color: var(--dark);
        }
        .sc-quiz-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sc-quiz-option {
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
        .sc-quiz-option:hover {
          border-color: var(--skincare-green);
          background: var(--skincare-green-light);
        }
        .sc-quiz-option.selected {
          border-color: var(--skincare-green);
          background: var(--skincare-green-light);
        }
        .sc-quiz-option strong {
          display: block;
          font-size: 14px;
          margin-bottom: 2px;
          color: var(--dark);
        }
        .sc-quiz-option span {
          font-size: 12px;
          color: var(--gray-600);
        }
        .sc-quiz-back {
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
        .sc-quiz-back:hover { color: var(--dark); }

        /* Quiz Results */
        .sc-quiz-results {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .sc-quiz-result-card {
          border: 1px solid var(--gray-200);
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          color: var(--dark);
          transition: all 0.2s;
        }
        .sc-quiz-result-card:hover {
          border-color: var(--skincare-green);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .sc-quiz-result-img {
          position: relative;
          padding-top: 80%;
          background: var(--gray-100);
        }
        .sc-quiz-result-img img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 65%;
          max-height: 65%;
          object-fit: contain;
        }
        .sc-quiz-match {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 3px 8px;
          background: var(--skincare-green);
          color: white;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
        }
        .sc-quiz-result-info {
          padding: 12px;
          text-align: center;
        }
        .sc-quiz-result-brand {
          display: block;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gold);
          margin-bottom: 4px;
        }
        .sc-quiz-result-info h4 {
          font-size: 12px;
          font-weight: 500;
          margin: 0 0 4px;
          line-height: 1.3;
        }
        .sc-quiz-result-price {
          font-size: 13px;
          font-weight: 600;
          color: var(--skincare-green);
        }

        .sc-quiz-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .sc-quiz-retake {
          padding: 12px 24px;
          background: none;
          border: 1.5px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sc-quiz-retake:hover { border-color: var(--dark); }
        .sc-quiz-close-btn {
          padding: 12px 24px;
          background: var(--skincare-green);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .sc-products-grid { grid-template-columns: repeat(2, 1fr); }
          .sc-trust-inner { grid-template-columns: repeat(2, 1fr); }
          .sc-routine-steps { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 900px) {
          .sc-container { grid-template-columns: 1fr; }
          .sc-mobile-filter-toggle { display: flex; }

          .sc-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            pointer-events: none;
          }
          .sc-sidebar.open { pointer-events: auto; }
          .sc-sidebar-backdrop {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .sc-sidebar.open .sc-sidebar-backdrop { opacity: 1; }
          .sc-sidebar-panel {
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
          .sc-sidebar.open .sc-sidebar-panel { transform: translateX(0); }
          .sc-sidebar-close { display: flex; }

          .sc-concern-nav-inner {
            justify-content: flex-start;
            padding: 10px 16px;
          }
        }

        @media (max-width: 640px) {
          .sc-hero { min-height: 260px; padding: 40px 20px; }
          .sc-hero h1 { font-size: 32px; }
          .sc-hero p { font-size: 14px; }

          .sc-products-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .sc-card-media { padding-top: 120%; }
          .sc-card-info { padding: 12px; }
          .sc-card-name { font-size: 12px; min-height: 34px; }
          .sc-card-price { font-size: 14px; }
          .sc-card-actions { display: none; }

          .sc-routine-steps { grid-template-columns: 1fr; }
          .sc-routine-header h2 { font-size: 24px; }

          .sc-trust-inner {
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .sc-trust-item strong { font-size: 12px; }

          .sc-quiz-modal { padding: 24px; }
          .sc-quiz-results { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .sc-quiz-header h2 { font-size: 20px; }
        }
      `}</style>
    </div>
  )
}

export default Skincare
