import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cartStore } from '../stores/cartStore'

function QuickViewModal({ product, isOpen, onClose }) {
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState(product?.size || '')
  const [selectedColor, setSelectedColor] = useState(product?.color || '')

  if (!isOpen || !product) return null

  const handleAddToCart = () => {
    cartStore.addItem(product, quantity, selectedSize, selectedColor)
    onClose()
  }

  const whatsappUrl = `https://wa.me/59990000425?text=${encodeURIComponent(
    `Hi! I'm interested in ${product.name} ${product.ref}${selectedSize ? ` - Size: ${selectedSize}` : ''}${selectedColor ? ` - Color: ${selectedColor}` : ''}`
  )}`

  // Available sizes based on category
  const sizes = product.size
    ? [product.size]
    : product.categorySlug === 'bras'
      ? ['32B', '34B', '34C', '36B', '36C', '38B', '38C']
      : product.categorySlug === 'panties' || product.categorySlug === 'shapewear'
        ? ['S', 'M', 'L', 'XL']
        : []

  // Available colors
  const colors = product.color ? [product.color] : ['Black', 'Beige', 'White']

  return (
    <div className="quickview-overlay" onClick={onClose}>
      <div className="quickview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="quickview-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="quickview-content">
          {/* Product Image */}
          <div className="quickview-image">
            <img src={product.image} alt={product.name} />
            {product.badge && (
              <span className={`product-badge ${product.badge === 'New' ? 'new' : 'bestseller'}`}>
                {product.badge}
              </span>
            )}
          </div>

          {/* Product Info */}
          <div className="quickview-info">
            {product.brand && (
              <p className="quickview-brand">
                {typeof product.brand === 'object' ? product.brand.name : product.brand}
              </p>
            )}
            <h2 className="quickview-name">{product.name}</h2>
            <p className="quickview-ref">{product.ref}</p>
            <p className="quickview-price">XCG {product.price}</p>

            {/* Size Selection */}
            {sizes.length > 0 && (
              <div className="quickview-option">
                <label>Size</label>
                <div className="quickview-options">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      className={`option-btn ${selectedSize === size ? 'active' : ''}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {colors.length > 0 && (
              <div className="quickview-option">
                <label>Color</label>
                <div className="quickview-options">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={`option-btn ${selectedColor === color ? 'active' : ''}`}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="quickview-option">
              <label>Quantity</label>
              <div className="quickview-quantity">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>

            {/* Actions */}
            <div className="quickview-actions">
              <button className="btn-add-cart" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <a href={whatsappUrl} className="btn-whatsapp" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-whatsapp"></i>
                WhatsApp
              </a>
            </div>

            <Link to={`/product/${product.id}`} className="quickview-details" onClick={onClose}>
              View Full Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickViewModal
