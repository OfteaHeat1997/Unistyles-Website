import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const attempt = searchParams.get('attempt') || 'unknown'
  const orderId = searchParams.get('orderId')

  const [status, setStatus] = useState('loading') // loading, success, pending, failed, cancelled, rejected, error
  const [orderData, setOrderData] = useState(null)
  const [sentooData, setSentooData] = useState(null)
  const [paymentUrl, setPaymentUrl] = useState(null)
  const pollRef = useRef(null)
  const hasConfirmed = useRef(false)

  // Fetch real payment status from our backend (never trust URL params)
  const fetchPaymentStatus = async () => {
    if (!orderId) {
      setStatus('error')
      return
    }

    try {
      const response = await fetch(`/api/payments/${orderId}/sentoo-status`)
      if (!response.ok) {
        setStatus('error')
        return
      }

      const data = await response.json()
      setOrderData(data)
      setPaymentUrl(data.paymentUrl)
      setSentooData(data.sentooData)

      // Use backend-verified status, not URL param
      if (data.paymentStatus === 'paid' || data.sentooStatus === 'success') {
        setStatus('success')
        hasConfirmed.current = true
        // Stop polling
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } else if (data.sentooStatus === 'cancelled' || data.sentooStatus === 'expired') {
        setStatus('failed')
      } else if (['issued', 'pending'].includes(data.sentooStatus)) {
        // Still processing — use attempt param for initial UX
        if (attempt === 'cancelled' || attempt === 'rejected') {
          setStatus(attempt)
        } else {
          setStatus('pending')
        }
      } else {
        // Fall back to attempt param for display only
        setStatus(attempt === 'success' ? 'pending' : attempt)
      }
    } catch (err) {
      console.error('Failed to fetch payment status:', err)
      // Fall back to attempt param for display
      setStatus(attempt)
    }
  }

  useEffect(() => {
    // Try to recover paymentUrl from localStorage
    if (!paymentUrl) {
      const stored = localStorage.getItem(`sentoo_payment_${orderId}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setPaymentUrl(parsed.paymentUrl)
        } catch (e) { /* ignore */ }
      }
    }

    fetchPaymentStatus()

    // Try WebSocket for real-time updates
    let socket = null
    if (orderId) {
      import('socket.io-client').then(({ io }) => {
        socket = io(window.location.origin, { path: '/ws', transports: ['websocket', 'polling'] })
        socket.on('connect', () => {
          socket.emit('join-order', orderId)
        })
        socket.on('payment-update', (data) => {
          if (data.status === 'paid') {
            setStatus('success')
            hasConfirmed.current = true
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
          } else if (data.status === 'failed') {
            setStatus('failed')
          }
          fetchPaymentStatus()
        })
      }).catch(() => { /* WebSocket not available, polling is the fallback */ })
    }

    // Poll for status updates as fallback (every 5 seconds)
    pollRef.current = setInterval(() => {
      if (!hasConfirmed.current) {
        fetchPaymentStatus()
      }
    }, 5000)

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current) }
      if (socket) { socket.disconnect() }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop polling after 5 minutes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 5 * 60 * 1000)
    return () => clearTimeout(timeout)
  }, [])

  const containerStyle = {
    padding: '100px 0',
    background: 'var(--cream-bg)',
    textAlign: 'center',
    minHeight: '60vh'
  }

  const cardStyle = {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '40px 30px',
    background: 'var(--white)',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  }

  const iconStyle = (color) => ({
    fontSize: '64px',
    color,
    marginBottom: '20px',
    display: 'block'
  })

  // SUCCESS
  if (status === 'success') {
    return (
      <section style={containerStyle}>
        <div style={cardStyle}>
          <i className="fas fa-check-circle" style={iconStyle('#3D7A5F')}></i>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
            Payment Successful
          </h2>
          {orderData?.orderNumber && (
            <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)', marginBottom: '10px' }}>
              Order: {orderData.orderNumber}
            </p>
          )}
          <p style={{ color: 'var(--charcoal)', marginBottom: '25px' }}>
            Your payment has been confirmed. We will prepare your order shortly.
          </p>
          <Link to="/" className="btn-shop" style={{ display: 'inline-block' }}>
            Continue Shopping
          </Link>
        </div>
      </section>
    )
  }

  // PENDING
  if (status === 'pending' || status === 'loading') {
    return (
      <section style={containerStyle}>
        <div style={cardStyle}>
          <i className="fas fa-spinner fa-spin" style={iconStyle('var(--muted-gold)')}></i>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
            Payment Processing
          </h2>
          <p style={{ color: 'var(--charcoal)', marginBottom: '15px' }}>
            Your payment is being processed. This page will update automatically.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Please do not close this page. You will be notified once the payment is confirmed.
          </p>
        </div>
      </section>
    )
  }

  // CANCELLED
  if (status === 'cancelled') {
    return (
      <section style={containerStyle}>
        <div style={cardStyle}>
          <i className="fas fa-times-circle" style={iconStyle('var(--dark-warmth)')}></i>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
            Payment Cancelled
          </h2>
          <p style={{ color: 'var(--charcoal)', marginBottom: '25px' }}>
            You cancelled the payment. No charges were made.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {paymentUrl && (
              <a href={paymentUrl} className="btn-shop" style={{ display: 'inline-block' }}>
                Try Again
              </a>
            )}
            <Link to="/checkout" className="btn-outline" style={{ display: 'inline-block' }}>
              Back to Checkout
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // REJECTED
  if (status === 'rejected') {
    const processorMessage = sentooData?.responses?.[sentooData.responses.length - 1]?.message

    return (
      <section style={containerStyle}>
        <div style={cardStyle}>
          <i className="fas fa-exclamation-circle" style={iconStyle('#C0392B')}></i>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
            Payment Rejected
          </h2>
          <p style={{ color: 'var(--charcoal)', marginBottom: '10px' }}>
            The payment was rejected by the processor.
          </p>
          {processorMessage && (
            <p style={{
              background: 'var(--cream-bg)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--dark-warmth)',
              marginBottom: '20px'
            }}>
              Reason: {processorMessage}
            </p>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '25px' }}>
            You can try again with a different payment method or bank account.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {paymentUrl && (
              <a href={paymentUrl} className="btn-shop" style={{ display: 'inline-block' }}>
                Try Again
              </a>
            )}
            <Link to="/checkout" className="btn-outline" style={{ display: 'inline-block' }}>
              Back to Checkout
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // FAILED (technical error)
  if (status === 'failed') {
    return (
      <section style={containerStyle}>
        <div style={cardStyle}>
          <i className="fas fa-exclamation-triangle" style={iconStyle('#E67E22')}></i>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
            Payment Failed
          </h2>
          <p style={{ color: 'var(--charcoal)', marginBottom: '25px' }}>
            A technical error occurred during payment processing. Sentoo has been notified and will resolve this as soon as possible.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/checkout" className="btn-outline" style={{ display: 'inline-block' }}>
              Back to Checkout
            </Link>
            <Link to="/" className="btn-shop" style={{ display: 'inline-block' }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // ERROR / UNKNOWN
  return (
    <section style={containerStyle}>
      <div style={cardStyle}>
        <i className="fas fa-question-circle" style={iconStyle('var(--text-tertiary)')}></i>
        <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>
          Payment Status Unknown
        </h2>
        <p style={{ color: 'var(--charcoal)', marginBottom: '15px' }}>
          We could not determine the status of your payment. This page will check for updates automatically.
        </p>
        {orderId && (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '25px' }}>
            If the issue persists, please contact us with your order reference.
          </p>
        )}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {paymentUrl && (
            <a href={paymentUrl} className="btn-shop" style={{ display: 'inline-block' }}>
              Try Again
            </a>
          )}
          <Link to="/" className="btn-outline" style={{ display: 'inline-block' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </section>
  )
}

export default PaymentCallback
