import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  CURACAO_ZONES,
  CURACAO_CENTER,
  CURACAO_BOUNDS,
  findZoneByPoint
} from '../data/curacaoZones'

function FlyToButton({ position }) {
  const map = useMap()
  if (!position) return null
  return (
    <button
      type="button"
      onClick={() => map.flyTo(position, 14, { duration: 1.2 })}
      style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 500,
        background: 'white', border: '1px solid #ccc', borderRadius: '6px',
        padding: '6px 10px', fontSize: '12px', cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
      }}
    >
      <i className="fas fa-crosshairs" style={{ marginRight: '5px' }}></i>
      Center on me
    </button>
  )
}

function DeliveryMap({ height = 400, onZoneDetected }) {
  const [userPos, setUserPos] = useState(null)
  const [detectedZone, setDetectedZone] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | locating | error | ok | outside

  const polygons = useMemo(() => {
    const items = []
    for (const zone of CURACAO_ZONES) {
      if (zone.polygon) items.push({ zone, ring: zone.polygon })
      if (zone.multiPolygon) {
        zone.multiPolygon.forEach((ring, i) =>
          items.push({ zone, ring, partKey: `${zone.id}-${i}` })
        )
      }
    }
    return items
  }, [])

  const detectMyZone = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(point)
        const zone = findZoneByPoint(point)
        setDetectedZone(zone)
        setGeoStatus(zone ? 'ok' : 'outside')
        if (zone && onZoneDetected) onZoneDetected(zone, point)
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        height,
        borderRadius: '12px', overflow: 'hidden',
        border: '2px solid var(--border-light)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        position: 'relative'
      }}>
        <MapContainer
          center={CURACAO_CENTER}
          zoom={11}
          maxBounds={CURACAO_BOUNDS}
          maxBoundsViscosity={0.5}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {polygons.map(({ zone, ring, partKey }) => (
            <Polygon
              key={partKey || zone.id}
              positions={ring}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.25,
                weight: 2
              }}
            >
              <Tooltip sticky>
                <strong>{zone.name}</strong><br />
                {zone.fee === 0 ? 'FREE' : `XCG ${zone.fee}`} · {zone.estimatedDays}<br />
                <span style={{ color: '#666' }}>Free over XCG {zone.freeThreshold}</span>
              </Tooltip>
            </Polygon>
          ))}

          {userPos && (
            <CircleMarker
              center={userPos}
              radius={9}
              pathOptions={{ color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.9, weight: 3 }}
            >
              <Popup>
                <strong>You are here</strong>
                {detectedZone ? (
                  <>
                    <br />Zone: <strong>{detectedZone.name}</strong>
                    <br />Fee: <strong>{detectedZone.fee === 0 ? 'FREE' : `XCG ${detectedZone.fee}`}</strong>
                  </>
                ) : (
                  <><br />Outside known delivery zones</>
                )}
              </Popup>
            </CircleMarker>
          )}

          <FlyToButton position={userPos} />
        </MapContainer>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={detectMyZone}
          disabled={geoStatus === 'locating'}
          style={{
            background: '#1a1a1a', color: 'white', border: 'none',
            padding: '10px 18px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 600,
            opacity: geoStatus === 'locating' ? 0.6 : 1
          }}
        >
          <i className="fas fa-location-arrow" style={{ marginRight: '6px' }}></i>
          {geoStatus === 'locating' ? 'Locating…' : 'Detect my zone'}
        </button>

        {geoStatus === 'ok' && detectedZone && (
          <span style={{ fontSize: '14px' }}>
            <i className="fas fa-check-circle" style={{ color: detectedZone.color, marginRight: '5px' }}></i>
            You're in <strong>{detectedZone.name}</strong> — fee{' '}
            <strong>{detectedZone.fee === 0 ? 'FREE' : `XCG ${detectedZone.fee}`}</strong>
          </span>
        )}
        {geoStatus === 'outside' && (
          <span style={{ fontSize: '14px', color: '#c0392b' }}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: '5px' }}></i>
            Your location is outside Curaçao delivery coverage
          </span>
        )}
        {geoStatus === 'error' && (
          <span style={{ fontSize: '14px', color: '#c0392b' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '5px' }}></i>
            Could not get your location — please check browser permissions
          </span>
        )}
      </div>
    </div>
  )
}

export default DeliveryMap
