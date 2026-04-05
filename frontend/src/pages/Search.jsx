import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useProductSearch } from '../hooks/useProducts'
import ProductCard from '../components/ProductCard'
import ProductSkeleton from '../components/ProductSkeleton'

function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryFromUrl = searchParams.get('q') || ''
  const [inputValue, setInputValue] = useState(queryFromUrl)

  const { data: results, isLoading } = useProductSearch(queryFromUrl, { limit: 50 })

  // Sync input with URL
  useEffect(() => {
    setInputValue(queryFromUrl)
  }, [queryFromUrl])

  // Debounce search: auto-search 500ms after user stops typing
  useEffect(() => {
    if (inputValue.trim().length >= 2 && inputValue.trim() !== queryFromUrl) {
      const timer = setTimeout(() => {
        setSearchParams({ q: inputValue.trim() })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [inputValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputValue.trim().length >= 2) {
      setSearchParams({ q: inputValue.trim() })
    }
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Search</span>
        </div>
      </div>

      <section style={{ padding: '40px 0 80px', minHeight: '60vh' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', textAlign: 'center', marginBottom: '10px' }}>
            Search Products
          </h1>

          {/* Search Input */}
          <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto 40px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search by name, brand, or reference..."
              style={{
                flex: 1, padding: '14px 20px', border: '1px solid var(--border)',
                borderRadius: '8px', fontSize: '15px', outline: 'none'
              }}
              autoFocus
            />
            <button
              type="submit"
              className="btn-shop"
              style={{ padding: '14px 30px', whiteSpace: 'nowrap' }}
              disabled={inputValue.trim().length < 2}
            >
              <i className="fas fa-search" style={{ marginRight: '8px' }}></i>
              Search
            </button>
          </form>

          {/* Results */}
          {queryFromUrl && (
            <>
              <div style={{ marginBottom: '25px', fontSize: '14px', color: 'var(--charcoal)' }}>
                {isLoading ? (
                  <p>Searching...</p>
                ) : (
                  <p>
                    <strong>{results?.length || 0}</strong> results for "<strong>{queryFromUrl}</strong>"
                  </p>
                )}
              </div>

              {isLoading ? (
                <ProductSkeleton count={8} />
              ) : results && results.length > 0 ? (
                <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                  {results.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <i className="fas fa-search" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '20px', display: 'block' }}></i>
                  <h3 style={{ marginBottom: '10px' }}>No products found</h3>
                  <p style={{ color: 'var(--dark-warmth)', marginBottom: '25px' }}>
                    Try different keywords or browse our categories
                  </p>
                  <Link to="/" className="btn-shop" style={{ display: 'inline-block' }}>
                    Browse All Products
                  </Link>
                </div>
              )}
            </>
          )}

          {!queryFromUrl && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--dark-warmth)' }}>
              <i className="fas fa-search" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '20px', display: 'block' }}></i>
              <p>Enter a search term to find products</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Search
