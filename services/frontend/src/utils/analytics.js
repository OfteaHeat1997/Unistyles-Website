// Funnel events (search → view → variant → cart → checkout → payment → purchase).
// No third-party tracker until the consent decision is made; events go to the
// console in dev and to window.dataLayer if a tag manager is added later.

export function track(event, props = {}) {
  try {
    const payload = { event, ...props, ts: Date.now() }
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload)
    if (import.meta.env.DEV) console.debug('[analytics]', payload)
  } catch {
    // analytics must never break the shop
  }
}

export default track
