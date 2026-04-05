import { BUSINESS } from '../config'

const WA_NUMBER = BUSINESS.whatsapp

function buildUrl(message) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`
}

export function getGeneralInquiryUrl() {
  return buildUrl('Bon dia! Mi ta interesá pa sa mas di boso produktonan.')
}

export function getProductInquiryUrl({ name, ref, size, color }) {
  let msg = `Bon dia! Mi ta interesá den e produkto ${name} (REF: ${ref})`
  if (size) msg += ` - Tamaño: ${size}`
  if (color) msg += ` - Koló: ${color}`
  return buildUrl(msg)
}

export function getCartOrderUrl(items, total) {
  const itemsList = items.map(item => `- ${item.name} (x${item.quantity})`).join('\n')
  return buildUrl(`Bon dia! Mi lo ke ordená:\n${itemsList}\n\nTotal: XCG ${total.toFixed(2)}`)
}

export function getCheckoutOrderUrl({ orderNumber, customer, address, items, subtotal, deliveryFee, total }) {
  const itemsList = items.map(item => `- ${item.name} x${item.quantity} = XCG ${(item.price * item.quantity).toFixed(2)}`).join('\n')
  return buildUrl(
    `Order Nobo ${orderNumber}\n\n` +
    `Kliente: ${customer}\n` +
    `Adres: ${address}\n\n` +
    `Produktonan:\n${itemsList}\n\n` +
    `Subtotal: XCG ${subtotal.toFixed(2)}\n` +
    `Entrega: XCG ${deliveryFee.toFixed(2)}\n` +
    `Total: XCG ${total.toFixed(2)}`
  )
}

export function getAccountHelpUrl() {
  return buildUrl('Bon dia! Mi mester yudansa ku mi kuenta.')
}

export function getGeneralQuestionUrl() {
  return buildUrl('Bon dia! Mi tin un pregunta.')
}

export function getCategoryHelpUrl(slug) {
  const categoryNames = {
    'perfume': 'pèrfùm',
    'cremas': 'krema',
    'bloqueador': 'protekshon solar',
    'desodorantes': 'desodorante',
    'limpieza-facial': 'produkto di limpiesa facial',
    'accesorios': 'aksesorio'
  }
  const name = categoryNames[slug] || 'produkto'
  return buildUrl(`Bon dia! Mi mester yudansa pa skohe un ${name}.`)
}
