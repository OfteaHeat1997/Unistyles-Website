import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'

// Look up an order with its number + the last 4 digits of the phone used.
// The server answers the same way for "no such order" and "wrong phone".

function TrackOrder() {
  const navigate = useNavigate()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const number = orderNumber.trim().toUpperCase()
    if (!/^UNI-\d{6}-\d{4}$/.test(number)) {
      setError('Order numbers look like UNI-261025-0001')
      return
    }
    if (phone.replace(/\D/g, '').length < 4) {
      setError('Enter at least the last 4 digits of your phone number')
      return
    }
    setLoading(true)
    try {
      const data = await api.get(`/api/orders/track/${number}?phone=${encodeURIComponent(phone)}`, { auth: false })
      navigate(`/order/${data.orderNumber}?t=${encodeURIComponent(data.trackingToken)}`)
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts. Please wait a few minutes.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ padding: '60px 16px', background: 'var(--cream-bg)', minHeight: '60vh' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', background: 'var(--white)', padding: '35px 30px', borderRadius: '12px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', marginBottom: '10px' }}>Track your order</h1>
        <p style={{ fontSize: '14px', color: 'var(--dark-warmth)', marginBottom: '25px' }}>
          Use the order number from your confirmation and the phone number you ordered with.
        </p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="orderNumber" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Order number</label>
          <input id="orderNumber" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="UNI-261025-0001" autoComplete="off"
            style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '15px', textTransform: 'uppercase', marginBottom: '18px' }} />
          <label htmlFor="phone" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Phone (or its last 4 digits)</label>
          <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="4567" autoComplete="tel"
            style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '15px', marginBottom: '18px' }} />
          {error && <p role="alert" style={{ color: '#c0392b', fontSize: '13px', marginBottom: '15px' }}>{error}</p>}
          <button type="submit" className="btn-shop" disabled={loading} style={{ width: '100%', padding: '14px' }}>
            {loading ? 'Searching…' : 'Find my order'}
          </button>
        </form>
        <p style={{ fontSize: '13px', marginTop: '20px', textAlign: 'center' }}>
          Have an account? <Link to="/profile" style={{ color: 'var(--muted-gold)' }}>See all your orders</Link>
        </p>
      </div>
    </section>
  )
}

export default TrackOrder
