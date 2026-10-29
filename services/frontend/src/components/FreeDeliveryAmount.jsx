import { useCheckoutOptions, formatXCG } from '../hooks/useCheckoutOptions'

// The free-delivery threshold as the server applies it (DEC-001). Every banner,
// product page and policy text uses this so they can never disagree with checkout.
function FreeDeliveryAmount() {
  const { data } = useCheckoutOptions()
  if (!data?.freeDeliveryThreshold) return null
  return <>{formatXCG(data.freeDeliveryThreshold).replace('.00', '')}</>
}

export default FreeDeliveryAmount
