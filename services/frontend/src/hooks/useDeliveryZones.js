import { useQuery } from '@tanstack/react-query'

const FALLBACK = {
  freeShippingThreshold: 80,
  zones: [
    { id: 1, slug: 'zone-1-centro', name: 'Zone 1 — Centro', fee: 5, freeThreshold: 75, color: '#27ae60', estimatedDays: '1-2 business days', sortOrder: 1, neighborhoods: [] },
    { id: 2, slug: 'zone-2-east', name: 'Zone 2 — East', fee: 10, freeThreshold: 100, color: '#e67e22', estimatedDays: '1-2 business days', sortOrder: 2, neighborhoods: [] },
    { id: 3, slug: 'zone-3-west-north', name: 'Zone 3 — West & North', fee: 25, freeThreshold: 150, color: '#c0392b', estimatedDays: '2-3 business days', sortOrder: 3, neighborhoods: [] }
  ]
}

async function fetchZones() {
  const res = await fetch('/api/delivery/zones')
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

  const payload = data || FALLBACK

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
