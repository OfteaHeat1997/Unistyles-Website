import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useProductsByCategory, useCategory } from '../hooks/useProducts'
import QuickViewModal from '../components/QuickViewModal'

// Map breadcrumb names to their first category link
const breadcrumbLinks = {
  'Lingerie': '/bras',
  'Beauty': '/perfume',
  'Accessories': '/accesorios'
}

// Color options for filter (with hex values for swatches)
const colorOptions = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Beige', hex: '#E8D4B8' },
  { name: 'Pink', hex: '#F5C6D6' },
  { name: 'Red', hex: '#C41E3A' },
  { name: 'Blue', hex: '#4A90D9' }
]

// Size options for bras
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const cupSizeOptions = ['A', 'B', 'C', 'D', 'DD', 'E']

// Style options for bras
const styleOptions = ['Push-Up', 'Wireless', 'Sports', 'Strapless', 'Full Coverage', 'Balconette']

// Wishlist persistence via localStorage
function getStoredWishlist() {
  try {
    return JSON.parse(localStorage.getItem('unistyles_wishlist') || '[]')
  } catch { return [] }
}
function saveWishlist(items) {
  localStorage.setItem('unistyles_wishlist', JSON.stringify(items))
}

function Category({ category }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy] = useState('bestselling')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [wishlist, setWishlist] = useState(getStoredWishlist)
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])
  const [selectedStyles, setSelectedStyles] = useState([])
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [selectedBrands, setSelectedBrands] = useState([])
  const [quickAddProduct, setQuickAddProduct] = useState(null)
  const [visibleCount, setVisibleCount] = useState(9)

  // Fetch category and products from Strapi (with fallback to local data)
  const { data: categoryData, isLoading: categoryLoading } = useCategory(category)
  const { data: productsData, isLoading: productsLoading } = useProductsByCategory(category)

  // Build data structure similar to old format for compatibility
  const data = useMemo(() => {
    if (!categoryData) {
      return { title: 'Products', description: '', breadcrumb: '', products: [], filters: ['All'], filterType: 'category' }
    }
    return {
      title: categoryData.name,
      description: categoryData.description,
      breadcrumb: categoryData.breadcrumb,
      filterType: categoryData.filterType,
      filters: categoryData.filters || ['All'],
      products: productsData?.products || []
    }
  }, [categoryData, productsData])

  // Toggle wishlist (persisted to localStorage)
  const toggleWishlist = (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    setWishlist(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
      saveWishlist(next)
      return next
    })
  }

  // Toggle color filter
  const toggleColor = (colorName) => {
    setSelectedColors(prev =>
      prev.includes(colorName)
        ? prev.filter(c => c !== colorName)
        : [...prev, colorName]
    )
  }

  // Toggle size filter
  const toggleSize = (size) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    )
  }

  // Toggle style filter
  const toggleStyle = (style) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    )
  }

  // Toggle brand filter
  const toggleBrand = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    )
  }

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let products = data.products

    // Apply tab filter
    if (activeFilter !== 'All') {
      products = products.filter(p => {
        if (data.filterType === 'size') return p.size?.includes(activeFilter)
        if (data.filterType === 'style') return p.style === activeFilter
        if (data.filterType === 'category') return p.category === activeFilter
        return true
      })
    }

    // Apply color filter
    if (selectedColors.length > 0) {
      products = products.filter(p =>
        selectedColors.some(c => p.color?.toLowerCase().includes(c.toLowerCase()))
      )
    }

    // Apply size filter
    if (selectedSizes.length > 0) {
      products = products.filter(p =>
        selectedSizes.some(s => p.size?.toUpperCase().includes(s.toUpperCase()))
      )
    }

    // Apply style filter
    if (selectedStyles.length > 0) {
      products = products.filter(p =>
        selectedStyles.some(s => p.style?.toLowerCase().includes(s.toLowerCase()))
      )
    }

    // Apply brand filter
    if (selectedBrands.length > 0) {
      products = products.filter(p => {
        const brandName = typeof p.brand === 'object' ? p.brand?.name : p.brand
        return selectedBrands.includes(brandName)
      })
    }

    // Apply price range filter
    if (priceMin !== '') {
      const min = parseFloat(priceMin)
      if (!isNaN(min)) products = products.filter(p => parseFloat(p.price) >= min)
    }
    if (priceMax !== '') {
      const max = parseFloat(priceMax)
      if (!isNaN(max)) products = products.filter(p => parseFloat(p.price) <= max)
    }

    // Apply sort
    const sorted = [...products]
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        break
      case 'price-high':
        sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        break
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        break
      case 'bestselling':
      default:
        sorted.sort((a, b) => (b.badge === 'Bestseller' ? 1 : 0) - (a.badge === 'Bestseller' ? 1 : 0))
        break
    }

    return sorted
  }, [data.products, data.filterType, activeFilter, sortBy, selectedColors, selectedSizes, selectedStyles, selectedBrands, priceMin, priceMax])

  // Visible products (for load more)
  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  const isLoading = categoryLoading || productsLoading

  // Generate star rating
  const renderStars = (rating = 4.5) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<i key={i} className="fas fa-star"></i>)
      } else if (i === fullStars && hasHalf) {
        stars.push(<i key={i} className="fas fa-star-half-alt"></i>)
      } else {
        stars.push(<i key={i} className="far fa-star"></i>)
      }
    }
    return stars
  }

  // Get mock color variants for product
  const getProductColors = (product) => {
    // Return mock colors based on product
    const colors = [
      { name: 'Black', hex: '#000000' },
      { name: 'Beige', hex: '#E8D4B8' }
    ]
    if (product.color?.toLowerCase().includes('pink')) {
      colors.push({ name: 'Pink', hex: '#F5C6D6' })
    }
    if (product.color?.toLowerCase().includes('white')) {
      colors.unshift({ name: 'White', hex: '#FFFFFF' })
    }
    return colors.slice(0, 4)
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <div className="breadcrumb-content">
          <Link to="/">Home</Link>
          <span>/</span>
          {breadcrumbLinks[data.breadcrumb] ? (
            <Link to={breadcrumbLinks[data.breadcrumb]}>{data.breadcrumb}</Link>
          ) : (
            <span>{data.breadcrumb}</span>
          )}
          <span>/</span>
          <span style={{ color: 'var(--charcoal)' }}>{data.title}</span>
        </div>
      </nav>

      {/* Bra Fit Quiz Banner */}
      <div className="fit-quiz-banner">
        <div className="fit-quiz-content">
          <div className="fit-quiz-icon">
            <i className="fas fa-ruler"></i>
          </div>
          <div className="fit-quiz-text">
            <h4>Find Your Perfect Fit</h4>
            <p>Take our quick quiz to discover your ideal bra size and style</p>
          </div>
          <button className="fit-quiz-btn">Take the Quiz</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-container">
        {/* Sidebar Filters */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>Filter By</h3>
            <button className="clear-filters" onClick={() => {
              setSelectedColors([])
              setSelectedSizes([])
              setSelectedStyles([])
              setSelectedBrands([])
              setPriceMin('')
              setPriceMax('')
              setActiveFilter('All')
            }}>Clear All</button>
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <h4>Category</h4>
            <div className="filter-options">
              <div className="filter-option">
                <input type="checkbox" id="cat-current" defaultChecked />
                <label htmlFor="cat-current">{data.title}</label>
                <span className="count">({data.products.length})</span>
              </div>
            </div>
          </div>

          {/* Size Filter */}
          <div className="filter-group">
            <h4>Size</h4>
            <div className="size-filter-grid">
              {sizeOptions.map(size => (
                <button
                  key={size}
                  className={`size-filter-btn ${selectedSizes.includes(size) ? 'active' : ''}`}
                  onClick={() => toggleSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Cup Size Filter */}
          <div className="filter-group">
            <h4>Cup Size</h4>
            <div className="size-filter-grid">
              {cupSizeOptions.map(cup => (
                <button
                  key={cup}
                  className={`size-filter-btn ${selectedSizes.includes(cup) ? 'active' : ''}`}
                  onClick={() => toggleSize(cup)}
                >
                  {cup}
                </button>
              ))}
            </div>
          </div>

          {/* Style Filter */}
          <div className="filter-group">
            <h4>Style</h4>
            <div className="filter-options">
              {styleOptions.map(style => (
                <div className="filter-option" key={style}>
                  <input
                    type="checkbox"
                    id={`style-${style}`}
                    checked={selectedStyles.includes(style)}
                    onChange={() => toggleStyle(style)}
                  />
                  <label htmlFor={`style-${style}`}>{style}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Color Filter with Swatches */}
          <div className="filter-group">
            <h4>Color</h4>
            <div className="color-swatch-filter">
              {colorOptions.map(color => (
                <button
                  key={color.name}
                  className={`color-swatch-btn ${selectedColors.includes(color.name) ? 'active' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => toggleColor(color.name)}
                  title={color.name}
                >
                  {selectedColors.includes(color.name) && (
                    <i className="fas fa-check"></i>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Filter */}
          <div className="filter-group">
            <h4>Brand</h4>
            <div className="filter-options">
              {[...new Set(data.products.map(p => typeof p.brand === 'object' ? p.brand?.name : p.brand).filter(Boolean))].map(brandName => (
                <div className="filter-option" key={brandName}>
                  <input
                    type="checkbox"
                    id={`brand-${brandName}`}
                    checked={selectedBrands.length === 0 || selectedBrands.includes(brandName)}
                    onChange={() => toggleBrand(brandName)}
                  />
                  <label htmlFor={`brand-${brandName}`}>{brandName}</label>
                  <span className="count">({data.products.filter(p => (typeof p.brand === 'object' ? p.brand?.name : p.brand) === brandName).length})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div className="filter-group">
            <h4>Price (XCG)</h4>
            <div className="price-range">
              <div className="price-inputs">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Min"
                  min="0"
                  style={{ width: '80px' }}
                />
                <span>-</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Max"
                  min="0"
                  style={{ width: '80px' }}
                />
              </div>
              {priceMin || priceMax ? (
                <button
                  className="clear-filters"
                  style={{ fontSize: '11px', marginTop: '8px' }}
                  onClick={() => { setPriceMin(''); setPriceMax('') }}
                >
                  Clear price filter
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Results Header */}
          <div className="results-header">
            <div className="results-count">
              <span className="count-number">{filteredProducts.length}</span> products found
            </div>
            <div className="view-sort-controls">
              <div className="view-toggle">
                <button className="view-btn active" title="Grid View">
                  <i className="fas fa-th"></i>
                </button>
                <button className="view-btn" title="List View">
                  <i className="fas fa-list"></i>
                </button>
              </div>
              <div className="sort-dropdown">
                <label htmlFor="sort">Sort By:</label>
                <select id="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="bestselling">Best Selling</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="filter-tabs">
            <div className="size-tabs">
              {data.filters?.map(filter => (
                <button
                  key={filter}
                  className={`size-tab ${activeFilter === filter ? 'active' : ''}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="products-grid">
            {visibleProducts.map((product) => {
              const hasDiscount = product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
              const discountPercent = hasDiscount
                ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
                : 0
              const productColors = getProductColors(product)
              const isWishlisted = wishlist.includes(product.id)

              return (
                <div className="product-card-wrapper" key={product.id}>
                  <Link to={`/product/${product.id}`} className="product-card">
                    <div className="product-image">
                      <img src={product.image} alt={product.name} />

                      {/* Badges */}
                      <div className="badge-stack">
                        {product.badge === 'New' && (
                          <span className="product-badge new">New</span>
                        )}
                        {product.badge === 'Bestseller' && (
                          <span className="product-badge bestseller">Bestseller</span>
                        )}
                        {hasDiscount && (
                          <span className="product-badge sale">-{discountPercent}%</span>
                        )}
                      </div>

                      {/* Wishlist Heart */}
                      <button
                        className={`wishlist-btn ${isWishlisted ? 'active' : ''}`}
                        onClick={(e) => toggleWishlist(e, product.id)}
                        aria-label="Add to wishlist"
                      >
                        <i className={isWishlisted ? 'fas fa-heart' : 'far fa-heart'}></i>
                      </button>

                      {/* Quick Actions */}
                      <div className="product-actions-overlay">
                        <button
                          className="quick-view-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setQuickViewProduct(product)
                          }}
                        >
                          <i className="fas fa-eye"></i> Quick View
                        </button>
                        <button
                          className="quick-add-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setQuickAddProduct(product)
                          }}
                        >
                          <i className="fas fa-plus"></i> Quick Add
                        </button>
                      </div>
                    </div>

                    <div className="product-info">
                      {/* Color Swatches */}
                      <div className="product-color-swatches">
                        {productColors.map(color => (
                          <span
                            key={color.name}
                            className="color-dot"
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          ></span>
                        ))}
                        {productColors.length > 3 && (
                          <span className="more-colors">+{productColors.length - 3}</span>
                        )}
                      </div>

                      {/* Brand */}
                      {product.brand && (
                        <p className="product-brand">
                          {typeof product.brand === 'object' ? product.brand.name : product.brand}
                        </p>
                      )}

                      {/* Product Name */}
                      <h3 className="product-name">{product.name}</h3>

                      {/* Price */}
                      <div className="product-price-row">
                        {hasDiscount && (
                          <span className="price-original">XCG {product.compareAtPrice}</span>
                        )}
                        <span className={`product-price ${hasDiscount ? 'sale' : ''}`}>
                          XCG {product.price}
                        </span>
                      </div>

                      {/* Stock status */}
                      {product.inStock === false && (
                        <div style={{ fontSize: '12px', color: '#dc3545', fontWeight: '600', marginTop: '4px' }}>Out of Stock</div>
                      )}
                      {product.stockQuantity > 0 && product.stockQuantity <= 5 && product.inStock !== false && (
                        <div style={{ fontSize: '12px', color: '#e67e22', marginTop: '4px' }}>Only {product.stockQuantity} left</div>
                      )}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="load-more-container">
              <button
                className="load-more-btn"
                onClick={() => setVisibleCount(prev => prev + 9)}
              >
                Load More Products
                <span className="load-more-count">
                  ({filteredProducts.length - visibleCount} remaining)
                </span>
              </button>
            </div>
          )}

          {/* Results Summary */}
          <div className="results-summary">
            Showing {visibleProducts.length} of {filteredProducts.length} products
          </div>

          {/* Best Sellers Section */}
          <div className="best-sellers">
            <div className="best-sellers-header">
              <span>Guaranteed Authentic</span>
              <h2>Premium Colombian Quality</h2>
              <p>Every bra is crafted with premium materials and designed for the perfect fit. 60-day easy returns.</p>
            </div>
            <div className="guarantee-badges">
              <div className="guarantee-badge">
                <i className="fas fa-certificate"></i>
                <span>100% Authentic</span>
              </div>
              <div className="guarantee-badge">
                <i className="fas fa-exchange-alt"></i>
                <span>Easy Returns</span>
              </div>
              <div className="guarantee-badge">
                <i className="fas fa-heart"></i>
                <span>Perfect Fit Guarantee</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Quick Add Modal */}
      {quickAddProduct && createPortal(
        <div className="quick-add-modal-overlay" onClick={() => setQuickAddProduct(null)}>
          <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setQuickAddProduct(null)}>
              <i className="fas fa-times"></i>
            </button>
            <div className="quick-add-content">
              <img src={quickAddProduct.image} alt={quickAddProduct.name} />
              <div className="quick-add-details">
                <h3>{quickAddProduct.name}</h3>
                <p className="quick-add-price">XCG {quickAddProduct.price}</p>
                <div className="quick-add-sizes">
                  <label>Select Size:</label>
                  <div className="size-buttons">
                    {sizeOptions.map(size => (
                      <button key={size} className="size-btn">{size}</button>
                    ))}
                  </div>
                </div>
                <button className="add-to-cart-btn">
                  <i className="fas fa-shopping-bag"></i> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bottom Features */}
      <div className="bottom-features">
        <div className="bottom-features-content">
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-truck"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>Free Home Delivery</h4>
              <p>Orders over XCG 80</p>
            </div>
          </div>
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-undo"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>60-Day Returns</h4>
              <p>Easy return policy</p>
            </div>
          </div>
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>Secure Checkout</h4>
              <p>100% protected</p>
            </div>
          </div>
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-headset"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>WhatsApp Support</h4>
              <p>Personal assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <section className="newsletter">
        <h3>Get 10% Off Your First Order</h3>
        <p>Subscribe for exclusive offers, new arrivals, and styling tips</p>
        <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Your email address" />
          <button type="submit">Subscribe</button>
        </form>
      </section>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  )
}

export default Category
