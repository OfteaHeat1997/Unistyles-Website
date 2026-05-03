import { useState, useEffect, useRef } from 'react'

// Nominatim (OpenStreetMap) free geocoder, scoped to Curaçao (cw).
// Usage policy: max 1 req/sec, attribution required.
// We debounce 400ms which is well within the limit for an autocomplete.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

async function searchNominatim(query, signal) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'cw',
    addressdetails: '1',
    limit: '6'
  })
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'Accept-Language': 'en,es,nl' },
    signal
  })
  if (!res.ok) throw new Error('Nominatim error')
  return res.json()
}

function buildLabel(item) {
  const a = item.address || {}
  const street = a.road || a.pedestrian || a.path || item.name || ''
  const num = a.house_number ? ` ${a.house_number}` : ''
  const area = a.suburb || a.neighbourhood || a.village || a.town || a.city || a.county || ''
  const head = (street + num).trim() || item.display_name.split(',')[0]
  return { head, area }
}

function AddressAutocomplete({ value, onChange, onPick, placeholder = 'Start typing your address…', required = false }) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleInput = (e) => {
    const next = e.target.value
    onChange(next)
    setError('')

    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (next.trim().length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const data = await searchNominatim(next, ctrl.signal)
        setResults(data)
        setOpen(true)
      } catch (err) {
        if (err.name !== 'AbortError') setError('Could not search addresses')
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  const handlePick = (item) => {
    const { head, area } = buildLabel(item)
    setOpen(false)
    setResults([])
    onChange(head)
    onPick({
      street: head,
      area,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
      raw: item
    })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '12px', color: 'var(--dark-warmth)' }}>
          <i className="fas fa-spinner fa-spin"></i>
        </span>
      )}
      {error && (
        <p style={{ fontSize: '12px', color: '#c0392b', marginTop: '4px' }}>{error}</p>
      )}
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid var(--border)', borderRadius: '6px',
          listStyle: 'none', margin: 0, padding: 0, maxHeight: '260px', overflowY: 'auto',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)'
        }}>
          {results.map(item => {
            const { head, area } = buildLabel(item)
            return (
              <li key={item.place_id}>
                <button
                  type="button"
                  onClick={() => handlePick(item)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-light)',
                    padding: '10px 14px', cursor: 'pointer', fontSize: '14px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--cream-bg)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 600 }}>{head}</div>
                  <div style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
                    {area ? `${area} · ` : ''}{item.display_name}
                  </div>
                </button>
              </li>
            )
          })}
          <li style={{ padding: '6px 14px', fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--cream-bg)' }}>
            Powered by{' '}
            <a href="https://nominatim.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
              Nominatim / OpenStreetMap
            </a>
          </li>
        </ul>
      )}
    </div>
  )
}

export default AddressAutocomplete
