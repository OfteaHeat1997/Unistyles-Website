import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cartStore, lineKey } from '../stores/cartStore'
import { useAuth } from '../contexts/AuthContext'
import { api, ApiError } from '../utils/api'
import { useCheckoutOptions, formatXCG } from '../hooks/useCheckoutOptions'
import AddressAutocomplete from '../components/AddressAutocomplete'
import LocationPicker from '../components/LocationPicker'
import { track } from '../utils/analytics'

// Checkout: 1 Contact → 2 Pickup or delivery → 3 Payment → 4 Review.
// Every amount shown comes from POST /api/checkout/quote; POST /api/orders
// recomputes the same quote on the server before charging.

const STEPS = ['Contact', 'Delivery', 'Payment', 'Review']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const inputStyle = { width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }
const cardStyle = { background: 'var(--white)', padding: '30px', borderRadius: '10px' }
const h2Style = { fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }

function getIdempotencyKey() {
  try {
    let key = sessionStorage.getItem('checkout_idempotency_key')
    if (!key) {
      key = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem('checkout_idempotency_key', key)
    }
    return key
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function resetIdempotencyKey() {
  try { sessionStorage.removeItem('checkout_idempotency_key') } catch { /* ignore */ }
}

function formatDay(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

function Field({ label, children, error, htmlFor }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
      {children}
      {error && <p role="alert" style={{ fontSize: '12px', color: '#c0392b', marginTop: '5px' }}>{error}</p>}
    </div>
  )
}

function Checkout() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { data: options, isLoading: optionsLoading, error: optionsError } = useCheckoutOptions()

  const [cart, setCart] = useState(cartStore.getCart())
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [fulfillment, setFulfillment] = useState({
    method: 'delivery', street: '', landmark: '', area: '', lat: null, lng: null,
    pickupLocationId: null, date: '', slotId: null
  })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState('')
  const quoteSeq = useRef(0)

  useEffect(() => cartStore.subscribe(setCart), [])

  useEffect(() => {
    if (user) {
      setContact(c => ({
        firstName: c.firstName || user.firstName || '',
        lastName: c.lastName || user.lastName || '',
        email: c.email || user.email || '',
        phone: c.phone || user.phone || ''
      }))
    }
  }, [user])

  useEffect(() => {
    if (cart.length) track('begin_checkout', { items: cart.length })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Default method / pickup location once options load
  useEffect(() => {
    if (!options) return
    setFulfillment(f => {
      let method = f.method
      if (method === 'delivery' && !options.deliveryEnabled && options.pickupEnabled) method = 'pickup'
      if (method === 'pickup' && !options.pickupEnabled) method = 'delivery'
      return {
        ...f,
        method,
        pickupLocationId: f.pickupLocationId || options.pickupLocations?.[0]?.id || null
      }
    })
    if (!paymentMethod && options.paymentMethods?.length) setPaymentMethod(options.paymentMethods[0].id)
  }, [options]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slot calendar for the chosen method
  const { data: slotData, isLoading: slotsLoading, error: slotsError, refetch: refetchSlots } = useQuery({
    queryKey: ['slots', fulfillment.method],
    queryFn: () => api.get(`/api/delivery/slots?method=${fulfillment.method}`, { auth: false }),
    staleTime: 60 * 1000
  })

  // ---- Server quote (debounced) -------------------------------------------
  const quoteBody = useMemo(() => ({
    items: cart.map(i => ({ productId: Number(i.id), variantId: i.variantId || null, quantity: i.quantity, price: i.price })),
    fulfillment: {
      method: fulfillment.method,
      lat: fulfillment.method === 'delivery' ? fulfillment.lat : null,
      lng: fulfillment.method === 'delivery' ? fulfillment.lng : null,
      area: fulfillment.method === 'delivery' ? (fulfillment.area || null) : null,
      pickupLocationId: fulfillment.method === 'pickup' ? fulfillment.pickupLocationId : null,
      date: fulfillment.date || null,
      slotId: fulfillment.slotId || null
    },
    couponCode: couponCode || null,
    email: contact.email || undefined
  }), [cart, fulfillment, couponCode, contact.email])

  useEffect(() => {
    if (!cart.length) return
    const seq = ++quoteSeq.current
    setQuoteLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.post('/api/checkout/quote', quoteBody)
        if (seq !== quoteSeq.current) return
        setQuote(data)
        setQuoteError('')
      } catch (err) {
        if (seq !== quoteSeq.current) return
        setQuoteError(err.message || 'Could not calculate your total')
      } finally {
        if (seq === quoteSeq.current) setQuoteLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [quoteBody, cart.length])

  const issues = quote?.issues || []
  const issueOf = (...types) => issues.find(i => types.includes(i.type))
  const lineIssues = issues.filter(i => i.productId)
  const zoneToConfirm = issueOf('zone_to_confirm', 'out_of_coverage')
  const slotIssue = issueOf('slot_unavailable')
  const selectedPayment = options?.paymentMethods?.find(m => m.id === paymentMethod)
  const paymentLabel = (m) => (m.id === 'cod' && fulfillment.method === 'pickup' ? m.pickupName || m.name : m.name)

  // ---- Step validation ----------------------------------------------------
  const validateStep = (n) => {
    const e = {}
    if (n === 1) {
      if (!contact.firstName.trim()) e.firstName = 'First name is required'
      if (!contact.lastName.trim()) e.lastName = 'Last name is required'
      if (!/^\+?[0-9 ()-]{7,20}$/.test(contact.phone.trim())) e.phone = 'Enter a valid WhatsApp number, e.g. +599 9 123 4567'
      if (!isAuthenticated && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim())) e.email = 'A valid email is required for your confirmation'
    }
    if (n === 2) {
      if (fulfillment.method === 'delivery') {
        if (!fulfillment.street.trim()) e.street = 'Street address is required'
        // An unlisted address is allowed: the fee is confirmed on WhatsApp (DEC-001)
        if (fulfillment.lat === null && !fulfillment.area) e.location = 'Choose your neighbourhood or set your location on the map'
      } else if (!fulfillment.pickupLocationId) {
        e.pickup = 'Choose a pickup location'
      }
      if (!fulfillment.date || !fulfillment.slotId) e.slot = `Choose a ${fulfillment.method} day and time`
      if (slotIssue) e.slot = slotIssue.message
    }
    if (n === 3 && !paymentMethod) e.payment = 'Choose a payment method'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = (e) => {
    e?.preventDefault()
    if (!validateStep(step)) return
    if (step === 2) track('select_fulfillment', { method: fulfillment.method, zone: quote?.zone?.slug })
    if (step === 3) track('add_payment_info', { method: paymentMethod })
    setStep(s => Math.min(4, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setF = (patch) => setFulfillment(f => ({ ...f, ...patch }))
  const changeMethod = (method) => setF({ method, date: '', slotId: null })

  const applyCoupon = () => {
    const code = couponInput.trim()
    if (!code) return
    setCouponCode(code)
  }

  // ---- Place order --------------------------------------------------------
  const placeOrder = async () => {
    if (placing) return
    for (const n of [1, 2, 3]) {
      if (!validateStep(n)) { setStep(n); return }
    }
    if (!quote?.canPlaceOrder) {
      setOrderError(issues.find(i => i.blocking !== false)?.message || 'Please review your order')
      return
    }
    setPlacing(true)
    setOrderError('')

    try {
      const data = await api.post('/api/orders', {
        items: quoteBody.items.map(({ price, ...rest }) => rest),
        paymentMethod,
        customer: {
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          email: contact.email.trim() || undefined,
          phone: contact.phone.trim()
        },
        fulfillment: {
          method: fulfillment.method,
          street: fulfillment.method === 'delivery' ? fulfillment.street.trim() : undefined,
          landmark: fulfillment.landmark || null,
          area: fulfillment.area || null,
          lat: fulfillment.method === 'delivery' ? fulfillment.lat : null,
          lng: fulfillment.method === 'delivery' ? fulfillment.lng : null,
          pickupLocationId: fulfillment.method === 'pickup' ? fulfillment.pickupLocationId : null,
          date: fulfillment.date,
          slotId: fulfillment.slotId
        },
        notes: notes || null,
        couponCode: couponCode || null
      }, { headers: { 'Idempotency-Key': getIdempotencyKey() } })

      const order = data.order
      track('purchase', { orderNumber: order.orderNumber, total: order.total, method: order.paymentMethod })
      cartStore.clearCart()
      resetIdempotencyKey()

      const orderUrl = `/order/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`
      if (data.next?.type === 'pay_online') {
        navigate(`/payment/callback?orderId=${order.id}&t=${encodeURIComponent(order.trackingToken)}&start=1`)
      } else {
        navigate(orderUrl, { state: { justPlaced: true } })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.issues) {
        setQuote(q => (q ? { ...q, issues: err.data.issues, canPlaceOrder: false } : q))
      }
      setOrderError(err.message || 'Failed to place order. Please try again.')
      setPlacing(false)
    }
  }

  // ---- Render -------------------------------------------------------------
  if (cart.length === 0) {
    return (
      <section style={{ padding: '100px 20px', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh' }}>
        <i className="fas fa-shopping-bag" style={{ fontSize: '64px', color: 'var(--border)', marginBottom: '20px' }}></i>
        <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>Your cart is empty</h2>
        <p style={{ marginBottom: '30px' }}>Add some products to continue checkout.</p>
        <Link to="/" className="btn-shop">Continue Shopping</Link>
      </section>
    )
  }

  if (optionsError) {
    return (
      <section style={{ padding: '100px 20px', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh' }}>
        <i className="fas fa-plug" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '20px' }}></i>
        <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '15px' }}>Checkout is temporarily unavailable</h2>
        <p style={{ marginBottom: '30px' }}>We could not reach our server. Your cart is saved — try again in a moment or order on WhatsApp.</p>
        <button className="btn-shop" onClick={() => window.location.reload()}>Try again</button>
      </section>
    )
  }

  const days = slotData?.days || []
  const selectedDay = days.find(d => d.date === fulfillment.date)

  return (
    <>
      <style>{`
        .checkout-grid { display: grid; grid-template-columns: 1fr 380px; gap: 40px; }
        .checkout-two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) {
          .checkout-grid { grid-template-columns: 1fr; gap: 24px; }
          .checkout-summary { position: static !important; }
        }
        @media (max-width: 520px) { .checkout-two { grid-template-columns: 1fr; } }
        .choice { display: flex; align-items: center; gap: 15px; padding: 18px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; background: white; }
        .choice.active { border: 2px solid var(--muted-gold); background: var(--cream-bg); }
        .slot-btn { padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; background: white; cursor: pointer; font-size: 13px; min-height: 44px; }
        .slot-btn.active { background: var(--dark); color: white; border-color: var(--dark); }
        .slot-btn:disabled { opacity: .4; cursor: not-allowed; text-decoration: line-through; }
      `}</style>

      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Checkout</span>
        </div>
      </div>

      {/* Progress */}
      <nav aria-label="Checkout steps" style={{ background: 'var(--white)', padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
        <ol style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', listStyle: 'none', padding: 0, gap: '8px' }}>
          {STEPS.map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? 'step' : undefined}>
              <button type="button" onClick={() => i + 1 < step && setStep(i + 1)} disabled={i + 1 >= step}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: i + 1 < step ? 'pointer' : 'default', padding: 0 }}>
                <span style={{
                  width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step > i + 1 ? 'var(--muted-gold)' : step === i + 1 ? 'var(--dark)' : 'var(--border)',
                  color: 'white', fontSize: '14px', fontWeight: '600'
                }}>
                  {step > i + 1 ? <i className="fas fa-check"></i> : i + 1}
                </span>
                <span style={{ fontSize: '14px', color: step >= i + 1 ? 'var(--dark)' : 'var(--text-tertiary)' }}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section style={{ padding: '40px 0', background: 'var(--cream-bg)' }}>
        <div className="checkout-grid" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
          <form onSubmit={next} noValidate>
            {/* STEP 1 — CONTACT */}
            {step === 1 && (
              <div style={cardStyle}>
                <h2 style={h2Style}>Contact information</h2>
                {!isAuthenticated && (
                  <p style={{ fontSize: '13px', color: 'var(--dark-warmth)', marginTop: '-15px', marginBottom: '10px' }}>
                    Checking out as a guest. <Link to="/login" state={{ from: { pathname: '/checkout' } }} style={{ color: 'var(--muted-gold)' }}>Log in</Link> to use your saved details.
                  </p>
                )}
                <div className="checkout-two">
                  <Field label="First name *" htmlFor="firstName" error={errors.firstName}>
                    <input id="firstName" autoComplete="given-name" value={contact.firstName}
                      onChange={e => setContact({ ...contact, firstName: e.target.value })} style={inputStyle} />
                  </Field>
                  <Field label="Last name *" htmlFor="lastName" error={errors.lastName}>
                    <input id="lastName" autoComplete="family-name" value={contact.lastName}
                      onChange={e => setContact({ ...contact, lastName: e.target.value })} style={inputStyle} />
                  </Field>
                </div>
                <Field label={`Email ${isAuthenticated ? '' : '*'}`} htmlFor="email" error={errors.email}>
                  <input id="email" type="email" autoComplete="email" value={contact.email}
                    onChange={e => setContact({ ...contact, email: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Phone (WhatsApp) *" htmlFor="phone" error={errors.phone}>
                  <input id="phone" type="tel" autoComplete="tel" value={contact.phone} placeholder="+599 9 123 4567"
                    onChange={e => setContact({ ...contact, phone: e.target.value })} style={inputStyle} />
                </Field>
                <button type="submit" className="btn-shop" style={{ width: '100%', marginTop: '30px', padding: '15px' }}>
                  Continue
                </button>
              </div>
            )}

            {/* STEP 2 — FULFILLMENT */}
            {step === 2 && (
              <div style={cardStyle}>
                <h2 style={h2Style}>How do you want to receive it?</h2>
                <div style={{ display: 'grid', gap: '12px' }} role="radiogroup" aria-label="Fulfillment method">
                  {options?.deliveryEnabled !== false && (
                    <label className={`choice ${fulfillment.method === 'delivery' ? 'active' : ''}`}>
                      <input type="radio" name="method" checked={fulfillment.method === 'delivery'} onChange={() => changeMethod('delivery')} />
                      <i className="fas fa-truck" style={{ fontSize: '22px', color: 'var(--muted-gold)', width: '28px' }}></i>
                      <div>
                        <p style={{ fontWeight: 600 }}>Home delivery</p>
                        <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>
                          Free from {formatXCG(options?.freeDeliveryThreshold)} · otherwise by zone{(options?.deliveryZones || []).map(z => ` · ${z.name} ${formatXCG(z.fee)}`).join('')} · usually next day
                        </p>
                      </div>
                    </label>
                  )}
                  {options?.pickupEnabled && (
                    <label className={`choice ${fulfillment.method === 'pickup' ? 'active' : ''}`}>
                      <input type="radio" name="method" checked={fulfillment.method === 'pickup'} onChange={() => changeMethod('pickup')} />
                      <i className="fas fa-store" style={{ fontSize: '22px', color: 'var(--muted-gold)', width: '28px' }}></i>
                      <div>
                        <p style={{ fontWeight: 600 }}>Pick up — free</p>
                        <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>Collect at our location at a time that suits you</p>
                      </div>
                    </label>
                  )}
                </div>

                {fulfillment.method === 'delivery' && (
                  <>
                    <Field label="Street address *" error={errors.street}>
                      <AddressAutocomplete
                        value={fulfillment.street}
                        onChange={(v) => setF({ street: v })}
                        onPick={(picked) => setF({ street: picked.street, lat: picked.lat, lng: picked.lng, area: picked.area || fulfillment.area })}
                        placeholder="e.g. Caracasbaaiweg 12, Saliña"
                      />
                    </Field>
                    <Field label="Delivery location *" error={errors.location}>
                      <LocationPicker lat={fulfillment.lat} lng={fulfillment.lng} onChange={({ lat, lng }) => setF({ lat, lng })} />
                    </Field>
                    {(options?.deliveryZones || []).some(z => z.neighborhoods.length > 0) && (
                      <Field label="Neighbourhood" htmlFor="area">
                        <select id="area" value={fulfillment.area} onChange={e => setF({ area: e.target.value })} style={inputStyle}>
                          <option value="">Choose your neighbourhood…</option>
                          {options.deliveryZones.map(z => (
                            <optgroup key={z.name} label={`${z.name} — ${formatXCG(z.fee)}`}>
                              {z.neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                            </optgroup>
                          ))}
                          <option value="other">Other / not listed — fee confirmed on WhatsApp</option>
                        </select>
                      </Field>
                    )}
                    <div aria-live="polite" style={{ marginTop: '10px', fontSize: '13px' }}>
                      {quoteLoading && fulfillment.lat !== null && <span style={{ color: 'var(--dark-warmth)' }}>Checking your zone…</span>}
                      {!quoteLoading && quote?.zone && (
                        <span style={{ color: 'var(--dark)' }}>
                          <i className="fas fa-check-circle" style={{ color: quote.zone.color || '#3D7A5F', marginRight: '6px' }}></i>
                          {quote.zone.name} · {quote.zone.estimatedDays} · {quote.deliveryFee === 0 ? <strong style={{ color: '#3D7A5F' }}>Free delivery</strong> : `Delivery ${formatXCG(quote.deliveryFee)}`}
                        </span>
                      )}
                      {!quoteLoading && zoneToConfirm && (
                        <div role="alert" style={{ background: '#FDF2E9', color: '#a04000', padding: '12px', borderRadius: '6px' }}>
                          <i className="fas fa-map-marked-alt" style={{ marginRight: '6px' }}></i>{zoneToConfirm.message}{' '}
                          {options?.pickupEnabled && <button type="button" onClick={() => changeMethod('pickup')} style={{ background: 'none', border: 'none', color: 'var(--muted-gold)', textDecoration: 'underline', cursor: 'pointer' }}>Switch to pickup</button>}
                          {options?.supportWhatsapp && <> · <a href={`https://wa.me/${options.supportWhatsapp}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted-gold)' }}>WhatsApp us</a></>}
                        </div>
                      )}
                    </div>
                    <Field label="Landmark / instructions (optional)" htmlFor="landmark">
                      <input id="landmark" value={fulfillment.landmark} onChange={e => setF({ landmark: e.target.value })} style={inputStyle}
                        placeholder="Yellow house next to the snack, gate code…" />
                    </Field>
                  </>
                )}

                {fulfillment.method === 'pickup' && (
                  <Field label="Pickup location" error={errors.pickup}>
                    {(options?.pickupLocations || []).map(loc => (
                      <label key={loc.id} className={`choice ${fulfillment.pickupLocationId === loc.id ? 'active' : ''}`} style={{ marginBottom: '10px', alignItems: 'flex-start' }}>
                        <input type="radio" name="pickup" checked={fulfillment.pickupLocationId === loc.id} onChange={() => setF({ pickupLocationId: loc.id })} />
                        <div>
                          <p style={{ fontWeight: 600 }}>{loc.name}</p>
                          <p style={{ fontSize: '13px' }}>{loc.address}</p>
                          {loc.hours && <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}><i className="far fa-clock" style={{ marginRight: '5px' }}></i>{loc.hours}</p>}
                          {loc.lat && loc.lng && (
                            <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--muted-gold)' }}>
                              Open in Maps
                            </a>
                          )}
                        </div>
                      </label>
                    ))}
                  </Field>
                )}

                <Field label={`${fulfillment.method === 'pickup' ? 'Pickup' : 'Delivery'} day & time *`} error={errors.slot}>
                  {slotsLoading && <p style={{ fontSize: '13px' }}>Loading available times…</p>}
                  {slotsError && (
                    <p role="alert" style={{ fontSize: '13px', color: '#c0392b' }}>
                      Could not load times. <button type="button" onClick={() => refetchSlots()} style={{ background: 'none', border: 'none', color: 'var(--muted-gold)', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
                    </p>
                  )}
                  {!slotsLoading && days.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                        {days.map(d => {
                          const open = !d.blocked && d.slots.some(s => s.available)
                          return (
                            <button key={d.date} type="button" disabled={!open}
                              className={`slot-btn ${fulfillment.date === d.date ? 'active' : ''}`}
                              onClick={() => setF({ date: d.date, slotId: null })}
                              title={d.blocked ? 'Closed' : !open ? 'Fully booked' : undefined}>
                              {formatDay(d.date)}
                            </button>
                          )
                        })}
                      </div>
                      {selectedDay && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                          {selectedDay.slots.map(s => (
                            <button key={s.id} type="button" disabled={!s.available}
                              className={`slot-btn ${fulfillment.slotId === s.id ? 'active' : ''}`}
                              onClick={() => setF({ slotId: s.id })}>
                              {s.label}
                              <span style={{ display: 'block', fontSize: '11px', opacity: .75 }}>
                                {s.available ? (s.remaining <= 2 ? `${s.remaining} left` : 'Available') : (s.remaining === 0 ? 'Full' : 'Unavailable')}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {fulfillment.method === 'delivery' && slotData?.cutoffHour !== undefined && (
                        <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginTop: '8px' }}>
                          Orders placed before {slotData.cutoffHour}:00 can be delivered the next working day.
                        </p>
                      )}
                    </>
                  )}
                  {!slotsLoading && !slotsError && days.every(d => !d.slots.some(s => s.available)) && (
                    <p style={{ fontSize: '13px', color: '#a04000' }}>No times available in the next days. Please contact us on WhatsApp.</p>
                  )}
                </Field>

                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                  <button type="button" onClick={() => setStep(1)} className="btn-outline" style={{ flex: 1 }}>Back</button>
                  <button type="submit" className="btn-shop" style={{ flex: 2 }}>Continue to payment</button>
                </div>
              </div>
            )}

            {/* STEP 3 — PAYMENT */}
            {step === 3 && (
              <div style={cardStyle}>
                <h2 style={h2Style}>Payment method</h2>
                {optionsLoading && <p>Loading…</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} role="radiogroup" aria-label="Payment method">
                  {(options?.paymentMethods || []).map(m => (
                    <label key={m.id} className={`choice ${paymentMethod === m.id ? 'active' : ''}`}>
                      <input type="radio" name="paymentMethod" value={m.id} checked={paymentMethod === m.id} onChange={() => setPaymentMethod(m.id)} />
                      <i className={`${m.id === 'whatsapp' ? 'fab' : 'fas'} ${m.icon}`} style={{ fontSize: '22px', color: 'var(--muted-gold)', width: '28px' }}></i>
                      <div>
                        <p style={{ fontWeight: 600 }}>{paymentLabel(m)}</p>
                        <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>
                          {m.id === 'sentoo' && options?.paymentsMode === 'mock' ? 'Demo mode — simulated online payment' : m.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.payment && <p role="alert" style={{ fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{errors.payment}</p>}
                {paymentMethod === 'sentoo' && (
                  <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginTop: '12px' }}>
                    Your items are reserved for {options?.paymentExpiryMinutes || 30} minutes while you pay.
                  </p>
                )}
                <Field label="Order notes (optional)" htmlFor="notes">
                  <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000}
                    style={{ ...inputStyle, minHeight: '80px' }} placeholder="Anything we should know?" />
                </Field>
                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                  <button type="button" onClick={() => setStep(2)} className="btn-outline" style={{ flex: 1 }}>Back</button>
                  <button type="submit" className="btn-shop" style={{ flex: 2 }}>Review order</button>
                </div>
              </div>
            )}

            {/* STEP 4 — REVIEW */}
            {step === 4 && (
              <div style={cardStyle}>
                <h2 style={h2Style}>Review your order</h2>
                {orderError && (
                  <div role="alert" style={{ background: 'var(--error-bg, #fdecea)', color: 'var(--error, #c0392b)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
                    {orderError}
                  </div>
                )}
                <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Contact</h3>
                  <p style={{ fontSize: '14px' }}>{contact.firstName} {contact.lastName} · {contact.phone}</p>
                  {contact.email && <p style={{ fontSize: '14px' }}>{contact.email}</p>}
                </div>
                <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                    {fulfillment.method === 'pickup' ? 'Pickup' : 'Delivery'}
                    <button type="button" onClick={() => setStep(2)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--muted-gold)', cursor: 'pointer', fontSize: '13px' }}>Change</button>
                  </h3>
                  {fulfillment.method === 'pickup'
                    ? <p style={{ fontSize: '14px' }}>{quote?.pickupLocation?.name} — {quote?.pickupLocation?.address}</p>
                    : <p style={{ fontSize: '14px' }}>{fulfillment.street}{quote?.zone ? ` · ${quote.zone.name}` : ''}</p>}
                  {quote?.slot && <p style={{ fontSize: '14px' }}><i className="far fa-calendar" style={{ marginRight: '6px' }}></i>{formatDay(quote.slot.date)}, {quote.slot.label}</p>}
                </div>
                <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--cream-bg)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                    Payment
                    <button type="button" onClick={() => setStep(3)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--muted-gold)', cursor: 'pointer', fontSize: '13px' }}>Change</button>
                  </h3>
                  <p style={{ fontSize: '14px' }}>{selectedPayment ? paymentLabel(selectedPayment) : '—'}</p>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
                  By placing your order you accept our <Link to="/terms" style={{ color: 'var(--muted-gold)' }}>terms</Link> and <Link to="/shipping" style={{ color: 'var(--muted-gold)' }}>delivery & returns policy</Link>.
                </p>
                <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setStep(3)} className="btn-outline" style={{ flex: 1 }} disabled={placing}>Back</button>
                  <button type="button" onClick={placeOrder} className="btn-shop" style={{ flex: 2, opacity: placing || quoteLoading || !quote?.canPlaceOrder ? 0.6 : 1 }}
                    disabled={placing || quoteLoading || !quote?.canPlaceOrder}>
                    {placing ? 'Placing order…' : paymentMethod === 'sentoo' ? `Pay ${formatXCG(quote?.total)}` : `Place order · ${formatXCG(quote?.total)}`}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* SUMMARY — always the server quote */}
          <aside aria-label="Order summary">
            <div className="checkout-summary" style={{ background: 'var(--white)', padding: '25px', borderRadius: '10px', position: 'sticky', top: '100px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '20px' }}>Order summary</h2>

              {lineIssues.length > 0 && (
                <div role="alert" style={{ background: '#FDF2E9', color: '#a04000', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px' }}>
                  {lineIssues.map((i, idx) => <p key={idx}>{i.message}</p>)}
                  <p style={{ marginTop: '6px' }}>Update your cart to continue.</p>
                </div>
              )}

              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                {cart.map(item => {
                  const qLine = quote?.lines?.find(l => Number(l.productId) === Number(item.id) && (l.variantId || null) === (item.variantId || null))
                  const issue = lineIssues.find(i => Number(i.productId) === Number(item.id) && (!i.variantId || i.variantId === item.variantId))
                  return (
                    <div key={lineKey(item)} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ width: '60px', height: '60px', position: 'relative', flexShrink: 0 }}>
                        <img src={item.image || '/images/placeholder.jpg'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px' }} />
                        <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--dark)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                          {item.quantity}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500 }}>{item.name}</p>
                        {(item.size || item.color) && <p style={{ fontSize: '11px', color: 'var(--dark-warmth)' }}>{[item.size, item.color].filter(Boolean).join(' / ')}</p>}
                        {issue && (
                          <p style={{ fontSize: '11px', color: '#c0392b' }}>
                            {issue.type === 'variant_required'
                              ? <Link to={`/product/${item.id}`} style={{ color: '#c0392b' }}>Choose a size</Link>
                              : issue.available > 0
                                ? <button type="button" onClick={() => cartStore.updateQuantity(lineKey(item), issue.available)} style={{ background: 'none', border: 'none', color: '#c0392b', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '11px' }}>Set quantity to {issue.available}</button>
                                : <button type="button" onClick={() => cartStore.removeItem(lineKey(item))} style={{ background: 'none', border: 'none', color: '#c0392b', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '11px' }}>Remove</button>}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 600 }}>{formatXCG(qLine ? qLine.lineTotal : item.price * item.quantity)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Coupon */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginBottom: '15px' }}>
                {quote?.coupon?.valid ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#E8F5E9', borderRadius: '5px' }}>
                    <span style={{ fontSize: '13px', color: '#3D7A5F', fontWeight: 600 }}>
                      <i className="fas fa-tag" style={{ marginRight: '6px' }}></i>{quote.coupon.code} −{formatXCG(quote.coupon.discount)}
                    </span>
                    <button type="button" aria-label="Remove coupon" onClick={() => { setCouponCode(''); setCouponInput('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b' }}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input aria-label="Coupon code" value={couponInput} onChange={e => setCouponInput(e.target.value)} placeholder="Coupon code"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                        style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '13px' }} />
                      <button type="button" onClick={applyCoupon} className="btn-outline" style={{ padding: '10px 15px', fontSize: '13px' }}>Apply</button>
                    </div>
                    {quote?.coupon && !quote.coupon.valid && (
                      <p role="alert" style={{ fontSize: '12px', color: '#c0392b', marginTop: '5px' }}>{quote.coupon.error}</p>
                    )}
                  </>
                )}
              </div>

              {/* Totals */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px', opacity: quoteLoading ? 0.6 : 1 }} aria-busy={quoteLoading}>
                {quoteError && (
                  <p role="alert" style={{ fontSize: '12px', color: '#c0392b', marginBottom: '10px' }}>{quoteError}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Subtotal</span><span>{quote ? formatXCG(quote.subtotal) : '—'}</span>
                </div>
                {quote?.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#3D7A5F' }}>
                    <span>Discount</span><span>−{formatXCG(quote.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>{fulfillment.method === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                  <span>
                    {fulfillment.method === 'pickup' ? 'Free'
                      : quote?.deliveryFeeToConfirm ? 'To confirm on WhatsApp'
                      : quote?.freeDelivery?.qualifies ? 'Free'
                      : !quote?.zone ? 'Set location'
                      : quote.deliveryFee === 0 ? 'Free' : formatXCG(quote.deliveryFee)}
                  </span>
                </div>
                {quote?.freeDelivery && !quote.freeDelivery.qualifies && (
                  <p style={{ fontSize: '12px', color: 'var(--muted-gold)', marginBottom: '10px' }}>
                    Add {formatXCG(quote.freeDelivery.remaining)} more for free delivery
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '18px', borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginTop: '10px' }}>
                  <span>Total</span><span>{quote ? formatXCG(quote.total) : '—'}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Prices in Caribbean guilder (XCG).</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

export default Checkout
