import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { cartStore, lineKey } from '../stores/cartStore'
import { getCartOrderUrl } from '../utils/whatsapp'
import { useCheckoutOptions, formatXCG } from '../hooks/useCheckoutOptions'

function CartSidebar({ isOpen, onClose }) {
  const [cart, setCart] = useState(cartStore.getCart())
  const [itemCount, setItemCount] = useState(cartStore.getItemCount())
  const [total, setTotal] = useState(cartStore.getTotal())
  const { data: options } = useCheckoutOptions()
  const threshold = options?.freeDeliveryThreshold
  const remainingForFree = threshold ? Math.max(0, threshold - total) : null
  const progress = threshold ? Math.min(100, (total / threshold) * 100) : 0

  useEffect(() => {
    const unsubscribe = cartStore.subscribe((newCart) => {
      setCart(newCart)
      setItemCount(cartStore.getItemCount())
      setTotal(cartStore.getTotal())
    })
    return unsubscribe
  }, [])

  const updateQuantity = (key, newQuantity) => {
    cartStore.updateQuantity(key, newQuantity)
  }

  const removeItem = (key) => {
    cartStore.removeItem(key)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="cart-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1001
        }}
      />

      {/* Cart Sidebar */}
      <div
        className="cart-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          maxWidth: '100%',
          height: '100vh',
          background: 'var(--white)',
          zIndex: 1002,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-5px 0 30px rgba(0,0,0,0.1)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', margin: 0 }}>
            Shopping Cart ({itemCount})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--charcoal)'
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <i className="fas fa-shopping-bag" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '20px' }}></i>
              <p style={{ color: 'var(--charcoal)', marginBottom: '20px' }}>Your cart is empty</p>
              <button onClick={onClose} className="btn-shop" style={{ padding: '12px 30px' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={lineKey(item)}
                style={{
                  display: 'flex',
                  gap: '15px',
                  paddingBottom: '15px',
                  marginBottom: '15px',
                  borderBottom: '1px solid var(--border-light)'
                }}
              >
                {/* Image */}
                <div style={{ width: '80px', height: '80px', flexShrink: 0 }}>
                  <img
                    src={item.image || '/images/placeholder.jpg'}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                  />
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px' }}>{item.name}</h4>
                  {(item.size || item.color) && (
                    <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '5px' }}>
                      {item.size && `Size: ${item.size}`}
                      {item.size && item.color && ' | '}
                      {item.color && `Color: ${item.color}`}
                    </p>
                  )}
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--charcoal)' }}>
                    {formatXCG(item.price)}
                  </p>

                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <button
                      onClick={() => updateQuantity(lineKey(item), item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                      style={{
                        width: '28px',
                        height: '28px',
                        border: '1px solid var(--border)',
                        background: 'white',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(lineKey(item), item.quantity + 1)}
                      disabled={item.stockQuantity !== undefined && item.stockQuantity !== null && item.quantity >= item.stockQuantity}
                      aria-label={`Increase quantity of ${item.name}`}
                      style={{
                        width: '28px',
                        height: '28px',
                        border: '1px solid var(--border)',
                        background: 'white',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(lineKey(item))}
                      aria-label={`Remove ${item.name}`}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{ padding: '20px', borderTop: '1px solid var(--border-light)', background: 'var(--cream-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500' }}>Subtotal:</span>
              <span style={{ fontSize: '18px', fontWeight: '600' }}>XCG {total.toFixed(2)}</span>
            </div>
            {threshold ? (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '12px', color: remainingForFree === 0 ? '#3D7A5F' : 'var(--dark-warmth)', marginBottom: '6px' }}>
                  {remainingForFree === 0
                    ? <><i className="fas fa-check-circle" style={{ marginRight: '5px' }}></i>You qualify for free delivery</>
                    : <>Add {formatXCG(remainingForFree)} more for free delivery</>}
                </p>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
                  style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: remainingForFree === 0 ? '#3D7A5F' : 'var(--muted-gold)', transition: 'width .3s' }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  Free pickup available. Final delivery fee is calculated at checkout from your location.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '15px' }}>
                Delivery or free pickup — calculated at checkout
              </p>
            )}
            <Link
              to="/checkout"
              className="btn-shop"
              onClick={onClose}
              style={{ display: 'block', textAlign: 'center', width: '100%' }}
            >
              Checkout
            </Link>
            <a
              href={getCartOrderUrl(cart, total)}
              className="btn-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '10px',
                marginLeft: 0,
                width: '100%'
              }}
            >
              <i className="fab fa-whatsapp"></i>
              Order via WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  )
}

export default CartSidebar
