import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useProduct, useProductsByCategory } from '../hooks/useProducts'
import { cartStore } from '../stores/cartStore'

function Product() {
  const { id } = useParams()
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState('')

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

  // Set initial values when product loads
  useEffect(() => {
    if (product) {
      setMainImage(product.image)
      if (product.color) setSelectedColor(product.color)
      if (product.size) setSelectedSize(product.size)
    }
  }, [product])

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

  const whatsappUrl = `https://wa.me/59990000425?text=${encodeURIComponent(
    `Hi! I'm interested in ${product.name} ${product.ref}${selectedSize ? ` - Size: ${selectedSize}` : ''}${selectedColor ? ` - Color: ${selectedColor}` : ''}`
  )}`

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
            {/* Product Images */}
            <div>
              <div style={{ marginBottom: '15px', borderRadius: '10px', overflow: 'hidden', background: 'var(--light-cream)' }}>
                <img
                  src={mainImage}
                  alt={product.name}
                  style={{ width: '100%', height: '500px', objectFit: 'contain' }}
                />
              </div>
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
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '20px' }}>{product.ref}</p>
              <p style={{ fontSize: '28px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '25px' }}>
                XCG {product.price}
              </p>
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
                <button className="btn-shop" style={{ flex: '1 1 200px' }} onClick={handleAddToCart}>
                  Add to Cart
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
