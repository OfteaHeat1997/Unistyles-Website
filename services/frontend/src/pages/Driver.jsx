import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

// Delivery person's phone screen: today's stops, call/WhatsApp/maps,
// start route, confirm delivery (with cash collected), or report a failure.

const FAIL_REASONS = [
  { id: 'not_home', label: 'Nobody home' },
  { id: 'wrong_address', label: 'Wrong / unclear address' },
  { id: 'refused', label: 'Customer refused' },
  { id: 'no_payment', label: 'Could not pay' },
  { id: 'other', label: 'Other' }
]

const today = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10)
const money = (n) => `XCG ${Number(n || 0).toFixed(2)}`
const btn = { padding: '12px 14px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', minHeight: '44px', border: '1px solid var(--border)', background: 'white' }

function Stop({ stop, onChanged }) {
  const [mode, setMode] = useState(null) // null | deliver | fail
  const [recipient, setRecipient] = useState(stop.customerName || '')
  const [cash, setCash] = useState(false)
  const [reason, setReason] = useState('not_home')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const call = async (path, body) => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/driver/orders/${stop.id}/${path}`, body)
      setMode(null)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const done = stop.status === 'delivered'
  const phoneDigits = String(stop.phone || '').replace(/\D/g, '')

  return (
    <article style={{ background: 'var(--white)', borderRadius: '12px', padding: '16px', marginBottom: '12px', opacity: done ? 0.6 : 1, borderLeft: `5px solid ${done ? '#27ae60' : stop.status === 'delivery_failed' ? '#c0392b' : stop.status === 'out_for_delivery' ? '#16a085' : 'var(--muted-gold)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>{stop.slot} · {stop.zone}</p>
          <h2 style={{ fontSize: '17px' }}>{stop.customerName}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{stop.orderNumber} · {stop.itemCount} item(s)</p>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{stop.statusLabel}</span>
      </div>
      <p style={{ fontSize: '14px', margin: '10px 0 4px' }}>{stop.street}{stop.area ? `, ${stop.area}` : ''}</p>
      {stop.landmark && <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>{stop.landmark}</p>}
      {stop.notes && <p style={{ fontSize: '13px', fontStyle: 'italic' }}>“{stop.notes}”</p>}
      {stop.collectCash > 0 && (
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#a04000', marginTop: '8px' }}>
          <i className="fas fa-money-bill-wave" style={{ marginRight: '6px' }}></i>Collect {money(stop.collectCash)}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        {stop.phone && <a href={`tel:${stop.phone}`} style={{ ...btn, textDecoration: 'none', color: 'var(--dark)' }}><i className="fas fa-phone"></i> Call</a>}
        {phoneDigits && <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none', color: '#1B4D4F' }}><i className="fab fa-whatsapp"></i> WhatsApp</a>}
        {stop.lat && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none', color: 'var(--dark)' }}>
            <i className="fas fa-directions"></i> Navigate
          </a>
        )}
      </div>

      {error && <p role="alert" style={{ color: '#c0392b', fontSize: '13px', marginTop: '10px' }}>{error}</p>}

      {!done && mode === null && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {['processing', 'delivery_failed'].includes(stop.status) && (
            <button style={{ ...btn, background: 'var(--dark)', color: 'white', border: 'none' }} disabled={busy} onClick={() => call('start')}>
              {stop.status === 'delivery_failed' ? 'Retry delivery' : 'Start — on my way'}
            </button>
          )}
          {stop.status === 'out_for_delivery' && (
            <>
              <button style={{ ...btn, background: '#27ae60', color: 'white', border: 'none', flex: 1 }} onClick={() => setMode('deliver')}>Delivered</button>
              <button style={{ ...btn, color: '#c0392b', borderColor: '#c0392b' }} onClick={() => setMode('fail')}>Could not deliver</button>
            </>
          )}
        </div>
      )}

      {mode === 'deliver' && (
        <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
          <label style={{ fontSize: '13px' }}>Received by
            <input value={recipient} onChange={e => setRecipient(e.target.value)} style={{ ...btn, width: '100%', marginTop: '4px', cursor: 'text' }} />
          </label>
          {stop.collectCash > 0 && (
            <label style={{ fontSize: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} style={{ width: '22px', height: '22px' }} />
              I collected {money(stop.collectCash)} in cash
            </label>
          )}
          <input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ ...btn, cursor: 'text' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btn} onClick={() => setMode(null)} disabled={busy}>Back</button>
            <button style={{ ...btn, background: '#27ae60', color: 'white', border: 'none', flex: 1 }}
              disabled={busy || !recipient.trim() || (stop.collectCash > 0 && !cash)}
              onClick={() => call('delivered', { recipientName: recipient.trim(), codCollected: cash, note: note || undefined })}>
              {busy ? 'Saving…' : 'Confirm delivery'}
            </button>
          </div>
        </div>
      )}

      {mode === 'fail' && (
        <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
          <select value={reason} onChange={e => setReason(e.target.value)} style={btn} aria-label="Reason">
            {FAIL_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input placeholder="What happened? (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ ...btn, cursor: 'text' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btn} onClick={() => setMode(null)} disabled={busy}>Back</button>
            <button style={{ ...btn, background: '#c0392b', color: 'white', border: 'none', flex: 1 }} disabled={busy}
              onClick={() => call('failed', { reason, note: note || undefined })}>
              {busy ? 'Saving…' : 'Report failed attempt'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function Driver() {
  const { user } = useAuth()
  const [date, setDate] = useState(today())
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'stops', date],
    queryFn: () => api.get(`/api/driver/stops?date=${date}`),
    refetchInterval: 60000
  })
  const stops = data?.stops || []
  const remaining = stops.filter(s => s.status !== 'delivered').length
  const cash = stops.filter(s => s.status !== 'delivered').reduce((sum, s) => sum + s.collectCash, 0)

  return (
    <section style={{ background: 'var(--cream-bg)', minHeight: '80vh', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px' }}>Deliveries</h1>
        <p style={{ fontSize: '13px', color: 'var(--dark-warmth)', marginBottom: '12px' }}>
          {user?.firstName} · {remaining} stop(s) left{cash > 0 ? ` · ${money(cash)} to collect` : ''}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...btn, flex: 1 }} aria-label="Date" />
          <button style={btn} onClick={() => refetch()} aria-label="Refresh"><i className="fas fa-sync"></i></button>
        </div>
        {isLoading && <p>Loading…</p>}
        {error && <p role="alert" style={{ color: '#c0392b' }}>{error.message}</p>}
        {!isLoading && !error && stops.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>No deliveries assigned for this day.</p>
        )}
        {stops.map(s => <Stop key={s.id} stop={s} onChanged={() => queryClient.invalidateQueries({ queryKey: ['driver', 'stops'] })} />)}
      </div>
    </section>
  )
}

export default Driver
