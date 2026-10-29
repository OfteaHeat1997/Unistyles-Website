import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { formatXCG } from '../hooks/useCheckoutOptions'

// Online payment page.
//  ?start=1  → create/reuse the payment session and redirect (same tab: no popup blocker)
//  otherwise → poll our backend, which verifies with the provider. URL params
//              from the provider are never trusted as proof of payment.

const POLL_MS = 4000
const MAX_POLLS = 75 // ~5 minutes

function Shell({ icon, color, title, children }) {
  return (
    <section style={{ padding: '80px 20px', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', background: 'var(--white)', padding: '40px 30px', borderRadius: '12px' }}>
        <i className={icon} style={{ fontSize: '64px', color, marginBottom: '20px' }} aria-hidden="true"></i>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', marginBottom: '15px' }}>{title}</h1>
        {children}
      </div>
    </section>
  )
}

function PaymentCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('orderId')
  const token = params.get('t') || ''
  const start = params.get('start') === '1'

  const [state, setState] = useState(start ? 'starting' : 'checking') // starting | redirecting | checking | pending | paid | failed | closed | error
  const [info, setInfo] = useState(null)
  const [message, setMessage] = useState('')
  const polls = useRef(0)

  const orderLink = info?.orderNumber ? `/order/${info.orderNumber}?t=${encodeURIComponent(token)}` : null

  const startPayment = useCallback(async () => {
    setState('starting')
    setMessage('')
    try {
      const data = await api.post('/api/payments/sentoo', { orderId, trackingToken: token })
      if (data.mode === 'mock') {
        navigate(`/payment/mock?orderId=${orderId}&t=${encodeURIComponent(token)}`, { replace: true })
        return
      }
      setState('redirecting')
      window.location.assign(data.paymentUrl)
    } catch (err) {
      if (err.data?.code === 'already_paid') {
        navigate(`/payment/callback?orderId=${orderId}&t=${encodeURIComponent(token)}`, { replace: true })
        return
      }
      if (err.data?.code === 'closed') {
        setState('closed')
        return
      }
      setMessage(err.message)
      setState('error')
    }
  }, [orderId, token, navigate])

  const check = useCallback(async () => {
    try {
      const data = await api.get(`/api/payments/${orderId}/sentoo-status`, { auth: false })
      setInfo(data)
      if (data.paymentStatus === 'paid') return 'paid'
      if (['cancelled', 'expired'].includes(data.orderStatus)) return 'closed'
      if (data.paymentStatus === 'failed') return 'failed'
      return 'pending'
    } catch (err) {
      setMessage(err.message)
      return 'error'
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    if (start) {
      startPayment()
      return
    }
    let timer
    let cancelled = false
    const loop = async () => {
      const result = await check()
      if (cancelled) return
      setState(result)
      if ((result === 'pending' || result === 'error') && polls.current < MAX_POLLS) {
        polls.current += 1
        timer = setTimeout(loop, POLL_MS)
      }
    }
    loop()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [orderId, start, check, startPayment])

  if (!orderId) {
    return (
      <Shell icon="fas fa-question-circle" color="var(--border)" title="Payment not found">
        <p style={{ marginBottom: '25px' }}>This link is missing the order reference.</p>
        <Link to="/track-order" className="btn-shop">Track an order</Link>
      </Shell>
    )
  }

  if (state === 'starting' || state === 'redirecting') {
    return (
      <Shell icon="fas fa-lock" color="var(--muted-gold)" title={state === 'redirecting' ? 'Opening secure payment…' : 'Preparing your payment…'}>
        <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--dark-warmth)' }}>Do not close this page.</p>
      </Shell>
    )
  }

  if (state === 'paid') {
    return (
      <Shell icon="fas fa-check-circle" color="#3D7A5F" title="Payment received">
        <p style={{ marginBottom: '8px' }}>Order <strong>{info?.orderNumber}</strong> is confirmed.</p>
        <p style={{ marginBottom: '25px', color: 'var(--dark-warmth)' }}>We sent the confirmation to your email / WhatsApp.</p>
        {orderLink && <Link to={orderLink} className="btn-shop">View my order</Link>}
      </Shell>
    )
  }

  if (state === 'failed') {
    return (
      <Shell icon="fas fa-times-circle" color="#c0392b" title="Payment not completed">
        <p style={{ marginBottom: '8px' }}>Your payment for order <strong>{info?.orderNumber}</strong> was declined or cancelled. No money was taken.</p>
        <p style={{ marginBottom: '25px', color: 'var(--dark-warmth)' }}>Your items stay reserved until the payment window closes.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-shop" onClick={startPayment}>Try again</button>
          {orderLink && <Link to={orderLink} className="btn-outline">Order details</Link>}
        </div>
      </Shell>
    )
  }

  if (state === 'closed') {
    return (
      <Shell icon="fas fa-hourglass-end" color="#a04000" title="Payment window closed">
        <p style={{ marginBottom: '25px' }}>
          Order {info?.orderNumber ? <strong>{info.orderNumber}</strong> : ''} was not paid in time and has been released.
          If you were charged, contact us on WhatsApp — we will sort it out.
        </p>
        <Link to="/" className="btn-shop">Back to the shop</Link>
      </Shell>
    )
  }

  if (state === 'error' && !info) {
    return (
      <Shell icon="fas fa-exclamation-triangle" color="#a04000" title="We could not check your payment">
        <p style={{ marginBottom: '25px' }}>{message || 'Please try again in a moment.'}</p>
        <button className="btn-shop" onClick={() => window.location.reload()}>Check again</button>
      </Shell>
    )
  }

  // pending / checking
  return (
    <Shell icon="fas fa-clock" color="var(--muted-gold)" title="Waiting for payment confirmation">
      <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
      <p style={{ marginBottom: '8px' }}>
        Order <strong>{info?.orderNumber || '…'}</strong>{info?.amount ? ` · ${formatXCG(info.amount)}` : ''}
      </p>
      <p style={{ marginBottom: '25px', color: 'var(--dark-warmth)' }}>
        This page updates automatically as soon as the bank confirms.
        {info?.expiresAt && <> Reserved until {new Date(info.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</>}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={startPayment}>Open payment page again</button>
        {info?.qrCodeUrl && <a className="btn-outline" href={info.qrCodeUrl} target="_blank" rel="noopener noreferrer">Show QR code</a>}
      </div>
    </Shell>
  )
}

export default PaymentCallback
