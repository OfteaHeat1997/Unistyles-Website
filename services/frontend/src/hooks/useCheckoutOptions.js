import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'

// Store-wide checkout rules from the server: free-delivery threshold, enabled
// payment methods, pickup locations, support number. No hardcoded fallback —
// if the API is down the UI says so instead of showing invented prices.
export function useCheckoutOptions() {
  return useQuery({
    queryKey: ['checkout', 'options'],
    queryFn: () => api.get('/api/checkout/options', { auth: false }),
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

export function formatXCG(amount) {
  const n = Number(amount || 0)
  return `XCG ${n.toFixed(2)}`
}
