// Visual order progress + the real status history from the server.

const DELIVERY_STEPS = ['confirmed', 'processing', 'out_for_delivery', 'delivered']
const PICKUP_STEPS = ['confirmed', 'processing', 'ready_for_pickup', 'picked_up']
const STEP_LABELS = {
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up'
}
const PROBLEM = new Set(['cancelled', 'expired', 'delivery_failed', 'returned'])

export function StatusBadge({ status, label }) {
  const colors = {
    pending: '#7f8c8d', awaiting_payment: '#e67e22', confirmed: '#2980b9', processing: '#8e44ad',
    ready_for_pickup: '#16a085', out_for_delivery: '#16a085', delivered: '#27ae60', picked_up: '#27ae60',
    delivery_failed: '#c0392b', returned: '#7f8c8d', cancelled: '#c0392b', expired: '#7f8c8d'
  }
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
      background: `${colors[status] || '#7f8c8d'}1a`, color: colors[status] || '#7f8c8d'
    }}>
      {label || status}
    </span>
  )
}

function OrderTimeline({ status, fulfillmentMethod, timeline = [] }) {
  const steps = fulfillmentMethod === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS
  const reached = new Set(timeline.map(t => t.status))
  const currentIndex = steps.indexOf(status)

  return (
    <div>
      {!PROBLEM.has(status) && !['pending', 'awaiting_payment'].includes(status) && (
        <ol style={{ display: 'flex', listStyle: 'none', padding: 0, margin: '0 0 25px', gap: '4px' }} aria-label="Order progress">
          {steps.map((s, i) => {
            const done = i <= currentIndex || reached.has(s)
            return (
              <li key={s} style={{ flex: 1, textAlign: 'center' }} aria-current={i === currentIndex ? 'step' : undefined}>
                <div style={{ height: '6px', borderRadius: '3px', background: done ? 'var(--muted-gold)' : 'var(--border-light)', marginBottom: '8px' }} />
                <span style={{ fontSize: '11px', color: done ? 'var(--dark)' : 'var(--text-tertiary)', fontWeight: i === currentIndex ? 700 : 400 }}>
                  {STEP_LABELS[s]}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: '2px solid var(--border-light)' }}>
        {[...timeline].reverse().map((t, i) => (
          <li key={`${t.status}-${t.at}-${i}`} style={{ position: 'relative', padding: '0 0 16px 18px' }}>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '-7px', top: '3px', width: '12px', height: '12px', borderRadius: '50%',
              background: i === 0 ? 'var(--muted-gold)' : 'var(--border)'
            }} />
            <p style={{ fontSize: '14px', fontWeight: i === 0 ? 600 : 400 }}>{t.label}</p>
            <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
              {new Date(t.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              {t.note && t.note !== 'Order created' && t.note !== 'Order placed online' ? ` · ${t.note}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default OrderTimeline
