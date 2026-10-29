import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CURACAO_CENTER, CURACAO_BOUNDS } from '../data/curacaoZones'

// Click/tap the map to drop the delivery pin. The zone and fee are decided by
// the server from these coordinates (POST /api/checkout/quote), never here.

function ClickToPin({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) })
    }
  })
  return null
}

function FollowPin({ position }) {
  const map = useMap()
  const [lat, lng] = position
  useEffect(() => {
    const current = map.getCenter()
    const far = Math.abs(current.lat - lat) > 0.02 || Math.abs(current.lng - lng) > 0.02
    if (far) map.setView([lat, lng], Math.max(map.getZoom(), 14))
  }, [map, lat, lng])
  return null
}

function LocationPicker({ lat, lng, onChange, height = 280 }) {
  const [geoStatus, setGeoStatus] = useState('idle')
  const position = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('ok')
        onChange({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) })
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Zone outlines are not drawn: the approved near/far zones have no map yet (DEC-006).
  const rings = []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--dark-warmth)' }}>
          <i className="fas fa-map-pin" style={{ marginRight: '5px', color: 'var(--muted-gold)' }}></i>
          Tap the map where we should deliver
        </span>
        <button type="button" onClick={useMyLocation} className="btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
          <i className="fas fa-crosshairs" style={{ marginRight: '5px' }}></i>
          {geoStatus === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      {geoStatus === 'error' && (
        <p role="alert" style={{ fontSize: '12px', color: '#c0392b', marginBottom: '6px' }}>
          We could not get your location. Tap the map instead.
        </p>
      )}
      <div style={{ height, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer
          center={position || CURACAO_CENTER}
          zoom={position ? 14 : 11}
          maxBounds={CURACAO_BOUNDS}
          maxBoundsViscosity={0.8}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {rings.map(r => (
            <Polygon key={r.key} positions={r.ring} pathOptions={{ color: r.color, weight: 1, fillOpacity: 0.12 }} interactive={false} />
          ))}
          <ClickToPin onPick={onChange} />
          {position && (
            <>
              <CircleMarker center={position} radius={10} pathOptions={{ color: '#1B4D4F', fillColor: '#C9A96E', fillOpacity: 1, weight: 3 }} />
              <FollowPin position={position} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default LocationPicker
