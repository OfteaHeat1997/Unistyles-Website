// UNISTYLES Business Configuration
// Edit these values to update business information across the site

export const BUSINESS = {
  name: 'UNISTYLES',
  tagline: 'Belleza Colombiana en Curacao',
  description: 'Tu destino de belleza colombiana. Brasiers, fajas, perfumes y productos de cuidado personal.',

  // Contact Information
  email: 'info@unistylescuracao.com',
  phone: '+5999 673 6285',
  whatsapp: '59996736285',
  whatsappMessage: 'Hola! Me interesa conocer más sobre sus productos.',

  // Location
  address: 'Willemstad, Curacao',

  // Social Media
  social: {
    instagram: 'https://instagram.com/unistylescuracao',
    facebook: 'https://facebook.com/unistylescuracao',
    tiktok: 'https://tiktok.com/@unistylescuracao'
  },

  // Business Hours
  hours: {
    weekdays: '9:00 AM - 6:00 PM',
    saturday: '10:00 AM - 4:00 PM',
    sunday: 'Closed'
  }
}

// Product Categories
export const CATEGORIES = [
  {
    id: 'bras',
    name: 'Brasiers',
    slug: 'bras',
    description: 'Brasiers colombianos de alta calidad',
    image: '/images/categories/bras.jpg'
  },
  {
    id: 'panties',
    name: 'Panties',
    slug: 'panties',
    description: 'Panties cómodos y elegantes',
    image: '/images/categories/panties.jpg'
  },
  {
    id: 'shapewear',
    name: 'Fajas',
    slug: 'shapewear',
    description: 'Fajas colombianas moldeadoras',
    image: '/images/categories/shapewear.jpg'
  },
  {
    id: 'perfume',
    name: 'Perfumes',
    slug: 'perfume',
    description: 'Colombian perfumes and fragrances',
    image: '/images/categories/perfume.jpg'
  },
  {
    id: 'cremas',
    name: 'Cremas',
    slug: 'cremas',
    description: 'Cremas y cuidado de la piel',
    image: '/images/categories/cremas.jpg'
  },
  {
    id: 'bloqueador',
    name: 'Bloqueador',
    slug: 'bloqueador',
    description: 'Protección solar',
    image: '/images/categories/bloqueador.jpg'
  },
  {
    id: 'desodorantes',
    name: 'Personal Care',
    slug: 'desodorantes',
    description: 'Deodorants, talcum powders, body sprays & personal care',
    image: '/images/categories/desodorantes.jpg'
  },
  {
    id: 'limpieza-facial',
    name: 'Limpieza Facial',
    slug: 'limpieza-facial',
    description: 'Productos de limpieza facial',
    image: '/images/categories/limpieza-facial.jpg'
  },
  {
    id: 'accesorios',
    name: 'Accesorios',
    slug: 'accesorios',
    description: 'Accesorios de belleza',
    image: '/images/categories/accesorios.jpg'
  }
]

// Payment Methods
export const PAYMENT_METHODS = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    description: 'Paga en efectivo al recibir tu pedido',
    icon: 'fa-money-bill-wave',
    enabled: true
  },
  {
    id: 'sentoo',
    name: 'Sentoo',
    description: 'Paga con banco, Visa/Mastercard, o iDEAL',
    icon: 'fa-credit-card',
    enabled: true
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    description: 'Transferencia bancaria directa',
    icon: 'fa-university',
    enabled: true
  }
]

// Delivery zones live in the backend (table delivery_zones).
// Use `useDeliveryZones` from src/hooks/useDeliveryZones.js to read them.
export const DELIVERY_FALLBACK_THRESHOLD = 80

// Currency
export const CURRENCY = {
  code: 'XCG',
  symbol: 'XCG',
  name: 'Caribbean Guilder'
}

// Size Charts
export const SIZE_CHARTS = {
  bras: {
    headers: ['Size', 'Band (inches)', 'Cup'],
    rows: [
      ['32A', '27-28', 'A'],
      ['32B', '27-28', 'B'],
      ['34A', '29-30', 'A'],
      ['34B', '29-30', 'B'],
      ['34C', '29-30', 'C'],
      ['36B', '31-33', 'B'],
      ['36C', '31-33', 'C'],
      ['36D', '31-33', 'D'],
      ['38C', '34-36', 'C'],
      ['38D', '34-36', 'D']
    ]
  },
  shapewear: {
    headers: ['Size', 'Waist (inches)', 'Hips (inches)'],
    rows: [
      ['XS', '24-26', '34-36'],
      ['S', '27-29', '37-39'],
      ['M', '30-32', '40-42'],
      ['L', '33-35', '43-45'],
      ['XL', '36-38', '46-48'],
      ['XXL', '39-41', '49-51']
    ]
  }
}

export default {
  BUSINESS,
  CATEGORIES,
  PAYMENT_METHODS,
  DELIVERY_FALLBACK_THRESHOLD,
  CURRENCY,
  SIZE_CHARTS
}
