import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { card, input, th, td, money, shortDate, dayLabel, Loading, ErrorBox, Empty, StatusPill, Button, Pill } from './ui'

const STATUSES = ['pending', 'awaiting_payment', 'confirmed', 'processing', 'ready_for_pickup', 'picked_up',
  'out_for_delivery', 'delivered', 'delivery_failed', 'returned', 'cancelled', 'expired']

function OrderDrawer({ orderId, onClose, onChanged }) {
  const queryClient = useQueryClient()
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'order', orderId],
    queryFn: () => api.get(`/api/admin/orders/${orderId}`)
  })
  const { data: drivers } = useQuery({ queryKey: ['admin', 'drivers'], queryFn: () => api.get('/api/admin/drivers'), staleTime: 300000 })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [note, setNote] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [refund, setRefund] = useState(null)
  const [confirmTo, setConfirmTo] = useState(null)

  useEffect(() => { if (order) setAdminNotes(order.adminNotes || '') }, [order])

  const run = async (fn) => {
    setBusy(true)
    setActionError('')
    try {
      const updated = await fn()
      if (updated?.id) queryClient.setQueryData(['admin', 'order', orderId], updated)
      else await refetch()
      setNote('')
      onChanged()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Destructive transitions need a second click (no browser confirm dialogs)
  const transition = (to) => {
    if ((to === 'cancelled' || to === 'returned') && confirmTo !== to) {
      setConfirmTo(to)
      return
    }
    setConfirmTo(null)
    run(() => api.post(`/api/admin/orders/${orderId}/transition`, { to, note: note || undefined }))
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Order details"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 2000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '640px', maxWidth: '100%', height: '100%', overflowY: 'auto', background: 'var(--cream-bg)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '20px' }}>{order?.orderNumber || 'Order'}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}><i className="fas fa-times"></i></button>
        </div>
        {isLoading && <Loading />}
        <ErrorBox error={error} onRetry={refetch} />
        {order && (
          <>
            <div style={{ ...card, marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <StatusPill status={order.status} label={order.statusLabel} />
                <StatusPill status={order.paymentStatus} label={`payment: ${order.paymentStatus.replace(/_/g, ' ')}`} />
                <Pill>{order.fulfillmentMethod}</Pill>
                <Pill>{order.paymentMethod.replace('_', ' ')}</Pill>
                {order.needsReview && <Pill color="#c0392b">needs review</Pill>}
              </div>
              <p style={{ fontSize: '13px' }}><strong>{order.customer?.name}</strong> · <a href={`tel:${order.customer?.phone}`}>{order.customer?.phone}</a>{order.customer?.email ? ` · ${order.customer.email}` : ''}</p>
              {order.customer?.phone && (
                <a href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bon dia ${order.customer.name}! About your order ${order.orderNumber}:`)}`}
                  target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#1B4D4F' }}>
                  <i className="fab fa-whatsapp"></i> WhatsApp customer
                </a>
              )}
              <p style={{ fontSize: '13px', marginTop: '10px' }}>
                {order.fulfillmentMethod === 'pickup'
                  ? <>Pickup at {order.pickupLocation?.name}</>
                  : <>{order.shippingAddress?.street}{order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ''}{order.shippingAddress?.landmark ? ` (${order.shippingAddress.landmark})` : ''}</>}
                {' · '}{dayLabel(order.fulfillmentDate)} {order.fulfillmentSlot}
              </p>
              {order.shippingAddress?.lat && (
                <a href={`https://www.google.com/maps?q=${order.shippingAddress.lat},${order.shippingAddress.lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--muted-gold)' }}>
                  Open pin in Maps
                </a>
              )}
              {order.notes && <p style={{ fontSize: '13px', marginTop: '8px', fontStyle: 'italic' }}>“{order.notes}”</p>}
            </div>

            {/* Actions */}
            <div style={{ ...card, marginBottom: '15px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Actions</h3>
              <ErrorBox error={actionError ? { message: actionError } : null} />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the history (optional)" style={{ ...input, width: '100%', marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {order.allowedTransitions.map(t => (
                  <Button key={t.status} disabled={busy} variant={['cancelled', 'returned', 'delivery_failed'].includes(t.status) ? 'danger' : 'primary'} onClick={() => transition(t.status)}>
                    {confirmTo === t.status ? `Confirm: ${t.label} (stock is returned)` : `→ ${t.label}`}
                  </Button>
                ))}
                {order.allowedTransitions.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No further status changes.</span>}
              </div>
              {order.status === 'confirmed' && !['paid', 'pending_delivery'].includes(order.paymentStatus) && (
                <p style={{ fontSize: '12px', color: '#a04000', marginTop: '8px' }}>Preparation unlocks once payment is confirmed.</p>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                {order.paymentStatus !== 'paid' && order.paymentMethod !== 'sentoo' && !['cancelled', 'expired'].includes(order.status) && (
                  <Button variant="gold" disabled={busy} onClick={() => run(() => api.post(`/api/admin/orders/${orderId}/mark-paid`, { note: note || undefined }))}>
                    <i className="fas fa-check"></i> Mark as paid
                  </Button>
                )}
                {order.paymentMethod === 'sentoo' && order.payment?.hasOnlineSession && order.paymentStatus !== 'paid' && (
                  <Button disabled={busy} onClick={() => run(async () => (await api.post(`/api/admin/orders/${orderId}/recheck-payment`)).order)}>
                    <i className="fas fa-sync"></i> Re-check payment
                  </Button>
                )}
                {['paid', 'partially_refunded'].includes(order.paymentStatus) && (
                  <Button variant="danger" disabled={busy} onClick={() => setRefund({ amount: order.total, reason: '', method: order.paymentMethod === 'sentoo' ? 'sentoo_dashboard' : 'cash' })}>
                    Refund…
                  </Button>
                )}
                {order.fulfillmentMethod === 'delivery' && (
                  <select aria-label="Assign driver" value={order.driver?.id || ''} disabled={busy} style={input}
                    onChange={e => run(() => api.put(`/api/admin/orders/${orderId}`, { assignedDriverId: e.target.value || null }))}>
                    <option value="">Assign driver…</option>
                    {(drivers?.drivers || []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
                  </select>
                )}
                {order.needsReview && (
                  <Button disabled={busy} onClick={() => run(() => api.put(`/api/admin/orders/${orderId}`, { needsReview: false }))}>Clear review flag</Button>
                )}
              </div>
              {refund && (
                <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #c0392b', borderRadius: '8px' }}>
                  <p style={{ fontSize: '13px', marginBottom: '8px' }}>Record a refund (do the actual refund in Sentoo / cash / bank first).</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input type="number" min="0.01" step="0.01" value={refund.amount} onChange={e => setRefund({ ...refund, amount: e.target.value })} style={{ ...input, width: '110px' }} aria-label="Refund amount" />
                    <select value={refund.method} onChange={e => setRefund({ ...refund, method: e.target.value })} style={input} aria-label="Refund method">
                      <option value="sentoo_dashboard">Sentoo dashboard</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                    <input value={refund.reason} onChange={e => setRefund({ ...refund, reason: e.target.value })} placeholder="Reason" style={{ ...input, flex: 1, minWidth: '140px' }} aria-label="Refund reason" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <Button onClick={() => setRefund(null)}>Cancel</Button>
                    <Button variant="danger" disabled={busy || !refund.reason.trim()}
                      onClick={() => run(async () => { const r = await api.post(`/api/admin/orders/${orderId}/refund`, { ...refund, amount: Number(refund.amount) }); setRefund(null); return r })}>
                      Record refund
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ ...card, marginBottom: '15px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Items</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {order.items.map((i, idx) => (
                    <tr key={idx}>
                      <td style={td}>{i.name}<br /><span style={{ fontSize: '11px', color: 'var(--dark-warmth)' }}>{[i.sku, i.size, i.color].filter(Boolean).join(' · ')}</span></td>
                      <td style={td}>×{i.quantity}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(i.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr><td style={td} colSpan={2}>Subtotal</td><td style={{ ...td, textAlign: 'right' }}>{money(order.subtotal)}</td></tr>
                  {order.discount > 0 && <tr><td style={td} colSpan={2}>Discount {order.couponCode}</td><td style={{ ...td, textAlign: 'right' }}>−{money(order.discount)}</td></tr>}
                  <tr><td style={td} colSpan={2}>Delivery</td><td style={{ ...td, textAlign: 'right' }}>{money(order.deliveryFee)}</td></tr>
                  <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Total</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(order.total)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Internal notes */}
            <div style={{ ...card, marginBottom: '15px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Internal notes <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-tertiary)' }}>(never shown to the customer)</span></h3>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} style={{ ...input, width: '100%', minHeight: '70px' }} />
              <Button style={{ marginTop: '8px' }} disabled={busy || adminNotes === (order.adminNotes || '')}
                onClick={() => run(() => api.put(`/api/admin/orders/${orderId}`, { adminNotes }))}>Save notes</Button>
            </div>

            {/* History */}
            <div style={{ ...card, marginBottom: '15px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>History</h3>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px' }}>
                {order.timeline.map((t, i) => <li key={i} style={{ padding: '4px 0' }}><strong>{t.label}</strong> · {shortDate(t.at)}{t.note ? ` — ${t.note}` : ''}</li>)}
              </ul>
              {order.paymentEvents.length > 0 && (
                <>
                  <h4 style={{ fontSize: '13px', margin: '12px 0 6px' }}>Payment events</h4>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px', color: 'var(--dark-warmth)' }}>
                    {order.paymentEvents.map((e, i) => <li key={i}>{shortDate(e.created_at)} · {e.source} · {e.provider_status} → {e.result}</li>)}
                  </ul>
                </>
              )}
              {order.deliveryAttempts.length > 0 && (
                <>
                  <h4 style={{ fontSize: '13px', margin: '12px 0 6px' }}>Delivery attempts</h4>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px' }}>
                    {order.deliveryAttempts.map((a, i) => (
                      <li key={i}>{shortDate(a.at)} · {a.outcome}{a.reason ? ` (${a.reason})` : ''}{a.recipientName ? ` · received by ${a.recipientName}` : ''}{a.driverName ? ` · ${a.driverName}` : ''}{a.codCollected ? ' · cash collected' : ''}</li>
                    ))}
                  </ul>
                </>
              )}
              {order.refunds.length > 0 && (
                <>
                  <h4 style={{ fontSize: '13px', margin: '12px 0 6px' }}>Refunds</h4>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px' }}>
                    {order.refunds.map((r, i) => <li key={i}>{shortDate(r.created_at)} · {money(r.amount)} · {r.method} · {r.reason}</li>)}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AdminOrders({ initialFilters = {} }) {
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', fulfillment: '', date: '', q: '', needsReview: false, ...initialFilters })
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => { setFilters(f => ({ ...f, ...initialFilters })); setPage(1) }, [JSON.stringify(initialFilters)]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = new URLSearchParams({ page: String(page), limit: '25' })
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)) })

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'orders', params.toString()],
    queryFn: () => api.get(`/api/admin/orders?${params}`),
    keepPreviousData: true,
    refetchInterval: 60000
  })

  const set = (patch) => { setFilters(f => ({ ...f, ...patch })); setPage(1) }

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', alignItems: 'center' }}>
        <input placeholder="Search number, name, phone…" value={filters.q} onChange={e => set({ q: e.target.value })} style={{ ...input, flex: '1 1 200px' }} aria-label="Search orders" />
        <select value={filters.status} onChange={e => set({ status: e.target.value })} style={input} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.paymentStatus} onChange={e => set({ paymentStatus: e.target.value })} style={input} aria-label="Payment status">
          <option value="">All payments</option>
          {['pending', 'pending_delivery', 'paid', 'failed', 'refunded', 'partially_refunded', 'expired', 'cancelled'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.fulfillment} onChange={e => set({ fulfillment: e.target.value })} style={input} aria-label="Fulfillment">
          <option value="">Pickup + delivery</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
        <input type="date" value={filters.date} onChange={e => set({ date: e.target.value })} style={input} aria-label="Fulfillment date" />
        <label style={{ fontSize: '13px', display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input type="checkbox" checked={!!filters.needsReview} onChange={e => set({ needsReview: e.target.checked })} /> Needs review
        </label>
        {isFetching && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Updating…</span>}
      </div>

      <ErrorBox error={error} onRetry={refetch} />
      {isLoading ? <Loading /> : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
            <thead>
              <tr>
                <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>When</th>
                <th style={th}>Status</th><th style={th}>Payment</th><th style={{ ...th, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.orders.map(o => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} style={{ cursor: 'pointer' }} tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setOpenId(o.id)}>
                  <td style={td}><strong>{o.orderNumber}</strong>{o.needsReview && <> <Pill color="#c0392b">review</Pill></>}<br /><span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{shortDate(o.createdAt)}</span></td>
                  <td style={td}>{o.customerName}<br /><span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.customerPhone}</span></td>
                  <td style={td}>
                    <i className={`fas ${o.fulfillmentMethod === 'pickup' ? 'fa-store' : 'fa-truck'}`} style={{ marginRight: '5px', color: 'var(--muted-gold)' }}></i>
                    {dayLabel(o.date)} {o.slot}<br /><span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.zone}{o.driverName ? ` · ${o.driverName}` : ''}</span>
                  </td>
                  <td style={td}><StatusPill status={o.status} label={o.statusLabel} /></td>
                  <td style={td}><StatusPill status={o.paymentStatus} /><br /><span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.paymentMethod.replace('_', ' ')}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.orders.length === 0 && <Empty>No orders match these filters.</Empty>}
        </div>
      )}
      {data?.totalPages > 1 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px', alignItems: 'center' }}>
          <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span style={{ fontSize: '13px' }}>Page {page} of {data.totalPages}</span>
          <Button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
      {openId && (
        <OrderDrawer orderId={openId} onClose={() => setOpenId(null)}
          onChanged={() => { queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }) }} />
      )}
    </div>
  )
}

export { OrderDrawer }
export default AdminOrders
