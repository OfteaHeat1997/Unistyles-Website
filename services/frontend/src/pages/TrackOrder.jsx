import { useState } from 'react'
import { Link } from 'react-router-dom'

const statusSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
const statusLabels = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Preparing',
  shipped: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}

function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setOrder(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/orders/track/${orderNumber.trim().toUpperCase()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.errors?.[0]?.msg || 'Order not found')
      } else {
        setOrder(data)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentStepIndex = order ? statusSteps.indexOf(order.status) : -1

  return (
    <>
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Track Order</span>
        </div>
      </div>
      <section style={{ padding: '60px 0', minHeight: '60vh' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', textAlign: 'center', marginBottom: '10px' }}>
            Track Your Order
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '30px' }}>
            Enter your order number to see the current status
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="UNI-260323-0001"
              style={{ flex: 1, padding: '14px 20px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '15px' }}
              required
            />
            <button type="submit" className="btn-shop" style={{ padding: '14px 25px' }} disabled={loading}>
              {loading ? 'Checking...' : 'Track'}
            </button>
          </form>

          {error && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {order && (
            <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>Order Number</p>
                  <p style={{ fontSize: '18px', fontWeight: '600' }}>{order.orderNumber}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>Placed On</p>
                  <p style={{ fontSize: '14px' }}>{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {order.status === 'cancelled' ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#fdf2f2', borderRadius: '8px' }}>
                  <i className="fas fa-times-circle" style={{ fontSize: '32px', color: '#dc3545', marginBottom: '10px' }}></i>
                  <p style={{ fontWeight: '600', color: '#dc3545' }}>Order Cancelled</p>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', margin: '20px 0' }}>
                  {/* Progress line */}
                  <div style={{ position: 'absolute', top: '15px', left: '25px', right: '25px', height: '3px', background: 'var(--border-light)' }}>
                    <div style={{ width: `${Math.max(0, currentStepIndex) / (statusSteps.length - 1) * 100}%`, height: '100%', background: 'var(--muted-gold)', transition: 'width 0.5s' }}></div>
                  </div>
                  {statusSteps.map((step, i) => (
                    <div key={step} style={{ textAlign: 'center', position: 'relative', zIndex: 1, flex: 1 }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 8px',
                        background: i <= currentStepIndex ? 'var(--muted-gold)' : 'var(--border-light)',
                        color: i <= currentStepIndex ? '#fff' : 'var(--text-tertiary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
                      }}>
                        {i <= currentStepIndex ? <i className="fas fa-check"></i> : (i + 1)}
                      </div>
                      <p style={{ fontSize: '11px', color: i <= currentStepIndex ? 'var(--dark)' : 'var(--text-tertiary)' }}>
                        {statusLabels[step]}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {order.deliveryDate && (
                <div style={{ marginTop: '20px', padding: '15px', background: 'var(--cream-bg)', borderRadius: '8px', fontSize: '14px' }}>
                  <i className="fas fa-calendar" style={{ color: 'var(--muted-gold)', marginRight: '8px' }}></i>
                  Expected delivery: <strong>{order.deliveryDate}</strong>
                  {order.deliveryTimeSlot && <span> ({order.deliveryTimeSlot})</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default TrackOrder
