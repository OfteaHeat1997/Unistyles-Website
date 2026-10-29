import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { card, input, money, Loading, ErrorBox, Empty, StatusPill, Pill } from './ui'
import { OrderDrawer } from './AdminOrders'

const today = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10)

function SlotColumn({ title, icon, slots, onOpen }) {
  return (
    <div style={{ ...card }}>
      <h3 style={{ fontSize: '15px', marginBottom: '12px' }}><i className={`fas ${icon}`} style={{ marginRight: '8px', color: 'var(--muted-gold)' }}></i>{title}</h3>
      {slots.length === 0 && <Empty>No time windows on this day.</Empty>}
      {slots.map(s => (
        <div key={s.slotId} style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ fontSize: '13px' }}>{s.label}</strong>
            <Pill color={s.orders.length >= s.capacity ? '#c0392b' : '#27ae60'}>{s.orders.length}/{s.capacity}</Pill>
          </div>
          {s.orders.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Nothing booked</p>}
          {s.orders.map(o => (
            <button key={o.id} type="button" onClick={() => onOpen(o.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--cream-bg)', border: 'none', borderRadius: '6px', padding: '10px', marginBottom: '6px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>{o.orderNumber}</strong>
                <StatusPill status={o.status} label={o.statusLabel} />
              </div>
              <p style={{ fontSize: '12px' }}>{o.customerName} · {o.customerPhone}</p>
              {o.address && <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>{o.address}{o.zone ? ` · ${o.zone}` : ''}</p>}
              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
                {money(o.total)} · {o.paymentStatus === 'pending_delivery' ? 'collect cash' : o.paymentStatus.replace(/_/g, ' ')}
                {o.driverName ? ` · driver ${o.driverName}` : ''}
              </p>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function AdminSchedule() {
  const [date, setDate] = useState(today())
  const [openId, setOpenId] = useState(null)
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'schedule', date],
    queryFn: () => api.get(`/api/admin/schedule?date=${date}`),
    refetchInterval: 60000
  })
  const shift = (days) => {
    const d = new Date(`${date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => shift(-1)} style={input} aria-label="Previous day"><i className="fas fa-chevron-left"></i></button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} aria-label="Date" />
        <button type="button" onClick={() => shift(1)} style={input} aria-label="Next day"><i className="fas fa-chevron-right"></i></button>
        <button type="button" onClick={() => setDate(today())} style={input}>Today</button>
        {data?.blocked?.length > 0 && <Pill color="#c0392b">Closed: {data.blocked.map(b => b.reason || b.method || 'all').join(', ')}</Pill>}
      </div>
      <ErrorBox error={error} onRetry={refetch} />
      {isLoading ? <Loading /> : data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <SlotColumn title="Deliveries" icon="fa-truck" slots={data.delivery} onOpen={setOpenId} />
          <SlotColumn title="Pickups" icon="fa-store" slots={data.pickup} onOpen={setOpenId} />
        </div>
      )}
      {openId && (
        <OrderDrawer orderId={openId} onClose={() => setOpenId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin'] })} />
      )}
    </div>
  )
}

export default AdminSchedule
