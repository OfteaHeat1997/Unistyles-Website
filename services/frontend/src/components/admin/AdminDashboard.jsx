import { useQuery } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { card, money, Loading, ErrorBox, StatusPill } from './ui'

function Kpi({ label, value, hint, onClick, accent }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      style={{ ...card, textAlign: 'left', border: 'none', cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${accent || 'var(--muted-gold)'}` }}>
      <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</p>
      <p style={{ fontSize: '26px', fontWeight: 700, margin: '6px 0 2px' }}>{value}</p>
      {hint && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{hint}</p>}
    </button>
  )
}

function AdminDashboard({ goTo }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/api/admin/stats'),
    refetchInterval: 60000
  })

  if (isLoading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={refetch} />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <Kpi label="Orders today" value={data.ordersToday} onClick={() => goTo('orders')} />
        <Kpi label="To prepare" value={data.toPrepare} hint="Confirmed, not started" accent="#2980b9" onClick={() => goTo('orders', { status: 'confirmed' })} />
        <Kpi label="Awaiting payment" value={data.awaitingPayment} accent="#e67e22" onClick={() => goTo('orders', { status: 'awaiting_payment' })} />
        <Kpi label="Needs review" value={data.needsReview} hint="Payment issues, refunds" accent="#c0392b" onClick={() => goTo('orders', { needsReview: true })} />
        <Kpi label="Deliveries today" value={data.deliveriesToday} accent="#16a085" onClick={() => goTo('schedule')} />
        <Kpi label="Pickups today" value={data.pickupsToday} accent="#16a085" onClick={() => goTo('schedule')} />
        <Kpi label="Low stock" value={data.lowStock} hint="≤ 2 units" accent="#8e44ad" onClick={() => goTo('inventory', { lowStock: true })} />
        <Kpi label="Revenue (month, paid)" value={money(data.revenueMonth)} hint={`All time ${money(data.revenuePaid)}`} accent="#27ae60" onClick={() => goTo('payments')} />
      </div>

      <div style={card}>
        <h3 style={{ fontSize: '15px', marginBottom: '15px' }}>Orders by status ({data.totalOrders})</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {data.ordersByStatus.map(s => (
            <button key={s.status} type="button" onClick={() => goTo('orders', { status: s.status })}
              style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusPill status={s.status} label={s.label} /> <strong>{s.count}</strong>
            </button>
          ))}
          {data.ordersByStatus.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No orders yet.</p>}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
