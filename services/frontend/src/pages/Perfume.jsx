import { Link, useSearchParams } from 'react-router-dom'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import QuickViewModal from '../components/QuickViewModal'
import { getCategoryHelpUrl } from '../utils/whatsapp'

const API_URL = import.meta.env.VITE_API_URL || ''

// Professional brand options
const brandOptions = ['All', 'Cyzone', 'Esika', "L'Bel", 'Yanbal', 'Avon']

// Product type / concentration options
const productTypes = [
  { id: 'all', name: 'All Types' },
  { id: 'parfum', name: 'Parfum' },
  { id: 'edp', name: 'Eau de Parfum' },
  { id: 'edt', name: 'Eau de Toilette' },
  { id: 'cologne', name: 'Cologne' },
  { id: 'splash', name: 'Body Splash' }
]

// Price range filters
const priceRanges = [
  { id: 'all', name: 'All Prices', min: 0, max: 9999 },
  { id: 'under30', name: 'Under XCG 30', min: 0, max: 30 },
  { id: '30to60', name: 'XCG 30 - 60', min: 30, max: 60 },
  { id: 'over60', name: 'XCG 60+', min: 60, max: 9999 }
]

// Fragrance family options
const fragranceFamilies = [
  { id: 'all', name: 'All Scents' },
  { id: 'floral', name: 'Floral' },
  { id: 'fresh', name: 'Fresh & Citrus' },
  { id: 'oriental', name: 'Oriental' },
  { id: 'woody', name: 'Woody' },
  { id: 'fruity', name: 'Fruity' }
]

// Intensity options
const intensityOptions = [
  { id: 'all', name: 'All Intensities' },
  { id: 'light', name: 'Light' },
  { id: 'moderate', name: 'Moderate' },
  { id: 'intense', name: 'Intense' }
]

// Quiz questions based on luxury fragrance finder best practices
const quizQuestions = [
  {
    id: 'gender',
    question: 'Who is this fragrance for?',
    options: [
      { id: 'women', label: 'For Her', desc: 'Feminine elegance' },
      { id: 'men', label: 'For Him', desc: 'Masculine sophistication' },
      { id: 'unisex', label: 'Anyone', desc: 'Universal appeal' }
    ]
  },
  {
    id: 'occasion',
    question: 'When will you wear it most?',
    options: [
      { id: 'daily', label: 'Everyday', desc: 'Light & versatile' },
      { id: 'office', label: 'Work', desc: 'Subtle & professional' },
      { id: 'evening', label: 'Night Out', desc: 'Bold & captivating' },
      { id: 'romantic', label: 'Special Moments', desc: 'Intimate & memorable' }
    ]
  },
  {
    id: 'scent',
    question: 'Which scent family appeals to you?',
    options: [
      { id: 'floral', label: 'Floral', desc: 'Rose, jasmine, gardenia' },
      { id: 'fresh', label: 'Fresh', desc: 'Citrus, aquatic, green' },
      { id: 'oriental', label: 'Oriental', desc: 'Vanilla, amber, spice' },
      { id: 'woody', label: 'Woody', desc: 'Sandalwood, cedar, oud' }
    ]
  },
  {
    id: 'intensity',
    question: 'How strong do you prefer it?',
    options: [
      { id: 'light', label: 'Subtle', desc: 'Close to skin' },
      { id: 'moderate', label: 'Moderate', desc: 'Noticeable presence' },
      { id: 'intense', label: 'Bold', desc: 'Long-lasting projection' }
    ]
  }
]

function Perfume() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialGender = searchParams.get('gender') || 'all'

  // State
  const [selectedGender, setSelectedGender] = useState(initialGender)
  const [selectedBrand, setSelectedBrand] = useState('All')
  const [selectedPrice, setSelectedPrice] = useState('all')
  const [selectedFragrance, setSelectedFragrance] = useState('all')
  const [selectedIntensity, setSelectedIntensity] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [sortBy, setSortBy] = useState('featured')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [visibleCount, setVisibleCount] = useState(12)
  const [wishlist, setWishlist] = useState([])
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizStep, setQuizStep] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizResults, setQuizResults] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)

  // Fetch products
  const { data: productsData, isLoading } = useProductsByCategory('perfume')

  // Sync URL params
  useEffect(() => {
    const gender = searchParams.get('gender')
    if (gender) setSelectedGender(gender)
  }, [searchParams])

  // Gender change handler
  const handleGenderChange = useCallback((gender) => {
    setSelectedGender(gender)
    if (gender === 'all') {
      searchParams.delete('gender')
    } else {
      searchParams.set('gender', gender)
    }
    setSearchParams(searchParams)
    setVisibleCount(12)
  }, [searchParams, setSearchParams])

  // Wishlist toggle
  const toggleWishlist = (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId])
  }

  // Quiz handlers
  const handleQuizAnswer = (questionId, answerId) => {
    const newAnswers = { ...quizAnswers, [questionId]: answerId }
    setQuizAnswers(newAnswers)

    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(prev => prev + 1)
    } else {
      submitQuiz(newAnswers)
    }
  }

  const submitQuiz = async (answers) => {
    setQuizLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/perfumes/quiz/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      })

      if (!response.ok) throw new Error('Quiz failed')

      const data = await response.json()
      setQuizResults(data)
    } catch (err) {
      console.error('Quiz error:', err)
      // Fallback to local filtering
      const products = productsData?.products || []
      const filtered = products
        .map((p, i) => ({ ...p, matchScore: 90 - i * 2 }))
        .slice(0, 6)

      setQuizResults({
        success: true,
        message: 'Here are our top recommendations for you',
        recommendations: filtered
      })
    }
    setQuizLoading(false)
  }

  const resetQuiz = (keepAnswers = false) => {
    setQuizStep(0)
    if (!keepAnswers) setQuizAnswers({})
    setQuizResults(null)
    setShowQuiz(false)
  }

  const goBackInQuiz = () => {
    if (quizStep > 0) {
      setQuizStep(prev => prev - 1)
    }
  }

  // Gender counts for tabs
  const genderCounts = useMemo(() => {
    const products = productsData?.products || []
    return {
      all: products.length,
      women: products.filter(p => p.gender === 'women').length,
      men: products.filter(p => p.gender === 'men').length
    }
  }, [productsData])

  // Check which filters have data
  const hasFragranceData = useMemo(() => {
    const products = productsData?.products || []
    return products.some(p => p.fragranceFamily)
  }, [productsData])

  const hasIntensityData = useMemo(() => {
    const products = productsData?.products || []
    return products.some(p => p.intensity)
  }, [productsData])

  // Available product types based on actual data
  const availableTypes = useMemo(() => {
    const products = productsData?.products || []
    const types = new Set(products.map(p => p.concentration).filter(Boolean))
    return productTypes.filter(t => t.id === 'all' || types.has(t.id))
  }, [productsData])

  // Filter products
  const filteredProducts = useMemo(() => {
    let products = productsData?.products || []

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      products = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        (typeof p.brand === 'object' ? p.brand?.name : p.brand || '').toLowerCase().includes(query)
      )
    }

    // Gender filter - use database field
    if (selectedGender !== 'all') {
      products = products.filter(p => p.gender === selectedGender)
    }

    // Brand filter
    if (selectedBrand !== 'All') {
      products = products.filter(p => {
        const brandName = typeof p.brand === 'object' ? p.brand?.name : p.brand
        return brandName?.toLowerCase().includes(selectedBrand.toLowerCase())
      })
    }

    // Price filter
    if (selectedPrice !== 'all') {
      const range = priceRanges.find(r => r.id === selectedPrice)
      if (range) {
        products = products.filter(p => p.price >= range.min && p.price <= range.max)
      }
    }

    // Fragrance family filter — match by field OR by keyword in name/description
    if (selectedFragrance !== 'all') {
      const scentKeywords = {
        floral: ['floral', 'flower', 'rose', 'jasmine', 'gardenia', 'lily', 'rosa', 'jazmin'],
        fresh: ['fresh', 'citrus', 'aquatic', 'marine', 'green', 'limon', 'citric', 'fresco'],
        oriental: ['oriental', 'vanilla', 'vainilla', 'amber', 'ambar', 'spice', 'warm', 'musk'],
        woody: ['woody', 'wood', 'sandal', 'cedar', 'oud', 'madera', 'sandalwood']
      }
      const keywords = scentKeywords[selectedFragrance] || []
      products = products.filter(p => {
        if (p.fragranceFamily === selectedFragrance) return true
        if (keywords.length === 0) return true
        const text = ((p.name || '') + ' ' + (p.description || '')).toLowerCase()
        return keywords.some(k => text.includes(k))
      })
    }

    // Intensity filter — match by field OR infer from concentration/type
    if (selectedIntensity !== 'all') {
      const intensityMap = {
        light: ['splash', 'cologne', 'body mist', 'body splash', 'suave'],
        moderate: ['edt', 'eau de toilette', 'toilette'],
        intense: ['edp', 'parfum', 'eau de parfum', 'intense', 'intenso']
      }
      const keywords = intensityMap[selectedIntensity] || []
      products = products.filter(p => {
        if (p.intensity === selectedIntensity) return true
        if (keywords.length === 0) return true
        const text = ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.concentration || '')).toLowerCase()
        return keywords.some(k => text.includes(k))
      })
    }

    // Product type / concentration filter
    if (selectedType !== 'all') {
      products = products.filter(p => p.concentration === selectedType)
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
  }, [productsData, selectedGender, selectedBrand, selectedPrice, selectedFragrance, selectedIntensity, selectedType, sortBy, searchQuery])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Add to cart
  const handleAddToCart = (e, product) => {
    e.preventDefault()
    e.stopPropagation()
    cartStore.addItem(product, 1)
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedGender('all')
    setSelectedBrand('All')
    setSelectedPrice('all')
    setSelectedFragrance('all')
    setSelectedIntensity('all')
    setSelectedType('all')
    setSearchQuery('')
    searchParams.delete('gender')
    setSearchParams(searchParams)
  }

  const activeFiltersCount = [
    selectedGender !== 'all',
    selectedBrand !== 'All',
    selectedPrice !== 'all',
    selectedFragrance !== 'all',
    selectedIntensity !== 'all',
    selectedType !== 'all',
    searchQuery.trim() !== ''
  ].filter(Boolean).length

  return (
    <div className="perfume-page">
      {/* Hero Section */}
      <section className="perfume-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <span className="hero-tag">Premium Collection</span>
          <h1>Luxury Fragrances</h1>
          <p>Discover authentic perfumes from Colombia's finest brands</p>
          <button className="hero-cta" onClick={() => setShowQuiz(true)}>
            Find Your Signature Scent
          </button>
        </div>
      </section>

      {/* Gender Navigation */}
      <nav className="gender-nav">
        <div className="gender-nav-inner">
          {[
            { id: 'all', label: 'All Fragrances', count: genderCounts.all },
            { id: 'women', label: 'For Her', count: genderCounts.women },
            { id: 'men', label: 'For Him', count: genderCounts.men }
          ].map(tab => (
            <button
              key={tab.id}
              className={`gender-btn ${selectedGender === tab.id ? 'active' : ''}`}
              onClick={() => handleGenderChange(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span className="gender-count">{tab.count}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Layout */}
      <div className="perfume-container">
        {/* Mobile Filter Toggle */}
        <button className="mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Filters {activeFiltersCount > 0 && <span className="filter-badge">{activeFiltersCount}</span>}
        </button>

        {/* Sidebar Filters */}
        <aside className={`sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
          <div className="sidebar-backdrop" onClick={() => setMobileFiltersOpen(false)} />
          <div className="sidebar-panel">
            <div className="sidebar-header">
              <h3>Filters</h3>
              <button className="sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <button className="clear-all-btn" onClick={clearFilters}>
                Clear All Filters ({activeFiltersCount})
              </button>
            )}

            {/* Search */}
            <div className="filter-section">
              <h4>Search</h4>
              <div className="search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search fragrances..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Brand Filter */}
            <div className="filter-section">
              <h4>Brand</h4>
              <div className="filter-options">
                {brandOptions.map(brand => (
                  <label key={brand} className="filter-radio">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === brand}
                      onChange={() => setSelectedBrand(brand)}
                    />
                    <span className="radio-custom" />
                    <span className="radio-label">{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className="filter-section">
              <h4>Price Range</h4>
              <div className="filter-options">
                {priceRanges.map(range => (
                  <label key={range.id} className="filter-radio">
                    <input
                      type="radio"
                      name="price"
                      checked={selectedPrice === range.id}
                      onChange={() => setSelectedPrice(range.id)}
                    />
                    <span className="radio-custom" />
                    <span className="radio-label">{range.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Product Type Filter */}
            {availableTypes.length > 2 && (
              <div className="filter-section">
                <h4>Type</h4>
                <div className="filter-options">
                  {availableTypes.map(type => (
                    <label key={type.id} className="filter-radio">
                      <input
                        type="radio"
                        name="productType"
                        checked={selectedType === type.id}
                        onChange={() => setSelectedType(type.id)}
                      />
                      <span className="radio-custom" />
                      <span className="radio-label">{type.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Fragrance Family Filter */}
            <div className="filter-section">
              <h4>Scent Family</h4>
                <div className="filter-options">
                  {fragranceFamilies.map(family => (
                    <label key={family.id} className="filter-radio">
                      <input
                        type="radio"
                        name="fragrance"
                        checked={selectedFragrance === family.id}
                        onChange={() => setSelectedFragrance(family.id)}
                      />
                      <span className="radio-custom" />
                      <span className="radio-label">{family.name}</span>
                    </label>
                  ))}
                </div>
              </div>

            {/* Intensity Filter */}
            <div className="filter-section">
              <h4>Intensity</h4>
                <div className="filter-options">
                  {intensityOptions.map(opt => (
                    <label key={opt.id} className="filter-radio">
                      <input
                        type="radio"
                        name="intensity"
                        checked={selectedIntensity === opt.id}
                        onChange={() => setSelectedIntensity(opt.id)}
                      />
                      <span className="radio-custom" />
                      <span className="radio-label">{opt.name}</span>
                    </label>
                  ))}
                </div>
              </div>

            {/* Quiz CTA */}
            <div className="sidebar-quiz-cta">
              <div className="quiz-cta-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h5>Not Sure What to Choose?</h5>
              <p>Take our fragrance quiz to find your perfect match</p>
              <button onClick={() => { setShowQuiz(true); setMobileFiltersOpen(false); }}>
                Start Quiz
              </button>
            </div>

            {/* WhatsApp Help */}
            <a href={getCategoryHelpUrl('perfume')} className="sidebar-help-link" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Need help? Chat with us</span>
            </a>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          {/* Toolbar */}
          <div className="products-toolbar">
            <p className="product-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'fragrance' : 'fragrances'}
            </p>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading fragrances...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3>No fragrances found</h3>
              <p>Try adjusting your filters or search query</p>
              <button onClick={clearFilters}>Clear Filters</button>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && filteredProducts.length > 0 && (
            <div className="products-grid">
              {visibleProducts.map(product => {
                const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand
                const isWishlisted = wishlist.includes(product.id)

                return (
                  <article key={product.id} className="product-card">
                    <Link to={`/product/${product.id}`}>
                      <div className="card-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = '/images/placeholder-perfume.svg' }}
                        />
                        {product.badge && (
                          <span className={`card-badge badge-${product.badge}`}>
                            {product.badge === 'new' ? 'New' : product.badge === 'bestseller' ? 'Bestseller' : product.badge}
                          </span>
                        )}
                        <button
                          className={`wishlist-btn ${isWishlisted ? 'active' : ''}`}
                          onClick={(e) => toggleWishlist(e, product.id)}
                          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        <div className="card-actions">
                          <button
                            className="action-btn"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product) }}
                          >
                            Quick View
                          </button>
                          <button
                            className="action-btn primary"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                      <div className="card-info">
                        {brandName && <span className="card-brand">{brandName}</span>}
                        <h3 className="card-name">{product.name}</h3>
                        {product.concentration && (
                          <span className={`card-type ${product.concentration === 'splash' ? 'type-splash' : ''}`}>
                            {product.concentration === 'parfum' ? 'Parfum'
                              : product.concentration === 'edp' ? 'EDP'
                              : product.concentration === 'edt' ? 'EDT'
                              : product.concentration === 'cologne' ? 'Cologne'
                              : product.concentration === 'splash' ? 'Body Splash'
                              : product.concentration}
                          </span>
                        )}
                        <p className="card-price">XCG {product.price.toFixed(2)}</p>
                      </div>
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="load-more">
              <button onClick={() => setVisibleCount(prev => prev + 12)}>
                Load More ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Trust Badges */}
      <section className="trust-section">
        <div className="trust-inner">
          <div className="trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>100% Authentic</span>
          </div>
          <div className="trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span>Free Delivery 80+</span>
          </div>
          <div className="trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Easy Returns</span>
          </div>
          <div className="trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secure Payment</span>
          </div>
        </div>
      </section>

      {/* Quiz Modal */}
      {showQuiz && createPortal(
        <div className="quiz-overlay" onClick={(e) => e.target === e.currentTarget && resetQuiz()}>
          <div className="quiz-modal">
            <button className="quiz-close" onClick={resetQuiz} aria-label="Close quiz">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!quizResults ? (
              <div className="quiz-content">
                <div className="quiz-header">
                  <h2>Find Your Signature Scent</h2>
                  <p>Answer {quizQuestions.length} quick questions</p>
                </div>

                <div className="quiz-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((quizStep + 1) / quizQuestions.length) * 100}%` }} />
                  </div>
                  <span className="progress-text">{quizStep + 1} of {quizQuestions.length}</span>
                </div>

                <div className="quiz-question">
                  <h3>{quizQuestions[quizStep].question}</h3>
                </div>

                <div className="quiz-options">
                  {quizQuestions[quizStep].options.map(opt => (
                    <button
                      key={opt.id}
                      className={`quiz-option ${quizAnswers[quizQuestions[quizStep].id] === opt.id ? 'selected' : ''}`}
                      onClick={() => handleQuizAnswer(quizQuestions[quizStep].id, opt.id)}
                      disabled={quizLoading}
                    >
                      <span className="option-label">{opt.label}</span>
                      <span className="option-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {quizStep > 0 && (
                  <button className="quiz-back" onClick={goBackInQuiz}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back
                  </button>
                )}

                {quizLoading && (
                  <div className="quiz-loading">
                    <div className="spinner" />
                    <p>Finding your perfect matches...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="quiz-results">
                <div className="results-header">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C5A55A" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2>Your Perfect Matches</h2>
                  <p>{quizResults.message}</p>
                </div>

                <div className="results-grid">
                  {quizResults.recommendations?.slice(0, 6).map(product => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      className="result-card"
                      onClick={resetQuiz}
                    >
                      <div className="result-image">
                        <img src={product.image} alt={product.name} />
                        {product.matchScore && (
                          <span className="match-badge">{product.matchScore}% Match</span>
                        )}
                      </div>
                      <div className="result-info">
                        {product.brand && <span className="result-brand">{product.brand}</span>}
                        <h4>{product.name}</h4>
                        <span className="result-price">XCG {product.price?.toFixed(2)}</span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="results-actions">
                  <button className="btn-secondary" onClick={() => { setQuizResults(null); setQuizStep(0); setQuizAnswers({}) }}>
                    Retake Quiz
                  </button>
                  <button className="btn-primary" onClick={() => {
                    // Apply quiz answers as filters to the main product grid
                    if (quizAnswers.gender && quizAnswers.gender !== 'unisex') {
                      handleGenderChange(quizAnswers.gender)
                    }
                    if (quizAnswers.scent && quizAnswers.scent !== 'all') {
                      setSelectedFragrance(quizAnswers.scent)
                    }
                    if (quizAnswers.intensity && quizAnswers.intensity !== 'all') {
                      setSelectedIntensity(quizAnswers.intensity)
                    }
                    resetQuiz(true) // keep answers so filters stay applied
                  }}>
                    Shop These Results
                  </button>
                  <button className="btn-secondary" onClick={() => resetQuiz(false)} style={{ marginTop: '8px' }}>
                    Browse All Fragrances
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />

      <style>{`
        /* Variables */
        .perfume-page {
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
        .perfume-hero {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 60px 20px;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #1F3347 50%, #1B4D4F 100%);
        }
        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 600px;
        }
        .hero-tag {
          display: inline-block;
          color: var(--gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .perfume-hero h1 {
          color: white;
          font-size: 44px;
          font-weight: 300;
          letter-spacing: -1px;
          margin: 0 0 12px;
        }
        .perfume-hero p {
          color: rgba(255,255,255,0.7);
          font-size: 16px;
          margin: 0 0 28px;
        }
        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 32px;
          background: var(--gold);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .hero-cta:hover {
          background: var(--gold-light);
          transform: translateY(-2px);
        }

        /* Gender Navigation */
        .gender-nav {
          background: white;
          border-bottom: 1px solid var(--gray-200);
          position: sticky;
          top: 70px;
          z-index: 80;
        }
        .gender-nav-inner {
          max-width: 500px;
          margin: 0 auto;
          display: flex;
        }
        .gender-btn {
          flex: 1;
          padding: 18px 16px;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-600);
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }
        .gender-btn:hover {
          color: var(--dark);
        }
        .gender-btn.active {
          color: var(--dark);
        }
        .gender-btn.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: var(--gold);
        }
        .gender-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 20px;
          padding: 0 6px;
          margin-left: 6px;
          background: var(--gray-200);
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--gray-600);
        }
        .gender-btn.active .gender-count {
          background: var(--gold);
          color: white;
        }

        /* Container */
        .perfume-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 20px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 40px;
        }

        /* Mobile Filter Toggle */
        .mobile-filter-toggle {
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
        .filter-badge {
          background: var(--gold);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        /* Sidebar */
        .sidebar {
          position: sticky;
          top: 140px;
          height: fit-content;
        }
        .sidebar-backdrop {
          display: none;
        }
        .sidebar-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--gray-200);
        }
        .sidebar-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .sidebar-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-600);
        }
        .clear-all-btn {
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
        .clear-all-btn:hover {
          background: var(--gray-200);
        }

        /* Filter Sections */
        .filter-section {
          margin-bottom: 24px;
        }
        .filter-section h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gray-600);
          margin: 0 0 12px;
        }
        .search-input-wrap {
          position: relative;
        }
        .search-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-400);
        }
        .search-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 14px;
        }
        .search-input-wrap input:focus {
          outline: none;
          border-color: var(--gold);
        }
        .filter-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .filter-radio {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          cursor: pointer;
          font-size: 14px;
          color: var(--gray-600);
        }
        .filter-radio input {
          display: none;
        }
        .radio-custom {
          width: 16px;
          height: 16px;
          border: 2px solid var(--gray-200);
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .filter-radio input:checked + .radio-custom {
          border-color: var(--gold);
        }
        .filter-radio input:checked + .radio-custom::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 6px;
          height: 6px;
          background: var(--gold);
          border-radius: 50%;
        }
        .filter-radio:hover .radio-label {
          color: var(--dark);
        }

        /* Sidebar Quiz CTA */
        .sidebar-quiz-cta {
          background: var(--dark);
          color: white;
          padding: 24px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 16px;
        }
        .quiz-cta-icon {
          color: var(--gold);
          margin-bottom: 12px;
        }
        .sidebar-quiz-cta h5 {
          font-size: 14px;
          margin: 0 0 6px;
        }
        .sidebar-quiz-cta p {
          font-size: 12px;
          opacity: 0.7;
          margin: 0 0 16px;
        }
        .sidebar-quiz-cta button {
          width: 100%;
          padding: 12px;
          background: var(--gold);
          color: var(--dark);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Sidebar Help */
        .sidebar-help-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #F3EDE6;
          border-radius: 10px;
          text-decoration: none;
          color: #1B4D4F;
          font-size: 13px;
        }
        .sidebar-help-link svg {
          color: #1B4D4F;
          flex-shrink: 0;
        }

        /* Products Main */
        .products-main {
          min-height: 600px;
        }
        .products-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .product-count {
          font-size: 14px;
          color: var(--gray-600);
          margin: 0;
        }
        .sort-select {
          padding: 10px 36px 10px 14px;
          border: 1px solid var(--gray-200);
          border-radius: 6px;
          font-size: 13px;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
          cursor: pointer;
          appearance: none;
        }

        /* Loading & Empty States */
        .loading-state, .empty-state {
          text-align: center;
          padding: 80px 20px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--gray-200);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-state svg {
          color: var(--gray-200);
          margin-bottom: 16px;
        }
        .empty-state h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .empty-state p {
          color: var(--gray-600);
          margin: 0 0 20px;
        }
        .empty-state button {
          padding: 12px 28px;
          background: var(--gold);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Products Grid */
        .products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .product-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .product-card a {
          text-decoration: none;
          color: inherit;
        }
        .card-media {
          position: relative;
          padding-top: 110%;
          background: linear-gradient(to bottom, var(--gray-100), white);
        }
        .card-media img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 75%;
          max-height: 75%;
          object-fit: contain;
          transition: transform 0.4s;
        }
        .product-card:hover .card-media img {
          transform: translate(-50%, -50%) scale(1.05);
        }
        .card-badge {
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
        .card-badge.badge-bestseller {
          background: var(--gold);
          color: var(--dark);
        }
        .card-badge.badge-new {
          background: var(--success);
        }
        .wishlist-btn {
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
        .wishlist-btn:hover, .wishlist-btn.active {
          color: #A4443A;
        }
        .card-actions {
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
        .product-card:hover .card-actions {
          opacity: 1;
          transform: translateY(0);
        }
        .action-btn {
          padding: 12px;
          background: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn.primary {
          background: var(--gold);
          color: white;
        }
        .card-info {
          padding: 18px;
          text-align: center;
        }
        .card-brand {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .card-name {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 8px;
          min-height: 40px;
          line-height: 1.4;
          color: var(--dark);
        }
        .card-type {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--gray-400);
          margin-bottom: 6px;
        }
        .card-type.type-splash {
          color: #1B4D4F;
        }
        .card-price {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: var(--dark);
        }

        /* Load More */
        .load-more {
          text-align: center;
          margin-top: 40px;
        }
        .load-more button {
          padding: 14px 40px;
          background: transparent;
          border: 2px solid var(--dark);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .load-more button:hover {
          background: var(--dark);
          color: white;
        }

        /* Trust Section */
        .trust-section {
          background: var(--dark);
          padding: 40px 20px;
          margin-top: 60px;
        }
        .trust-inner {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          gap: 60px;
          flex-wrap: wrap;
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
          font-size: 13px;
          font-weight: 500;
        }
        .trust-item svg {
          color: var(--gold);
        }

        /* Quiz Modal */
        .quiz-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .quiz-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }
        .quiz-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          background: var(--gray-100);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-600);
          z-index: 5;
        }
        .quiz-content {
          padding: 40px 32px;
        }
        .quiz-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .quiz-header h2 {
          font-size: 24px;
          margin: 0 0 8px;
        }
        .quiz-header p {
          color: var(--gray-600);
          margin: 0;
        }
        .quiz-progress {
          margin-bottom: 32px;
        }
        .progress-bar {
          height: 4px;
          background: var(--gray-200);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .progress-fill {
          height: 100%;
          background: var(--gold);
          transition: width 0.3s;
        }
        .progress-text {
          font-size: 12px;
          color: var(--gray-400);
        }
        .quiz-question {
          margin-bottom: 24px;
        }
        .quiz-question h3 {
          font-size: 20px;
          text-align: center;
          margin: 0;
        }
        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .quiz-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 18px 20px;
          background: var(--gray-100);
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .quiz-option:hover {
          border-color: var(--gold);
          background: white;
        }
        .quiz-option.selected {
          border-color: var(--gold);
          background: #FAF8F5;
        }
        .option-label {
          font-size: 15px;
          font-weight: 600;
          color: var(--dark);
        }
        .option-desc {
          font-size: 13px;
          color: var(--gray-600);
          margin-top: 4px;
        }
        .quiz-back {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          padding: 10px 16px;
          background: none;
          border: none;
          color: var(--gray-600);
          font-size: 13px;
          cursor: pointer;
        }
        .quiz-loading {
          text-align: center;
          padding: 30px;
        }

        /* Quiz Results */
        .quiz-results {
          padding: 40px 24px;
        }
        .results-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .results-header h2 {
          font-size: 22px;
          margin: 16px 0 8px;
        }
        .results-header p {
          color: var(--gray-600);
          font-size: 14px;
          margin: 0;
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        .result-card {
          text-decoration: none;
          color: inherit;
          background: var(--gray-100);
          border-radius: 10px;
          overflow: hidden;
          transition: transform 0.2s;
        }
        .result-card:hover {
          transform: translateY(-4px);
        }
        .result-image {
          position: relative;
          padding-top: 100%;
          background: white;
        }
        .result-image img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 70%;
          max-height: 70%;
          object-fit: contain;
        }
        .match-badge {
          position: absolute;
          top: 6px;
          left: 6px;
          padding: 3px 8px;
          background: var(--gold);
          color: white;
          font-size: 9px;
          font-weight: 600;
          border-radius: 4px;
        }
        .result-info {
          padding: 12px 10px;
          text-align: center;
        }
        .result-brand {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--gold);
        }
        .result-info h4 {
          font-size: 11px;
          font-weight: 500;
          margin: 4px 0 6px;
          line-height: 1.3;
          min-height: 28px;
        }
        .result-price {
          font-size: 13px;
          font-weight: 600;
        }
        .results-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .btn-secondary, .btn-primary {
          padding: 14px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-secondary {
          background: white;
          border: 2px solid var(--gray-200);
          color: var(--dark);
        }
        .btn-primary {
          background: var(--gold);
          border: none;
          color: white;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .products-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 900px) {
          .perfume-container { grid-template-columns: 1fr; }
          .mobile-filter-toggle { display: flex; }

          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            pointer-events: none;
          }
          .sidebar.open { pointer-events: auto; }
          .sidebar-backdrop {
            display: block;
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .sidebar.open .sidebar-backdrop { opacity: 1; }
          .sidebar-panel {
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
          .sidebar.open .sidebar-panel { transform: translateX(0); }
          .sidebar-close { display: flex; }
        }

        @media (max-width: 640px) {
          .perfume-hero h1 { font-size: 32px; }
          .perfume-hero p { font-size: 14px; }
          .hero-cta { padding: 14px 24px; font-size: 13px; }

          .products-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .results-grid { grid-template-columns: repeat(2, 1fr); }

          .trust-inner { gap: 30px; }
          .trust-item span { display: none; }

          .quiz-content, .quiz-results { padding: 32px 20px; }
          .quiz-header h2 { font-size: 20px; }
          .quiz-question h3 { font-size: 18px; }
        }
      `}</style>
    </div>
  )
}

export default Perfume
