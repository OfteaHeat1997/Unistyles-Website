import { useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { formatXCG } from '../hooks/useCheckoutOptions'
import OrderTimeline, { StatusBadge } from '../components/OrderTimeline'

// Confirmation + tracking page: /order/:orderNumber?t=<trackingToken>
// Readable by the token holder, the account owner or an admin.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(typeof iso === 'string' && iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

const box = { background: 'var(--white)', borderRadius: '10px', padding: '25px', marginBottom: '20px' }

function NextStep({ order }) {
  const pay = order.paymentStatus
  if (order.status === 'cancelled' || order.status === 'expired') return null

  if (order.paymentMethod === 'sentoo' && pay !== 'paid') {
    return (
      <div style={{ ...box, borderLeft: '4px solid #e67e22' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>Payment pending</h2>
        <p style={{ fontSize: '14px', marginBottom: '15px' }}>Complete your online payment to confirm the order.</p>
        <Link className="btn-shop" to={`/payment/callback?orderId=${order.id}&t=${encodeURIComponent(order.trackingToken)}&start=1`}>
          Pay {formatXCG(order.total)} now
        </Link>
      </div>
    )
  }
  if (order.paymentMethod === 'bank_transfer' && pay !== 'paid') {
    const b = order.bankDetails || {}
    return (
      <div style={{ ...box, borderLeft: '4px solid #e67e22' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>Transfer {formatXCG(order.total)} to confirm your order</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 15px', fontSize: '14px', margin: '10px 0' }}>
          <dt>Bank</dt><dd>{b.bankName}</dd>
          <dt>Account name</dt><dd>{b.accountName}</dd>
          <dt>Account no.</dt><dd>{b.accountNumber}</dd>
          {b.swift && <><dt>SWIFT</dt><dd>{b.swift}</dd></>}
          <dt>Reference</dt><dd><strong>{order.orderNumber}</strong></dd>
        </dl>
        {order.paymentExpiresAt && (
          <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
            We hold your items until {new Date(order.paymentExpiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
        )}
        {order.supportWhatsapp && (
          <a className="btn-whatsapp" style={{ marginTop: '10px', display: 'inline-flex' }} target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${order.supportWhatsapp}?text=${encodeURIComponent(`Bon dia! Proof of transfer for order ${order.orderNumber}`)}`}>
            <i className="fab fa-whatsapp"></i> Send proof of transfer
          </a>
        )}
      </div>
    )
  }
  if (order.paymentMethod === 'whatsapp' && order.status === 'pending') {
    return (
      <div style={{ ...box, borderLeft: '4px solid #1B4D4F' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>We will confirm on WhatsApp</h2>
        <p style={{ fontSize: '14px', marginBottom: '15px' }}>Message us with your order number to arrange payment.</p>
        {order.supportWhatsapp && (
          <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex' }}
            href={`https://wa.me/${order.supportWhatsapp}?text=${encodeURIComponent(`Bon dia! I placed order ${order.orderNumber} (${formatXCG(order.total)})`)}`}>
            <i className="fab fa-whatsapp"></i> Open WhatsApp
          </a>
        )}
      </div>
    )
  }
  if (pay === 'pending_delivery') {
    return (
      <div style={{ ...box, borderLeft: '4px solid #2980b9' }}>
        <p style={{ fontSize: '14px' }}>
          <i className="fas fa-money-bill-wave" style={{ marginRight: '8px', color: 'var(--muted-gold)' }}></i>
          Please have <strong>{formatXCG(order.total)}</strong> ready {order.fulfillmentMethod === 'pickup' ? 'when you pick up' : 'for the driver'}.
        </p>
      </div>
    )
  }
  return null
}

function OrderDetail() {
  const { orderNumber } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const token = params.get('t') || ''
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderNumber, token],
    queryFn: () => api.get(`/api/orders/by-number/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`),
    refetchInterval: (q) => (['delivered', 'picked_up', 'cancelled', 'expired', 'returned'].includes(q.state.data?.status) ? false : 30000),
    retry: 1
  })

  const cancel = async () => {
    setCancelling(true)
    setCancelError('')
    try {
      await api.put(`/api/orders/${order.id}/cancel`, { trackingToken: token })
      await queryClient.invalidateQueries({ queryKey: ['order', orderNumber, token] })
      setConfirmCancel(false)
    } catch (err) {
      setCancelError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
  }

  if (error || !order) {
    return (
      <section style={{ padding: '100px 20px', textAlign: 'center', background: 'var(--cream-bg)', minHeight: '60vh' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>Order not found</h1>
        <p style={{ marginBottom: '25px' }}>The link may be incomplete. You can look your order up with its number and your phone.</p>
        <Link to="/track-order" className="btn-shop">Track an order</Link>
      </section>
    )
  }

  const justPlaced = location.state?.justPlaced

  return (
    <section style={{ padding: '40px 16px', background: 'var(--cream-bg)', minHeight: '70vh' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {justPlaced && (
          <div role="status" style={{ ...box, textAlign: 'center' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '56px', color: '#3D7A5F', marginBottom: '10px' }}></i>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px' }}>Thank you, your order is placed!</h1>
            <p style={{ color: 'var(--dark-warmth)', marginTop: '6px' }}>Save this page — it always shows the latest status.</p>
          </div>
        )}

        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>Order</p>
              <h2 style={{ fontSize: '22px', fontWeight: 700 }}>{order.orderNumber}</h2>
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>{new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <StatusBadge status={order.status} label={order.statusLabel} />
          </div>
          <OrderTimeline status={order.status} fulfillmentMethod={order.fulfillmentMethod} timeline={order.timeline} />
        </div>

        <NextStep order={order} />

        <div style={box}>
          <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>
            <i className={`fas ${order.fulfillmentMethod === 'pickup' ? 'fa-store' : 'fa-truck'}`} style={{ marginRight: '8px', color: 'var(--muted-gold)' }}></i>
            {order.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
          </h2>
          {order.fulfillmentMethod === 'pickup' && order.pickupLocation && (
            <>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>{order.pickupLocation.name}</p>
              <p style={{ fontSize: '14px' }}>{order.pickupLocation.address}</p>
              {order.pickupLocation.instructions && <p style={{ fontSize: '13px', color: 'var(--dark-warmth)', marginTop: '6px' }}>{order.pickupLocation.instructions}</p>}
            </>
          )}
          {order.fulfillmentMethod === 'delivery' && order.shippingAddress && (
            <p style={{ fontSize: '14px' }}>
              {order.shippingAddress.street}{order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ''}
              {order.shippingAddress.landmark && <><br /><span style={{ color: 'var(--dark-warmth)' }}>{order.shippingAddress.landmark}</span></>}
            </p>
          )}
          {order.fulfillmentDate && (
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              <i className="far fa-calendar" style={{ marginRight: '6px' }}></i>{formatDate(order.fulfillmentDate)}, {order.fulfillmentSlot}
            </p>
          )}
        </div>

        <div style={box}>
          <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Items</h2>
          {order.items.map((i, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <img src={i.imageUrl || '/images/placeholder.jpg'} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px' }}>{i.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>{[i.size, i.color].filter(Boolean).join(' / ')}{i.sku ? ` · ${i.sku}` : ''} · ×{i.quantity}</p>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>{formatXCG(i.lineTotal)}</p>
            </div>
          ))}
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', fontSize: '14px', marginTop: '15px' }}>
            <dt>Subtotal</dt><dd>{formatXCG(order.subtotal)}</dd>
            {order.discount > 0 && <><dt style={{ color: '#3D7A5F' }}>Discount {order.couponCode ? `(${order.couponCode})` : ''}</dt><dd style={{ color: '#3D7A5F' }}>−{formatXCG(order.discount)}</dd></>}
            <dt>{order.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{order.deliveryFee === 0 ? 'Free' : formatXCG(order.deliveryFee)}</dd>
            <dt style={{ fontWeight: 700, fontSize: '16px' }}>Total</dt><dd style={{ fontWeight: 700, fontSize: '16px' }}>{formatXCG(order.total)}</dd>
          </dl>
          <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginTop: '10px' }}>
            Payment: {order.paymentMethod.replace('_', ' ')} · <StatusBadge status={order.paymentStatus === 'paid' ? 'delivered' : 'awaiting_payment'} label={order.paymentStatus.replace('_', ' ')} />
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Link to="/" className="btn-outline">Continue shopping</Link>
          {order.supportWhatsapp && (
            <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', marginLeft: 0 }}
              href={`https://wa.me/${order.supportWhatsapp}?text=${encodeURIComponent(`Bon dia! Question about order ${order.orderNumber}`)}`}>
              <i className="fab fa-whatsapp"></i> Need help?
            </a>
          )}
          {order.canCancel && !confirmCancel && (
            <button type="button" className="btn-outline" onClick={() => setConfirmCancel(true)} style={{ color: '#c0392b', borderColor: '#c0392b' }}>
              Cancel order
            </button>
          )}
        </div>
        {confirmCancel && (
          <div role="alertdialog" aria-label="Confirm cancellation" style={{ ...box, marginTop: '20px', border: '1px solid #c0392b' }}>
            <p style={{ marginBottom: '15px' }}>Cancel order {order.orderNumber}? This cannot be undone.</p>
            {cancelError && <p role="alert" style={{ color: '#c0392b', fontSize: '13px', marginBottom: '10px' }}>{cancelError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-outline" onClick={() => setConfirmCancel(false)} disabled={cancelling}>Keep order</button>
              <button className="btn-shop" style={{ background: '#c0392b' }} onClick={cancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default OrderDetail
