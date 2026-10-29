import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { card, input, th, td, money, shortDate, Loading, ErrorBox, Empty, Button, Pill } from './ui'

const REASONS = [
  { id: 'restock', label: 'Restock (+)' },
  { id: 'manual_sale', label: 'Sold in store (−)' },
  { id: 'whatsapp_sale', label: 'Sold on WhatsApp (−)' },
  { id: 'return', label: 'Customer return (+)' },
  { id: 'correction', label: 'Count correction (±)' }
]

function AdjustRow({ productId, variant, current, onDone }) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('restock')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    let n = parseInt(delta, 10)
    if (!n) return
    // Sales always subtract, restock/return always add, whatever sign was typed
    if (['manual_sale', 'whatsapp_sale'].includes(reason)) n = -Math.abs(n)
    if (['restock', 'return'].includes(reason)) n = Math.abs(n)
    setBusy(true)
    setError('')
    try {
      await api.post('/api/admin/inventory/adjust', { productId, variantId: variant?.id || null, delta: n, reason })
      setDelta('')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <strong style={{ minWidth: '34px', color: current <= 2 ? '#c0392b' : 'inherit' }}>{current}</strong>
      <input type="number" value={delta} onChange={e => setDelta(e.target.value)} placeholder="qty" style={{ ...input, width: '70px' }}
        aria-label={`Quantity change${variant ? ` for ${[variant.size, variant.color].filter(Boolean).join(' ')}` : ''}`} />
      <select value={reason} onChange={e => setReason(e.target.value)} style={input} aria-label="Reason">
        {REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <Button disabled={busy || !delta} onClick={save}>Save</Button>
      {error && <span role="alert" style={{ color: '#c0392b', fontSize: '12px' }}>{error}</span>}
    </div>
  )
}

function AdminInventory({ initialFilters = {} }) {
  const [q, setQ] = useState('')
  const [lowStock, setLowStock] = useState(!!initialFilters.lowStock)
  const [showMovements, setShowMovements] = useState(false)
  const queryClient = useQueryClient()
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (lowStock) params.set('lowStock', 'true')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'inventory', params.toString()],
    queryFn: () => api.get(`/api/admin/inventory?${params}`)
  })
  const movements = useQuery({
    queryKey: ['admin', 'movements'],
    queryFn: () => api.get('/api/admin/inventory/movements?limit=50'),
    enabled: showMovements
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'movements'] })
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', alignItems: 'center' }}>
        <input placeholder="Search product or reference…" value={q} onChange={e => setQ(e.target.value)} style={{ ...input, flex: '1 1 220px' }} aria-label="Search products" />
        <label style={{ fontSize: '13px', display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} /> Low stock only
        </label>
        <Button onClick={() => setShowMovements(s => !s)}>{showMovements ? 'Hide' : 'Show'} stock history</Button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginBottom: '10px' }}>
        Every change is logged. Register sales made in the shop or on WhatsApp here so the website never sells what you no longer have.
      </p>

      {showMovements && (
        <div style={{ ...card, marginBottom: '15px', maxHeight: '300px', overflowY: 'auto' }}>
          {movements.isLoading ? <Loading /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>When</th><th style={th}>Product</th><th style={th}>Change</th><th style={th}>Reason</th><th style={th}>By / order</th></tr></thead>
              <tbody>
                {(movements.data?.movements || []).map(m => (
                  <tr key={m.id}>
                    <td style={td}>{shortDate(m.at)}</td>
                    <td style={td}>{m.productName} {[m.size, m.color].filter(Boolean).join(' ')}</td>
                    <td style={{ ...td, color: m.delta < 0 ? '#c0392b' : '#27ae60', fontWeight: 600 }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                    <td style={td}>{m.reason.replace(/_/g, ' ')}</td>
                    <td style={td}>{m.orderNumber || m.user || 'system'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ErrorBox error={error} onRetry={refetch} />
      {isLoading ? <Loading /> : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead><tr><th style={th}>Product</th><th style={th}>Price</th><th style={th}>Stock & adjust</th></tr></thead>
            <tbody>
              {data?.items.map(p => (
                <tr key={p.id}>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {p.image && <img src={p.image} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />}
                      <div><strong>{p.name}</strong><br /><span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.ref} · #{p.id}</span></div>
                    </div>
                  </td>
                  <td style={td}>{money(p.price)}</td>
                  <td style={td}>
                    {p.hasVariants ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {p.variants.map(v => (
                          <div key={v.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Pill color={v.isActive ? '#2980b9' : '#7f8c8d'}>{[v.size, v.color].filter(Boolean).join(' / ') || v.sku}</Pill>
                            <AdjustRow productId={p.id} variant={v} current={v.stock} onDone={refresh} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <AdjustRow productId={p.id} current={p.stock} onDone={refresh} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.items.length === 0 && <Empty>No products found.</Empty>}
        </div>
      )}
    </div>
  )
}

export default AdminInventory
