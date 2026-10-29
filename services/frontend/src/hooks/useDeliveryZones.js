import { apiUrl } from '../utils/api'
import { useQuery } from '@tanstack/react-query'

// No hardcoded fallback: invented fees are worse than an honest "unavailable".
const EMPTY = { freeShippingThreshold: null, zones: [] }

async function fetchZones() {
  const res = await fetch(apiUrl('/api/delivery/zones'))
  if (!res.ok) {
    throw new Error(`Delivery zones fetch failed: ${res.status}`)
  }
  return res.json()
}

export function useDeliveryZones() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['delivery', 'zones'],
    queryFn: fetchZones,
    staleTime: 10 * 60 * 1000,
    retry: 1
  })

  const payload = data || EMPTY

  const findZoneByArea = (area) => {
    if (!area) return null
    const lower = area.toLowerCase()
    return payload.zones.find(z =>
      z.neighborhoods?.some(n => (n.name || '').toLowerCase() === lower)
    ) || null
  }

  const calculateFee = (area, subtotal) => {
    const zone = findZoneByArea(area)
    if (!zone) {
      return { zone: null, fee: 0, qualifiesForFree: false, threshold: payload.freeShippingThreshold }
    }
    const threshold = zone.freeThreshold ?? payload.freeShippingThreshold
    const qualifiesForFree = subtotal >= threshold
    return {
      zone,
      fee: qualifiesForFree ? 0 : zone.fee,
      baseFee: zone.fee,
      qualifiesForFree,
      threshold
    }
  }

  const allAreas = (payload.zones || []).flatMap(z =>
    (z.neighborhoods || []).map(n => ({ ...n, zone: z }))
  )

  return {
    zones: payload.zones,
    freeShippingThreshold: payload.freeShippingThreshold,
    allAreas,
    findZoneByArea,
    calculateFee,
    isLoading,
    error
  }
}
