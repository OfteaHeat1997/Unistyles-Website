// Small shared building blocks for the admin screens.

export const card = { background: 'var(--white)', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }
export const input = { padding: '9px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'white' }
export const th = { textAlign: 'left', padding: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--dark-warmth)', borderBottom: '2px solid var(--border-light)' }
export const td = { padding: '10px', fontSize: '13px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' }

export const money = (n) => `XCG ${Number(n || 0).toFixed(2)}`
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '')
export const dayLabel = (iso) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00Z` : iso)
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function Loading({ text = 'Loading…' }) {
  return <p style={{ padding: '30px', textAlign: 'center', color: 'var(--dark-warmth)' }}>{text}</p>
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div role="alert" style={{ background: '#fdecea', color: '#c0392b', padding: '12px 15px', borderRadius: '6px', fontSize: '13px', margin: '10px 0' }}>
      {error.message || String(error)}
      {onRetry && <button onClick={onRetry} style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#c0392b', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>}
    </div>
  )
}

export function Empty({ children }) {
  return <p style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>{children}</p>
}

export function Pill({ children, color = '#7f8c8d' }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: `${color}1a`, color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

const STATUS_COLORS = {
  pending: '#7f8c8d', awaiting_payment: '#e67e22', confirmed: '#2980b9', processing: '#8e44ad',
  ready_for_pickup: '#16a085', out_for_delivery: '#16a085', delivered: '#27ae60', picked_up: '#27ae60',
  delivery_failed: '#c0392b', returned: '#7f8c8d', cancelled: '#c0392b', expired: '#7f8c8d',
  paid: '#27ae60', pending_delivery: '#2980b9', failed: '#c0392b', refunded: '#7f8c8d', partially_refunded: '#e67e22'
}

export function StatusPill({ status, label }) {
  return <Pill color={STATUS_COLORS[status]}>{label || String(status || '').replace(/_/g, ' ')}</Pill>
}

export function Button({ children, variant = 'default', ...props }) {
  const styles = {
    default: { background: 'white', color: 'var(--dark)', border: '1px solid var(--border)' },
    primary: { background: 'var(--dark)', color: 'white', border: '1px solid var(--dark)' },
    gold: { background: 'var(--muted-gold)', color: 'white', border: '1px solid var(--muted-gold)' },
    danger: { background: 'white', color: '#c0392b', border: '1px solid #c0392b' }
  }
  return (
    <button type="button" {...props}
      style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1, minHeight: '36px', ...styles[variant], ...props.style }}>
      {children}
    </button>
  )
}

export function PendingBadge() {
  return <Pill color="#e67e22">Pending owner approval</Pill>
}
