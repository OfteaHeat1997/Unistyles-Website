import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'

// Sample product data (will come from API later)
const sampleProduct = {
  id: 1,
  name: 'Leonisa Lace Bralette',
  ref: '011911',
  price: 125,
  description: 'Beautiful Colombian lace bralette with comfortable fit and elegant design. Perfect for everyday wear or special occasions.',
  images: ['/images/bra1.jpg', '/images/bra1-2.jpg', '/images/bra1-3.jpg'],
  sizes: ['32A', '32B', '34A', '34B', '34C', '36B', '36C'],
  colors: ['Black', 'Nude', 'White'],
  brand: 'Leonisa',
  category: 'Bras'
}

function Product() {
  const { id } = useParams()
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState(sampleProduct.images[0])

  const product = sampleProduct // Will fetch from API using id

  const whatsappUrl = `https://wa.me/59990000425?text=${encodeURIComponent(
    `Hi! I'm interested in ${product.name} REF ${product.ref}${selectedSize ? ` - Size: ${selectedSize}` : ''}${selectedColor ? ` - Color: ${selectedColor}` : ''}`
  )}`

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: '#999' }}>/</span>
          <Link to="/bras" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>{product.category}</Link>
          <span style={{ margin: '0 10px', color: '#999' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>{product.name}</span>
        </div>
      </div>

      {/* Product Detail */}
      <section style={{ padding: '60px 0', background: 'var(--white)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start' }}>
          {/* Product Images */}
          <div>
            <div style={{ marginBottom: '15px', borderRadius: '10px', overflow: 'hidden' }}>
              <img
                src={mainImage}
                alt={product.name}
                style={{ width: '100%', height: '500px', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {product.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setMainImage(img)}
                  style={{
                    border: mainImage === img ? '2px solid var(--muted-gold)' : '2px solid transparent',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    padding: 0,
                    background: 'none'
                  }}
                >
                  <img src={img} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div>
            <p style={{ fontSize: '12px', color: 'var(--muted-gold)', marginBottom: '5px' }}>{product.brand}</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '10px', color: 'var(--dark)' }}>
              {product.name}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '20px' }}>REF {product.ref}</p>
            <p style={{ fontSize: '28px', fontWeight: '600', color: 'var(--charcoal)', marginBottom: '25px' }}>
              Fl. {product.price}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--charcoal)', lineHeight: '1.8', marginBottom: '30px' }}>
              {product.description}
            </p>

            {/* Size Selection */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                Size
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    style={{
                      padding: '10px 18px',
                      border: selectedSize === size ? '2px solid var(--dark)' : '1px solid #ddd',
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

            {/* Color Selection */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    style={{
                      padding: '10px 18px',
                      border: selectedColor === color ? '2px solid var(--dark)' : '1px solid #ddd',
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

            {/* Quantity */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                Quantity
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ width: '40px', height: '40px', border: '1px solid #ddd', background: 'var(--white)', cursor: 'pointer', fontSize: '18px' }}
                >
                  -
                </button>
                <span style={{ padding: '0 20px', fontSize: '16px', fontWeight: '500' }}>{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{ width: '40px', height: '40px', border: '1px solid #ddd', background: 'var(--white)', cursor: 'pointer', fontSize: '18px' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              <button className="btn-shop" style={{ flex: 1 }}>
                Add to Cart
              </button>
              <a
                href={whatsappUrl}
                className="btn-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 0 }}
              >
                <i className="fab fa-whatsapp"></i>
                Order via WhatsApp
              </a>
            </div>

            {/* Features */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fas fa-truck" style={{ color: 'var(--muted-gold)' }}></i>
                <span style={{ fontSize: '13px' }}>Free delivery in Curacao on orders over Fl. 80</span>
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
      </section>
    </>
  )
}

export default Product
