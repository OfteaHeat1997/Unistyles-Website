import { useParams, Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useProducts } from '../hooks/useProducts'
import { BRANDS } from '../config'

function Brand() {
  const { brandId } = useParams()
  const [sortBy, setSortBy] = useState('name')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })

  // Find brand info from config
  const brand = useMemo(() => BRANDS.find(b => b.id === brandId), [brandId])

  // Fetch all products and filter by brand
  const { data, isLoading } = useProducts({ limit: 500 })

  const filteredProducts = useMemo(() => {
    if (!data?.products) return []

    let products = data.products.filter(p => {
      const productBrand = typeof p.brand === 'object' ? p.brand?.name : p.brand
      return productBrand?.toLowerCase().includes(brandId.toLowerCase()) ||
             productBrand?.toLowerCase().replace(/['\s]/g, '').includes(brandId.toLowerCase().replace(/['\s]/g, ''))
    })

    // Price filter
    if (priceRange.min) {
      products = products.filter(p => p.price >= parseFloat(priceRange.min))
    }
    if (priceRange.max) {
      products = products.filter(p => p.price <= parseFloat(priceRange.max))
    }

    // Sort
    switch (sortBy) {
      case 'price-low': products.sort((a, b) => a.price - b.price); break
      case 'price-high': products.sort((a, b) => b.price - a.price); break
      case 'newest': products.sort((a, b) => (b.id || 0) - (a.id || 0)); break
      default: products.sort((a, b) => a.name.localeCompare(b.name))
    }

    return products
  }, [data?.products, brandId, sortBy, priceRange])

  if (!brand) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center' }}>
        <h2>Brand not found</h2>
        <Link to="/" style={{ color: 'var(--muted-gold)' }}>Return to Home</Link>
      </div>
    )
  }

  return (
    <>
      {/* Hero Banner */}
      <section style={{
        background: 'linear-gradient(135deg, var(--dark) 0%, #2C2C2C 100%)',
        color: 'var(--white)',
        padding: '60px 0',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '48px', marginBottom: '10px', color: 'var(--muted-gold)' }}>
            {brand.name}
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-light)', marginBottom: '5px' }}>{brand.tagline}</p>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{brand.category}</p>
        </div>
      </section>

      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>{brand.name}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background: 'var(--white)', padding: '15px 0', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <p style={{ fontSize: '14px', color: 'var(--dark-warmth)' }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px' }}>Price:</label>
              <input type="number" placeholder="Min" value={priceRange.min}
                onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
              />
              <span>-</span>
              <input type="number" placeholder="Max" value={priceRange.max}
                onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '13px' }}
              aria-label="Sort products"
            >
              <option value="name">Name A-Z</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <section style={{ padding: '40px 0', background: 'var(--cream-bg)', minHeight: '50vh' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner"></div>
              <p>Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: '18px', marginBottom: '20px' }}>No products found for {brand.name}</p>
              <Link to="/" className="btn-shop">Browse All Products</Link>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map(product => (
                <Link to={`/product/${product.id}`} className="product-card" key={product.id}>
                  <div className="product-image">
                    <img src={product.image} alt={product.name} loading="lazy" />
                    {product.badge && (
                      <span className={`product-badge ${product.badge === 'New' ? 'new' : ''}`}>
                        {product.badge}
                      </span>
                    )}
                    {product.inStock === false && (
                      <span className="product-badge" style={{ background: '#dc3545' }}>Out of Stock</span>
                    )}
                  </div>
                  <div className="product-info">
                    <p className="product-brand">{typeof product.brand === 'object' ? product.brand.name : product.brand}</p>
                    <p className="product-ref">{product.ref}</p>
                    <h3 className="product-name">{product.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <p className="product-price">XCG {product.price}</p>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                          XCG {product.compareAtPrice}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Brand
