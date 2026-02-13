import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cartStore } from '../stores/cartStore'
import { PAYMENT_METHODS, DELIVERY } from '../config'

function Checkout() {
  const navigate = useNavigate()
  const [cart, setCart] = useState(cartStore.getCart())
  const [total, setTotal] = useState(cartStore.getTotal())
  const [step, setStep] = useState(1) // 1: Info, 2: Payment, 3: Confirm
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderError, setOrderError] = useState('')

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    area: '',
    landmark: '',
    paymentMethod: 'cod',
    notes: ''
  })

  useEffect(() => {
    const unsubscribe = cartStore.subscribe((newCart) => {
      setCart(newCart)
      setTotal(cartStore.getTotal())
    })
    return unsubscribe
  }, [])

  const deliveryFee = total >= DELIVERY.freeShippingThreshold ? 0 : DELIVERY.standardFee
  const orderTotal = total + deliveryFee

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else {
      // Place order
      placeOrder()
    }
  }

  const placeOrder = async () => {
    setOrderError('')

    // For WhatsApp orders, skip API and redirect directly
    if (formData.paymentMethod === 'whatsapp') {
      const tempOrderNumber = 'UNI-' + Date.now().toString().slice(-8)
      setOrderNumber(tempOrderNumber)
      setOrderPlaced(true)
      cartStore.clearCart()

      const message = encodeURIComponent(
        `New Order ${tempOrderNumber}\n\n` +
        `Customer: ${formData.firstName} ${formData.lastName}\n` +
        `Phone: ${formData.phone}\n` +
        `Address: ${formData.address}, ${formData.area}\n\n` +
        `Items:\n${cart.map(item => `- ${item.name} x${item.quantity} = XCG ${(item.price * item.quantity).toFixed(2)}`).join('\n')}\n\n` +
        `Subtotal: XCG ${total.toFixed(2)}\n` +
        `Delivery: XCG ${deliveryFee.toFixed(2)}\n` +
        `Total: XCG ${orderTotal.toFixed(2)}`
      )
      window.open(`https://wa.me/59990000425?text=${message}`, '_blank')
      return
    }

    try {
      // Build auth headers
      const headers = { 'Content-Type': 'application/json' }
      const token = localStorage.getItem('token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Call backend orders API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            size: item.size || null,
            color: item.color || null
          })),
          paymentMethod: formData.paymentMethod,
          shippingAddress: {
            name: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone,
            street: formData.address,
            city: formData.area,
            landmark: formData.landmark || null
          },
          guestEmail: !token ? formData.email : undefined,
          notes: formData.notes || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order')
      }

      // Success - store order number and clear cart
      setOrderNumber(data.orderNumber || data.order?.orderNumber || 'UNI-' + Date.now().toString().slice(-8))
      setOrderPlaced(true)
      cartStore.clearCart()

    } catch (error) {
      console.error('Order placement failed:', error)
      setOrderError(error.message || 'Failed to place order. Please try again.')
    }
  }

  if (cart.length === 0 && !orderPlaced) {
    return (
      <section style={{ padding: '100px 0', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh' }}>
        <i className="fas fa-shopping-bag" style={{ fontSize: '64px', color: 'var(--border)', marginBottom: '20px' }}></i>
        <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>Your cart is empty</h2>
        <p style={{ marginBottom: '30px' }}>Add some products to continue checkout.</p>
        <Link to="/" className="btn-shop">Continue Shopping</Link>
      </section>
    )
  }

  if (orderPlaced) {
    return (
      <section style={{ padding: '100px 0', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh' }}>
        <i className="fas fa-check-circle" style={{ fontSize: '80px', color: '#25D366', marginBottom: '20px' }}></i>
        <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>Order Placed Successfully!</h2>
        {orderNumber && (
          <p style={{ marginBottom: '10px', fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>
            Order Number: {orderNumber}
          </p>
        )}
        <p style={{ marginBottom: '10px', color: 'var(--charcoal)' }}>
          Thank you for your order. We will contact you shortly to confirm.
        </p>
        <p style={{ marginBottom: '30px', color: 'var(--dark-warmth)' }}>
          Payment method: {formData.paymentMethod === 'whatsapp'
            ? 'Order via WhatsApp'
            : PAYMENT_METHODS.find(m => m.id === formData.paymentMethod)?.name}
        </p>
        <Link to="/" className="btn-shop">Continue Shopping</Link>
      </section>
    )
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Checkout</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ background: 'var(--white)', padding: '20px 0', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          {['Information', 'Payment', 'Confirm'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: step > i ? 'var(--muted-gold)' : step === i + 1 ? 'var(--dark)' : 'var(--border)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {step > i + 1 ? <i className="fas fa-check"></i> : i + 1}
              </div>
              <span style={{ fontSize: '14px', color: step >= i + 1 ? 'var(--dark)' : 'var(--text-tertiary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout Content */}
      <section style={{ padding: '40px 0', background: 'var(--cream-bg)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
          {/* Form */}
          <div>
            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>
                    Contact Information
                  </h2>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>First Name *</label>
                      <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required
                        style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Last Name *</label>
                      <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required
                        style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }} />
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Phone (WhatsApp) *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                      placeholder="+5999 XXX XXXX" />
                  </div>

                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginTop: '30px', marginBottom: '20px' }}>
                    Delivery Address
                  </h3>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Street Address *</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} required
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }} />
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Area *</label>
                    <select name="area" value={formData.area} onChange={handleChange} required
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}>
                      <option value="">Select area</option>
                      {DELIVERY.zones.map(zone => (
                        <option key={zone.name} value={zone.name}>{zone.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Landmark (optional)</label>
                    <input type="text" name="landmark" value={formData.landmark} onChange={handleChange}
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                      placeholder="Near..." />
                  </div>

                  <button type="submit" className="btn-shop" style={{ width: '100%', marginTop: '30px', padding: '15px' }}>
                    Continue to Payment
                  </button>
                </div>
              )}

              {step === 2 && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>
                    Payment Method
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {PAYMENT_METHODS.filter(m => m.enabled).map(method => (
                      <label key={method.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        padding: '20px',
                        border: formData.paymentMethod === method.id ? '2px solid var(--muted-gold)' : '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: formData.paymentMethod === method.id ? 'var(--cream-bg)' : 'white'
                      }}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={formData.paymentMethod === method.id}
                          onChange={handleChange}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <i className={`fas ${method.icon}`} style={{ fontSize: '24px', color: 'var(--muted-gold)', width: '30px' }}></i>
                        <div>
                          <p style={{ fontWeight: '600', marginBottom: '3px' }}>{method.name}</p>
                          <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>{method.description}</p>
                        </div>
                      </label>
                    ))}

                    {/* WhatsApp Order Option */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      padding: '20px',
                      border: formData.paymentMethod === 'whatsapp' ? '2px solid #25D366' : '1px solid var(--border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: formData.paymentMethod === 'whatsapp' ? '#E8F8EE' : 'white'
                    }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="whatsapp"
                        checked={formData.paymentMethod === 'whatsapp'}
                        onChange={handleChange}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <i className="fab fa-whatsapp" style={{ fontSize: '24px', color: '#25D366', width: '30px' }}></i>
                      <div>
                        <p style={{ fontWeight: '600', marginBottom: '3px' }}>Order via WhatsApp</p>
                        <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>Complete your order through WhatsApp chat</p>
                      </div>
                    </label>
                  </div>

                  <div style={{ marginTop: '25px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Order Notes (optional)</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange}
                      style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px', minHeight: '80px' }}
                      placeholder="Any special instructions..." />
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                    <button type="button" onClick={() => setStep(1)} className="btn-outline" style={{ flex: 1 }}>
                      Back
                    </button>
                    <button type="submit" className="btn-shop" style={{ flex: 2 }}>
                      Review Order
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>
                    Review Your Order
                  </h2>

                  {orderError && (
                    <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
                      {orderError}
                    </div>
                  )}

                  {/* Customer Info */}
                  <div style={{ marginBottom: '25px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Delivery To:</h4>
                    <p style={{ fontSize: '14px' }}>{formData.firstName} {formData.lastName}</p>
                    <p style={{ fontSize: '14px' }}>{formData.address}</p>
                    <p style={{ fontSize: '14px' }}>{formData.area}, Curacao</p>
                    <p style={{ fontSize: '14px' }}>{formData.phone}</p>
                  </div>

                  {/* Payment */}
                  <div style={{ marginBottom: '25px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Payment Method:</h4>
                    <p style={{ fontSize: '14px' }}>
                      {formData.paymentMethod === 'whatsapp'
                        ? 'Order via WhatsApp'
                        : PAYMENT_METHODS.find(m => m.id === formData.paymentMethod)?.name}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                    <button type="button" onClick={() => setStep(2)} className="btn-outline" style={{ flex: 1 }}>
                      Back
                    </button>
                    <button type="submit" className="btn-shop" style={{ flex: 2 }}>
                      {formData.paymentMethod === 'whatsapp' ? 'Complete via WhatsApp' : 'Place Order'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <div style={{ background: 'var(--white)', padding: '25px', borderRadius: '10px', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '20px' }}>
                Order Summary
              </h3>

              {/* Items */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                {cart.map((item) => (
                  <div key={`${item.id}-${item.size}-${item.color}`} style={{
                    display: 'flex',
                    gap: '12px',
                    paddingBottom: '12px',
                    marginBottom: '12px',
                    borderBottom: '1px solid var(--border-light)'
                  }}>
                    <div style={{ width: '60px', height: '60px', position: 'relative' }}>
                      <img src={item.image || '/images/placeholder.jpg'} alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px' }} />
                      <span style={{
                        position: 'absolute', top: '-8px', right: '-8px',
                        background: 'var(--dark)', color: 'white',
                        width: '20px', height: '20px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '600'
                      }}>
                        {item.quantity}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: '500' }}>{item.name}</p>
                      {(item.size || item.color) && (
                        <p style={{ fontSize: '11px', color: 'var(--dark-warmth)' }}>
                          {item.size} {item.color}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>XCG {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Subtotal</span>
                  <span>XCG {total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Delivery</span>
                  <span>{deliveryFee === 0 ? 'FREE' : `XCG ${deliveryFee.toFixed(2)}`}</span>
                </div>
                {total < DELIVERY.freeShippingThreshold && (
                  <p style={{ fontSize: '12px', color: 'var(--muted-gold)', marginBottom: '10px' }}>
                    Add XCG {(DELIVERY.freeShippingThreshold - total).toFixed(2)} more for free delivery
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '18px', borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginTop: '10px' }}>
                  <span>Total</span>
                  <span>XCG {orderTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Checkout
