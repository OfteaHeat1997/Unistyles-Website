import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { formatXCG } from '../hooks/useCheckoutOptions'

// Demo payment provider (backend PAYMENTS_MODE=mock). It drives the exact
// same server-side confirmation code as the real Sentoo webhook, so a demo
// shows the real state machine: approve, decline (retry), abandon (expiry).

function MockPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('orderId')
  const token = params.get('t') || ''
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/api/orders/${orderId}?t=${encodeURIComponent(token)}`, { auth: false })
      .then(setOrder)
      .catch(err => setError(err.message))
  }, [orderId, token])

  const send = async (outcome) => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/payments/mock/${orderId}`, { outcome, trackingToken: token })
      navigate(`/payment/callback?orderId=${orderId}&t=${encodeURIComponent(token)}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section style={{ padding: '60px 16px', background: '#eef1f5', minHeight: '70vh' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
        <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#7a8699' }}>Demo payment gateway</p>
        <h1 style={{ fontSize: '22px', margin: '6px 0 20px' }}>Pay {order ? formatXCG(order.total) : '…'}</h1>
        {order && (
          <p style={{ fontSize: '14px', marginBottom: '20px', color: '#4a5568' }}>
            Order {order.orderNumber} · {order.items?.length} item(s)
          </p>
        )}
        <div role="note" style={{ background: '#fff8e1', color: '#7a5c00', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '20px' }}>
          Simulated provider for demos — no real money moves. Production uses Sentoo.
        </div>
        {error && <p role="alert" style={{ color: '#c0392b', fontSize: '14px', marginBottom: '15px' }}>{error}</p>}
        <div style={{ display: 'grid', gap: '10px' }}>
          <button disabled={busy || !order} onClick={() => send('approve')}
            style={{ padding: '14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>
            Approve payment
          </button>
          <button disabled={busy || !order} onClick={() => send('decline')}
            style={{ padding: '14px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>
            Decline
          </button>
          <button disabled={busy || !order} onClick={() => send('abandon')}
            style={{ padding: '14px', background: 'white', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>
            Close without paying
          </button>
        </div>
      </div>
    </section>
  )
}

export default MockPayment
