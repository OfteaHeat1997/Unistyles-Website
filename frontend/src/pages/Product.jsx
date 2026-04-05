import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useProduct, useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'
import { getProductInquiryUrl } from '../utils/whatsapp'
import { useAuth } from '../contexts/AuthContext'

function Product() {
  const { id } = useParams()
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [reviews, setReviews] = useState([])
  const [reviewSummary, setReviewSummary] = useState(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const { user, isAuthenticated, token } = useAuth()

  // Fetch product from Strapi (with fallback to local data)
  const { data: product, isLoading, error } = useProduct(id)

  // Get category slug for related products
  const categorySlug = product?.category?.slug || product?.categorySlug

  // Fetch related products from same category
  const { data: relatedData } = useProductsByCategory(categorySlug, {
    limit: 5,
    enabled: !!categorySlug
  })

  // Filter out current product from related products
  const relatedProducts = useMemo(() => {
    if (!relatedData?.products || !product) return []
    return relatedData.products
      .filter(p => (p.id !== product.id) && (p.legacyId !== product.legacyId))
      .slice(0, 4)
  }, [relatedData?.products, product])

  // Build gallery images array (main image + gallery images from Strapi)
  const allImages = useMemo(() => {
    if (!product) return []
    const images = [product.image].filter(Boolean)
    if (product.gallery?.length) {
      product.gallery.forEach(img => {
        if (img && !images.includes(img)) images.push(img)
      })
    }
    return images
  }, [product])

  // Set initial values when product loads
  useEffect(() => {
    if (product) {
      setMainImage(product.image)
      setSelectedImageIndex(0)
      if (product.color) setSelectedColor(product.color)
      if (product.size) setSelectedSize(product.size)
    }
  }, [product])

  // Handle gallery thumbnail click
  const handleImageSelect = (img, index) => {
    setMainImage(img)
    setSelectedImageIndex(index)
  }

  // Fetch reviews
  useEffect(() => {
    if (!product) return
    fetch(`/api/reviews/product/${product.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setReviews(data.reviews || [])
          setReviewSummary(data.summary || null)
        }
      })
      .catch(() => {})
  }, [product])

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated || !product) return
    setReviewSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, ...reviewForm })
      })
      const data = await res.json()
      if (res.ok) {
        setReviews(prev => [{ ...data.review, author: `${user.firstName} ${user.lastName?.charAt(0)}.` }, ...prev])
        setReviewSummary(prev => prev ? { ...prev, totalReviews: prev.totalReviews + 1 } : prev)
        setShowReviewForm(false)
        setReviewForm({ rating: 5, title: '', comment: '' })
      } else {
        alert(data.error || 'Failed to submit review')
      }
    } catch { alert('Failed to submit review') }
    finally { setReviewSubmitting(false) }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center' }}>
        <p>Loading product...</p>
      </div>
    )
  }

  if (!product || error) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center' }}>
        <h2>Product not found</h2>
        <Link to="/" style={{ color: 'var(--muted-gold)' }}>Return to Home</Link>
      </div>
    )
  }

  const whatsappUrl = getProductInquiryUrl({ name: product.name, ref: product.ref, size: selectedSize, color: selectedColor })

  const handleAddToCart = () => {
    cartStore.addItem(product, quantity, selectedSize, selectedColor)
  }

  // Available sizes based on category
  const sizes = product.size
    ? [product.size]
    : product.categorySlug === 'bras'
      ? ['32B', '34B', '34C', '36B', '36C', '38B', '38C', '40B', '40C']
      : product.categorySlug === 'panties' || product.categorySlug === 'shapewear'
        ? ['S', 'M', 'L', 'XL', 'XXL']
        : []

  // Available colors
  const colors = product.color ? [product.color] : ['Black', 'Beige', 'White']

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <Link to={`/${product.categorySlug}`} style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>
            {product.categoryName}
          </Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>{product.name}</span>
        </div>
      </div>

      {/* Product Detail */}
      <section style={{ padding: '60px 0', background: 'var(--white)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', alignItems: 'start' }}>
            {/* Product Images — Gallery */}
            <div>
              <div style={{ marginBottom: '15px', borderRadius: '10px', overflow: 'hidden', background: 'var(--light-cream)', position: 'relative' }}>
                <img
                  src={mainImage}
                  alt={product.name}
                  style={{ width: '100%', height: '500px', objectFit: 'contain' }}
                />
                {/* Stock badge */}
                {product.inStock === false && (
                  <div style={{ position: 'absolute', top: '15px', left: '15px', background: '#dc3545', color: '#fff', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                    Out of Stock
                  </div>
                )}
                {product.badge && (
                  <div style={{ position: 'absolute', top: '15px', right: '15px', background: product.badge === 'New' ? 'var(--muted-gold)' : 'var(--dark)', color: '#fff', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                    {product.badge}
                  </div>
                )}
              </div>
              {/* Thumbnail gallery */}
              {allImages.length > 1 && (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => handleImageSelect(img, i)}
                      style={{
                        width: '80px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden',
                        border: selectedImageIndex === i ? '2px solid var(--muted-gold)' : '2px solid var(--border-light)',
                        cursor: 'pointer', padding: 0, background: 'var(--light-cream)'
                      }}
                    >
                      <img src={img} alt={`${product.name} view ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              {product.brand && (
                <p style={{ fontSize: '12px', color: 'var(--muted-gold)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {typeof product.brand === 'object' ? product.brand.name : product.brand}
                </p>
              )}
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '10px', color: 'var(--dark)' }}>
                {product.name}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '20px' }}>
                {product.ref}
                {product.stockQuantity > 0 && product.stockQuantity <= 5 && (
                  <span style={{ marginLeft: '15px', color: '#e67e22', fontWeight: '600' }}>Only {product.stockQuantity} left!</span>
                )}
              </p>
              {/* Price with sale/discount display */}
              <div style={{ marginBottom: '25px' }}>
                {product.compareAtPrice && product.compareAtPrice > product.price ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '600', color: '#c0392b' }}>
                      XCG {product.price}
                    </span>
                    <span style={{ fontSize: '18px', color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                      XCG {product.compareAtPrice}
                    </span>
                    <span style={{ background: '#c0392b', color: '#fff', padding: '3px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: '600' }}>
                      -{Math.round((1 - product.price / product.compareAtPrice) * 100)}%
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '28px', fontWeight: '600', color: 'var(--charcoal)' }}>
                    XCG {product.price}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.8', marginBottom: '30px' }}>
                {product.description || `Premium Colombian ${product.categoryName?.toLowerCase() || 'product'} with excellent quality and comfort. Authentic ${typeof product.brand === 'object' ? product.brand.name : product.brand || 'brand'} product delivered locally in Curacao.`}
              </p>

              {/* Size Selection */}
              {sizes.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                    Size
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        style={{
                          padding: '10px 18px',
                          border: selectedSize === size ? '2px solid var(--dark)' : '1px solid var(--border)',
                          borderRadius: '5px',
                          background: selectedSize === size ? 'var(--dark)' : 'var(--white)',
                          color: selectedSize === size ? 'var(--white)' : 'var(--dark)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Selection */}
              {colors.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                    Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        style={{
                          padding: '10px 18px',
                          border: selectedColor === color ? '2px solid var(--dark)' : '1px solid var(--border)',
                          borderRadius: '5px',
                          background: selectedColor === color ? 'var(--dark)' : 'var(--white)',
                          color: selectedColor === color ? 'var(--white)' : 'var(--dark)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                  Quantity
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{ width: '40px', height: '40px', border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontSize: '18px', borderRadius: '5px' }}
                  >
                    -
                  </button>
                  <span style={{ padding: '0 20px', fontSize: '16px', fontWeight: '500' }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    style={{ width: '40px', height: '40px', border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontSize: '18px', borderRadius: '5px' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
                <button
                  className="btn-shop"
                  style={{ flex: '1 1 200px', opacity: product.inStock === false ? 0.5 : 1 }}
                  onClick={handleAddToCart}
                  disabled={product.inStock === false}
                >
                  {product.inStock === false ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <a
                  href={whatsappUrl}
                  className="btn-whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: '1 1 200px', textAlign: 'center' }}
                >
                  <i className="fab fa-whatsapp"></i>
                  Order via WhatsApp
                </a>
              </div>

              {/* Product Attributes — Fragrance notes, skincare info, etc. */}
              {product.notes && (product.notes.top || product.notes.middle || product.notes.base) && (
                <div style={{ marginBottom: '25px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fragrance Notes</h4>
                  {product.notes.top && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-gold)' }}>Top Notes: </span>
                      <span style={{ fontSize: '13px' }}>{product.notes.top}</span>
                    </div>
                  )}
                  {product.notes.middle && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-gold)' }}>Heart Notes: </span>
                      <span style={{ fontSize: '13px' }}>{product.notes.middle}</span>
                    </div>
                  )}
                  {product.notes.base && (
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-gold)' }}>Base Notes: </span>
                      <span style={{ fontSize: '13px' }}>{product.notes.base}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Product Specs — volume, concentration, SPF, material, compression, etc. */}
              {(product.volume || product.concentration || product.spf || product.material || product.compression || product.gender || product.fragranceFamily || product.skinType || product.keyIngredients) && (
                <div style={{ marginBottom: '25px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Specifications</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    {product.volume && <div><span style={{ color: 'var(--text-tertiary)' }}>Volume:</span> {product.volume}</div>}
                    {product.concentration && <div><span style={{ color: 'var(--text-tertiary)' }}>Concentration:</span> {product.concentration}</div>}
                    {product.gender && <div><span style={{ color: 'var(--text-tertiary)' }}>For:</span> {product.gender}</div>}
                    {product.fragranceFamily && <div><span style={{ color: 'var(--text-tertiary)' }}>Family:</span> {product.fragranceFamily}</div>}
                    {product.spf && <div><span style={{ color: 'var(--text-tertiary)' }}>SPF:</span> {product.spf}</div>}
                    {product.skinType && <div><span style={{ color: 'var(--text-tertiary)' }}>Skin Type:</span> {product.skinType}</div>}
                    {product.material && <div><span style={{ color: 'var(--text-tertiary)' }}>Material:</span> {product.material}</div>}
                    {product.compression && <div><span style={{ color: 'var(--text-tertiary)' }}>Compression:</span> {product.compression}</div>}
                  </div>
                  {product.keyIngredients && (
                    <div style={{ marginTop: '10px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Key Ingredients:</span> {product.keyIngredients}
                    </div>
                  )}
                </div>
              )}

              {/* Features */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <i className="fas fa-truck" style={{ color: 'var(--muted-gold)' }}></i>
                  <span style={{ fontSize: '13px' }}>Free delivery in Curacao on orders over XCG 80</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <i className="fas fa-undo" style={{ color: 'var(--muted-gold)' }}></i>
                  <span style={{ fontSize: '13px' }}>Easy returns within 7 days</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-shield-alt" style={{ color: 'var(--muted-gold)' }}></i>
                  <span style={{ fontSize: '13px' }}>100% authentic Colombian products</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div style={{ marginTop: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px' }}>
                Customer Reviews
                {reviewSummary && reviewSummary.totalReviews > 0 && (
                  <span style={{ fontSize: '16px', fontWeight: '400', color: 'var(--dark-warmth)', marginLeft: '15px' }}>
                    ({reviewSummary.totalReviews} review{reviewSummary.totalReviews !== 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              {isAuthenticated && !showReviewForm && (
                <button onClick={() => setShowReviewForm(true)} className="btn-shop" style={{ padding: '10px 25px', fontSize: '13px' }}>
                  Write a Review
                </button>
              )}
            </div>

            {/* Rating Summary */}
            {reviewSummary && reviewSummary.totalReviews > 0 && (
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '30px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--dark)' }}>{reviewSummary.averageRating.toFixed(1)}</div>
                  <div style={{ color: 'var(--muted-gold)', fontSize: '20px' }}>
                    {'★'.repeat(Math.round(reviewSummary.averageRating))}{'☆'.repeat(5 - Math.round(reviewSummary.averageRating))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = reviewSummary.distribution?.[star] || 0
                    const pct = reviewSummary.totalReviews > 0 ? (count / reviewSummary.totalReviews * 100) : 0
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', width: '30px' }}>{star} ★</span>
                        <div style={{ flex: 1, height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--muted-gold)', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', width: '25px' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} style={{ padding: '25px', background: 'var(--cream-bg)', borderRadius: '10px', marginBottom: '30px' }}>
                <h4 style={{ marginBottom: '20px', fontSize: '16px' }}>Your Review</h4>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Rating</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '28px', color: star <= reviewForm.rating ? 'var(--muted-gold)' : 'var(--border)' }}
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      >★</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Title (optional)</label>
                  <input type="text" value={reviewForm.title} onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                    placeholder="Summarize your experience" maxLength={200} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Comment (optional)</label>
                  <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px', minHeight: '80px' }}
                    placeholder="Tell others about your experience" maxLength={2000} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn-shop" disabled={reviewSubmitting} style={{ padding: '10px 30px' }}>
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button type="button" onClick={() => setShowReviewForm(false)} className="btn-outline" style={{ padding: '10px 20px' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Review List */}
            {reviews.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {reviews.map(review => (
                  <div key={review.id} style={{ padding: '20px', background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--muted-gold)', fontSize: '16px' }}>
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </span>
                        {review.isVerified && (
                          <span style={{ fontSize: '11px', color: '#3D7A5F', background: '#E8F5E9', padding: '2px 8px', borderRadius: '3px' }}>
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.title && <p style={{ fontWeight: '600', marginBottom: '5px', fontSize: '15px' }}>{review.title}</p>}
                    {review.comment && <p style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.6' }}>{review.comment}</p>}
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>— {review.author}</p>
                  </div>
                ))}
              </div>
            ) : !showReviewForm && (
              <div style={{ textAlign: 'center', padding: '40px', background: 'var(--cream-bg)', borderRadius: '10px' }}>
                <p style={{ fontSize: '16px', marginBottom: '10px' }}>No reviews yet</p>
                <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>
                  {isAuthenticated ? 'Be the first to review this product!' : 'Log in to write a review'}
                </p>
              </div>
            )}
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div style={{ marginTop: '80px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', textAlign: 'center', marginBottom: '40px' }}>
                You May Also Like
              </h2>
              <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {relatedProducts.map((relatedProduct) => (
                  <Link to={`/product/${relatedProduct.id}`} className="product-card" key={relatedProduct.id}>
                    <div className="product-image">
                      <img src={relatedProduct.image} alt={relatedProduct.name} />
                      {relatedProduct.badge && (
                        <span className={`product-badge ${relatedProduct.badge === 'New' ? 'new' : ''}`}>
                          {relatedProduct.badge}
                        </span>
                      )}
                    </div>
                    <div className="product-info">
                      {relatedProduct.brand && <p className="product-brand">{typeof relatedProduct.brand === 'object' ? relatedProduct.brand.name : relatedProduct.brand}</p>}
                      <p className="product-ref">{relatedProduct.ref}</p>
                      <h3 className="product-name">{relatedProduct.name}</h3>
                      <p className="product-price">XCG {relatedProduct.price}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Product
