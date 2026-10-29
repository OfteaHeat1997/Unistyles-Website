import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { card, input, th, td, Loading, ErrorBox, Button, PendingBadge, Pill } from './ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const METHODS = [
  { id: 'cod', label: 'Cash on delivery / at pickup' },
  { id: 'sentoo', label: 'Sentoo (online)' },
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'whatsapp', label: 'Confirm via WhatsApp' }
]

function Section({ title, pending, children }) {
  return (
    <div style={{ ...card, marginBottom: '15px' }}>
      <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {title} {pending && <PendingBadge />}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 260px) 1fr', gap: '10px', alignItems: 'center', fontSize: '13px', marginBottom: '10px' }}>
      <span>{label}</span>
      <span>{children}</span>
    </label>
  )
}

function AdminSettings() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get('/api/admin/settings') })
  const [s, setS] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [newSlot, setNewSlot] = useState({ method: 'delivery', weekday: 1, start_time: '10:00', end_time: '13:00', capacity: 8 })
  const [newBlocked, setNewBlocked] = useState({ date: '', method: '', reason: '' })

  useEffect(() => { if (data) setS(data.settings) }, [data])

  const pending = new Set(data?.settings?.pending_approval || [])
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    queryClient.invalidateQueries({ queryKey: ['checkout', 'options'] })
  }

  const act = async (fn, okText = 'Saved') => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ ok: true, text: okText })
      refresh()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !s) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={refetch} />

  const set = (patch) => setS(prev => ({ ...prev, ...patch }))
  const saveGeneral = () => act(() => api.put('/api/admin/settings', {
    settings: {
      free_delivery_threshold: Number(s.free_delivery_threshold),
      free_delivery_rule: s.free_delivery_rule,
      pickup_enabled: !!s.pickup_enabled,
      delivery_enabled: !!s.delivery_enabled,
      delivery_cutoff_hour: Number(s.delivery_cutoff_hour),
      booking_days_ahead: Number(s.booking_days_ahead),
      payment_expiry_minutes: Number(s.payment_expiry_minutes),
      bank_transfer_expiry_hours: Number(s.bank_transfer_expiry_hours),
      payment_methods: s.payment_methods,
      support_whatsapp: String(s.support_whatsapp || '').replace(/\D/g, ''),
      bank_details: s.bank_details,
      return_policy: s.return_policy
    }
  }))

  const approveAll = () => act(() => api.put('/api/admin/settings', { settings: { pending_approval: [] } }), 'Marked as approved')

  return (
    <div>
      {msg && <p role="status" style={{ padding: '10px 15px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', background: msg.ok ? '#E8F5E9' : '#fdecea', color: msg.ok ? '#2e7d32' : '#c0392b' }}>{msg.text}</p>}
      {pending.size > 0 && (
        <div style={{ ...card, marginBottom: '15px', borderLeft: '4px solid #e67e22' }}>
          <p style={{ fontSize: '13px', marginBottom: '10px' }}>
            Some business rules are still <strong>defaults waiting for the owner's approval</strong> (delivery threshold, cut-off, payment window, contact, policies…).
            Review them below, then confirm.
          </p>
          <Button variant="gold" disabled={busy} onClick={approveAll}>I reviewed these rules — mark approved</Button>
        </div>
      )}

      <Section title="Delivery & pickup rules" pending={pending.has('free_delivery_threshold') || pending.has('delivery_cutoff_hour')}>
        <Row label="Free delivery from (XCG)"><input type="number" min="0" step="0.01" value={s.free_delivery_threshold} onChange={e => set({ free_delivery_threshold: e.target.value })} style={{ ...input, width: '120px' }} /></Row>
        <Row label="Rule">
          <select value={s.free_delivery_rule} onChange={e => set({ free_delivery_rule: e.target.value })} style={input}>
            <option value="gte">Subtotal ≥ threshold (exactly the threshold is free)</option>
            <option value="gt">Subtotal &gt; threshold (80.00 pays)</option>
          </select>
        </Row>
        <Row label="Offer home delivery"><input type="checkbox" checked={!!s.delivery_enabled} onChange={e => set({ delivery_enabled: e.target.checked })} /></Row>
        <Row label="Offer pickup"><input type="checkbox" checked={!!s.pickup_enabled} onChange={e => set({ pickup_enabled: e.target.checked })} /></Row>
        <Row label="Next-day delivery cut-off (hour, 0–23)"><input type="number" min="0" max="23" value={s.delivery_cutoff_hour} onChange={e => set({ delivery_cutoff_hour: e.target.value })} style={{ ...input, width: '80px' }} /></Row>
        <Row label="Days customers can book ahead"><input type="number" min="1" max="30" value={s.booking_days_ahead} onChange={e => set({ booking_days_ahead: e.target.value })} style={{ ...input, width: '80px' }} /></Row>
      </Section>

      <Section title="Payments" pending={pending.has('payment_expiry_minutes') || pending.has('bank_details')}>
        <Row label="Payment methods offered">
          <span style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {METHODS.map(m => (
              <label key={m.id} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <input type="checkbox" checked={(s.payment_methods || []).includes(m.id)}
                  onChange={e => set({ payment_methods: e.target.checked ? [...(s.payment_methods || []), m.id] : s.payment_methods.filter(x => x !== m.id) })} />
                {m.label}
              </label>
            ))}
          </span>
        </Row>
        <Row label="Online payment window (minutes)"><input type="number" min="5" max="1440" value={s.payment_expiry_minutes} onChange={e => set({ payment_expiry_minutes: e.target.value })} style={{ ...input, width: '90px' }} /></Row>
        <Row label="Bank transfer window (hours)"><input type="number" min="1" max="240" value={s.bank_transfer_expiry_hours} onChange={e => set({ bank_transfer_expiry_hours: e.target.value })} style={{ ...input, width: '90px' }} /></Row>
        {['bankName', 'accountName', 'accountNumber', 'swift'].map(k => (
          <Row key={k} label={`Bank: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`}>
            <input value={s.bank_details?.[k] || ''} onChange={e => set({ bank_details: { ...s.bank_details, [k]: e.target.value } })} style={{ ...input, width: '100%', maxWidth: '320px' }} />
          </Row>
        ))}
      </Section>

      <Section title="Customer contact & policies" pending={pending.has('support_whatsapp') || pending.has('return_policy')}>
        <Row label="Support WhatsApp (digits, with 599)"><input value={s.support_whatsapp || ''} onChange={e => set({ support_whatsapp: e.target.value })} style={{ ...input, width: '200px' }} /></Row>
        <Row label="Return policy (general)">
          <textarea value={s.return_policy?.default || ''} onChange={e => set({ return_policy: { ...s.return_policy, default: e.target.value } })} style={{ ...input, width: '100%', minHeight: '60px' }} />
        </Row>
        <Row label="Return policy (panties)">
          <textarea value={s.return_policy?.panties || ''} onChange={e => set({ return_policy: { ...s.return_policy, panties: e.target.value } })} style={{ ...input, width: '100%', minHeight: '60px' }} />
        </Row>
      </Section>

      <div style={{ marginBottom: '25px' }}>
        <Button variant="primary" disabled={busy} onClick={saveGeneral}>Save rules</Button>
      </div>

      <Section title="Delivery zones" pending={pending.has('zones')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
            <thead><tr><th style={th}>Zone</th><th style={th}>Fee</th><th style={th}>Free from</th><th style={th}>ETA</th><th style={th}>Active</th><th style={th}></th></tr></thead>
            <tbody>
              {data.zones.map(z => <ZoneRow key={z.id} zone={z} onSave={(patch) => act(() => api.put(`/api/admin/zones/${z.id}`, patch))} busy={busy} />)}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginTop: '8px' }}>"Free from" empty = use the global threshold. Zone shapes are drawn on the map in checkout; points outside every zone are refused.</p>
      </Section>

      <Section title="Time windows" pending={pending.has('slots')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
            <thead><tr><th style={th}>Type</th><th style={th}>Day</th><th style={th}>Window</th><th style={th}>Capacity</th><th style={th}>Active</th></tr></thead>
            <tbody>
              {data.slots.map(sl => (
                <tr key={sl.id}>
                  <td style={td}><Pill>{sl.method}</Pill></td>
                  <td style={td}>{WEEKDAYS[sl.weekday]}</td>
                  <td style={td}>{String(sl.start_time).slice(0, 5)}–{String(sl.end_time).slice(0, 5)}</td>
                  <td style={td}>
                    <input type="number" min="0" defaultValue={sl.capacity} style={{ ...input, width: '70px' }} aria-label="Capacity"
                      onBlur={e => Number(e.target.value) !== sl.capacity && act(() => api.put(`/api/admin/slots/${sl.id}`, { capacity: Number(e.target.value) }))} />
                  </td>
                  <td style={td}>
                    <input type="checkbox" checked={sl.is_active} aria-label="Active" onChange={e => act(() => api.put(`/api/admin/slots/${sl.id}`, { is_active: e.target.checked }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'center' }}>
          <select value={newSlot.method} onChange={e => setNewSlot({ ...newSlot, method: e.target.value })} style={input} aria-label="Type">
            <option value="delivery">delivery</option><option value="pickup">pickup</option>
          </select>
          <select value={newSlot.weekday} onChange={e => setNewSlot({ ...newSlot, weekday: Number(e.target.value) })} style={input} aria-label="Day">
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input type="time" value={newSlot.start_time} onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })} style={input} aria-label="Start" />
          <input type="time" value={newSlot.end_time} onChange={e => setNewSlot({ ...newSlot, end_time: e.target.value })} style={input} aria-label="End" />
          <input type="number" min="0" value={newSlot.capacity} onChange={e => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })} style={{ ...input, width: '70px' }} aria-label="Capacity" />
          <Button disabled={busy} onClick={() => act(() => api.post('/api/admin/slots', newSlot), 'Time window added')}>Add window</Button>
        </div>
      </Section>

      <Section title="Closed days">
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '10px' }}>
          {data.blockedDates.map(b => (
            <li key={b.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', padding: '4px 0' }}>
              <strong>{b.date}</strong> {b.method ? <Pill>{b.method} only</Pill> : <Pill>all</Pill>} {b.reason}
              <Button variant="danger" style={{ padding: '4px 10px', minHeight: 0 }} disabled={busy} onClick={() => act(() => api.del(`/api/admin/blocked-dates/${b.id}`), 'Removed')}>Remove</Button>
            </li>
          ))}
          {data.blockedDates.length === 0 && <li style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No closed days planned.</li>}
        </ul>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input type="date" value={newBlocked.date} onChange={e => setNewBlocked({ ...newBlocked, date: e.target.value })} style={input} aria-label="Date" />
          <select value={newBlocked.method} onChange={e => setNewBlocked({ ...newBlocked, method: e.target.value })} style={input} aria-label="Applies to">
            <option value="">Pickup + delivery</option><option value="delivery">Delivery only</option><option value="pickup">Pickup only</option>
          </select>
          <input placeholder="Reason (e.g. Carnival)" value={newBlocked.reason} onChange={e => setNewBlocked({ ...newBlocked, reason: e.target.value })} style={input} aria-label="Reason" />
          <Button disabled={busy || !newBlocked.date} onClick={() => act(() => api.post('/api/admin/blocked-dates', { ...newBlocked, method: newBlocked.method || null }), 'Closed day added')}>Add</Button>
        </div>
      </Section>

      <Section title="Pickup location">
        {data.pickupLocations.map(l => <PickupRow key={l.id} loc={l} busy={busy} onSave={(patch) => act(() => api.put(`/api/admin/pickup-locations/${l.id}`, patch))} />)}
      </Section>
    </div>
  )
}

function ZoneRow({ zone, onSave, busy }) {
  const [z, setZ] = useState({ fee: zone.fee, free_threshold: zone.free_threshold ?? '', estimated_days: zone.estimated_days, is_active: zone.is_active })
  return (
    <tr>
      <td style={td}><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: zone.color, marginRight: '6px' }}></span>{zone.name}</td>
      <td style={td}><input type="number" min="0" step="0.01" value={z.fee} onChange={e => setZ({ ...z, fee: e.target.value })} style={{ ...input, width: '80px' }} aria-label="Fee" /></td>
      <td style={td}><input type="number" min="0" step="0.01" value={z.free_threshold} onChange={e => setZ({ ...z, free_threshold: e.target.value })} style={{ ...input, width: '90px' }} aria-label="Free from" placeholder="global" /></td>
      <td style={td}><input value={z.estimated_days} onChange={e => setZ({ ...z, estimated_days: e.target.value })} style={{ ...input, width: '140px' }} aria-label="ETA" /></td>
      <td style={td}><input type="checkbox" checked={z.is_active} onChange={e => setZ({ ...z, is_active: e.target.checked })} aria-label="Active" /></td>
      <td style={td}>
        <Button disabled={busy} onClick={() => onSave({ fee: Number(z.fee), free_threshold: z.free_threshold === '' ? null : Number(z.free_threshold), estimated_days: z.estimated_days, is_active: z.is_active })}>Save</Button>
      </td>
    </tr>
  )
}

function PickupRow({ loc, onSave, busy }) {
  const [l, setL] = useState({ name: loc.name, address: loc.address, hours: loc.hours || '', instructions: loc.instructions || '', latitude: loc.latitude ?? '', longitude: loc.longitude ?? '', is_active: loc.is_active })
  return (
    <div>
      {['name', 'address', 'hours', 'instructions'].map(k => (
        <Row key={k} label={k[0].toUpperCase() + k.slice(1)}>
          <input value={l[k]} onChange={e => setL({ ...l, [k]: e.target.value })} style={{ ...input, width: '100%' }} />
        </Row>
      ))}
      <Row label="Map pin (lat, lng)">
        <span style={{ display: 'flex', gap: '6px' }}>
          <input type="number" step="0.000001" value={l.latitude} onChange={e => setL({ ...l, latitude: e.target.value })} style={{ ...input, width: '130px' }} aria-label="Latitude" />
          <input type="number" step="0.000001" value={l.longitude} onChange={e => setL({ ...l, longitude: e.target.value })} style={{ ...input, width: '130px' }} aria-label="Longitude" />
        </span>
      </Row>
      <Row label="Active"><input type="checkbox" checked={l.is_active} onChange={e => setL({ ...l, is_active: e.target.checked })} /></Row>
      <Button disabled={busy} onClick={() => onSave({ ...l, latitude: l.latitude === '' ? null : Number(l.latitude), longitude: l.longitude === '' ? null : Number(l.longitude) })}>Save location</Button>
    </div>
  )
}

export default AdminSettings
