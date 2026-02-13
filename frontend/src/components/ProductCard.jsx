import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cartStore } from '../stores/cartStore'

function ProductCard({ product }) {
  const { id, name, ref, price, compareAtPrice, image, badge, brand } = product
  const [isAdding, setIsAdding] = useState(false)
  const [showAdded, setShowAdded] = useState(false)

  const whatsappUrl = `https://wa.me/59990000425?text=${encodeURIComponent(`Hi! I'm interested in ${name} REF ${ref}`)}`

  const handleAddToCart = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (isAdding) return

    setIsAdding(true)
    try {
      await cartStore.addItem({
        id,
        name,
        ref,
        price,
        image
      }, 1)
      setShowAdded(true)
      setTimeout(() => setShowAdded(false), 2000)
    } catch (error) {
      console.error('Failed to add to cart:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const hasDiscount = compareAtPrice && compareAtPrice > price

  return (
    <Link to={`/product/${id}`} className="product-card card-lift">
      <div className="product-image">
        <img src={image || '/images/placeholder.jpg'} alt={name} loading="lazy" />
        {badge && (
          <span className={`product-badge ${badge.toLowerCase().replace(' ', '-')}`}>
            {badge}
          </span>
        )}
        {hasDiscount && !badge && (
          <span className="product-badge sale">Sale</span>
        )}
        <div className="quick-add" onClick={handleAddToCart}>
          {isAdding ? (
            <span className="spinner" style={{ margin: '0 auto' }}></span>
          ) : showAdded ? (
            'Added to Cart ✓'
          ) : (
            'Quick Add'
          )}
        </div>
      </div>
      <div className="product-info">
        {brand && <p className="product-brand">{typeof brand === 'object' ? brand.name : brand}</p>}
        <h3 className="product-name">{name}</h3>
        <p className="product-ref">REF {ref}</p>
        <div className="product-price-row">
          {hasDiscount && (
            <span className="price-original">XCG {compareAtPrice}</span>
          )}
          <span className={`product-price ${hasDiscount ? 'price-sale' : ''}`}>
            XCG {price}
          </span>
        </div>
        <div className="product-actions">
          <button
            className="btn-add-cart"
            onClick={handleAddToCart}
            disabled={isAdding}
          >
            {isAdding ? 'Adding...' : showAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
          <a
            href={whatsappUrl}
            className="btn-wa-order"
            target="_blank"
            rel="noopener noreferrer"
            title="Order via WhatsApp"
            onClick={(e) => e.stopPropagation()}
            aria-label="Order via WhatsApp"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
