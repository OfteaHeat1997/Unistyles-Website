import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import ProductCard from '../components/ProductCard'

function getStoredWishlist() {
  try { return JSON.parse(localStorage.getItem('unistyles_wishlist') || '[]') }
  catch { return [] }
}

function Wishlist() {
  const [wishlistIds, setWishlistIds] = useState(getStoredWishlist)
  const { data: productsData } = useProducts({ limit: 500 })

  // Re-read on focus (in case another tab changed it)
  useEffect(() => {
    const handler = () => setWishlistIds(getStoredWishlist())
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  const wishlistProducts = (productsData?.products || []).filter(p => wishlistIds.includes(p.id))

  const removeFromWishlist = (productId) => {
    const next = wishlistIds.filter(id => id !== productId)
    localStorage.setItem('unistyles_wishlist', JSON.stringify(next))
    setWishlistIds(next)
  }

  return (
    <>
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Wishlist</span>
        </div>
      </div>
      <section style={{ padding: '60px 0', minHeight: '60vh' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', textAlign: 'center', marginBottom: '10px' }}>
            My Wishlist
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '40px' }}>
            {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'} saved
          </p>

          {wishlistProducts.length > 0 ? (
            <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {wishlistProducts.map(product => (
                <div key={product.id} style={{ position: 'relative' }}>
                  <ProductCard product={product} />
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    style={{
                      position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                      background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
                      width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', color: '#c0392b'
                    }}
                    title="Remove from wishlist"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <i className="far fa-heart" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '20px', display: 'block' }}></i>
              <h3 style={{ marginBottom: '10px' }}>Your wishlist is empty</h3>
              <p style={{ color: 'var(--dark-warmth)', marginBottom: '25px' }}>
                Browse products and click the heart icon to save items you love
              </p>
              <Link to="/" className="btn-shop" style={{ display: 'inline-block' }}>
                Start Shopping
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Wishlist
